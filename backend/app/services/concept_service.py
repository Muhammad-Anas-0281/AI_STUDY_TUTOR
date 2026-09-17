import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.concept import Concept
from app.db.models.mastery import Mastery
from app.db.models.material import Chunk
from app.db.models.project import Project
from app.ai.providers.gemini_provider import gemini_provider
from app.ai.providers.groq_provider import groq_provider
from app.ai.prompts.quiz_prompt import build_concept_extraction_prompt
from app.schemas.concept import ExtractedConceptsList


class ConceptService:
    @staticmethod
    async def get_project_concepts(db: AsyncSession, project_id: str) -> List[Concept]:
        """Fetch all concepts for a project with mastery info loaded."""
        stmt = (
            select(Concept)
            .where(Concept.project_id == project_id)
            .options(selectinload(Concept.mastery))
            .order_by(Concept.name.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def extract_concepts_for_project(
        db: AsyncSession,
        project_id: str,
        user_id: str,
        force_refresh: bool = False
    ) -> List[Concept]:
        """Extract 5-10 core concepts from project documents using LLM structured output."""
        # 1. Check existing concepts if not forcing refresh
        existing = await ConceptService.get_project_concepts(db, project_id)
        if existing and not force_refresh:
            return existing

        # 2. Get project details and representative chunks
        project = await db.get(Project, project_id)
        project_name = project.name if project else "Study Subject"

        chunk_stmt = (
            select(Chunk)
            .where(Chunk.project_id == project_id)
            .limit(15)
        )
        chunk_result = await db.execute(chunk_stmt)
        chunks = chunk_result.scalars().all()

        if not chunks:
            # If no document chunks uploaded yet, return empty list or fallback concepts
            return existing

        context_texts = [f"[{c.document_id} p.{c.page_number or 1}]: {c.content}" for c in chunks]

        # 3. Build extraction prompt
        system_prompt, user_prompt = build_concept_extraction_prompt(project_name, context_texts)

        # 4. Generate structured response with Gemini / Groq fallback
        extracted_data: Optional[ExtractedConceptsList] = None
        try:
            extracted_data = await gemini_provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=ExtractedConceptsList,
                temperature=0.2,
            )
        except Exception as e:
            print(f"Gemini concept extraction failed, falling back to Groq: {e}")
            try:
                extracted_data = await groq_provider.generate_structured(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_schema=ExtractedConceptsList,
                    temperature=0.2,
                )
            except Exception as e2:
                print(f"Groq concept extraction failed: {e2}")
                return existing

        if not extracted_data or not extracted_data.concepts:
            return existing

        # 5. Persist extracted concepts and initialize mastery records
        new_concepts = []
        for item in extracted_data.concepts:
            # Check if concept with same name exists
            match = next((c for c in existing if c.name.lower() == item.name.lower()), None)
            if not match:
                concept_id = str(uuid.uuid4())
                concept = Concept(
                    id=concept_id,
                    project_id=project_id,
                    name=item.name,
                    description=item.description,
                )
                db.add(concept)

                # Initialize mastery entry
                mastery = Mastery(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    concept_id=concept_id,
                    score=0.0,
                    evidence_count=0,
                    status="needs_attention",
                )
                db.add(mastery)
                new_concepts.append(concept)

        await db.commit()
        return await ConceptService.get_project_concepts(db, project_id)


concept_service = ConceptService()
