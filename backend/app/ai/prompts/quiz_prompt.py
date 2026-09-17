from typing import List, Dict, Any


def build_concept_extraction_prompt(project_name: str, context_chunks: List[str]) -> tuple[str, str]:
    """Generates prompt to extract 5-10 key concepts from project materials."""
    system_prompt = (
        "You are an expert curriculum architect and educational assessment designer. "
        "Your task is to analyze study material chunks and extract the 5 to 10 foundational learning concepts. "
        "Each concept must have a concise, canonical name (2-5 words) and a precise 1-2 sentence description. "
        "Strictly ground the concepts in the provided text. Avoid generic filler concepts."
    )

    chunks_joined = "\n\n---\n\n".join(context_chunks)
    user_prompt = f"""PROJECT TITLE: {project_name}

STUDY MATERIAL EXCERPTS:
{chunks_joined}

Extract 5 to 10 key concepts taught in these materials. For each concept provide its name and a concise description."""

    return system_prompt, user_prompt


def build_quiz_generation_prompt(
    project_name: str,
    target_concepts: List[Dict[str, Any]],
    context_chunks: List[str],
    num_questions: int = 4,
    difficulty: str = "medium",
) -> tuple[str, str]:
    """Generates prompt to create balanced MCQ and open-ended questions grounded in context."""
    system_prompt = (
        "You are an expert AI Examiner designing rigorous, pedagogically sound assessment questions. "
        "Rules for Question Design:\n"
        "1. Every single question must be 100% grounded in the provided source excerpts.\n"
        "2. Mix Multiple Choice Questions (MCQ) and Open-Ended conceptual questions (roughly 50/50 split).\n"
        "3. MCQs must have exactly 4 clear, mutually exclusive options. The correct answer must match one option exactly.\n"
        "4. Open-ended questions should assess deeper conceptual understanding, mechanism explanation, or synthesis.\n"
        "5. Provide an unambiguous reference answer and a clear pedagogical explanation for each question.\n"
        "6. Do not include meta-commentary. Output strictly adhering to the JSON schema."
    )

    concepts_summary = "\n".join([f"- {c.get('name')}: (Current Mastery: {c.get('score', 0):.0f}%, Priority: {c.get('priority', 'normal')})" for c in target_concepts])
    chunks_joined = "\n\n---\n\n".join(context_chunks)

    user_prompt = f"""PROJECT: {project_name}
DIFFICULTY LEVEL: {difficulty}
TARGET QUESTION COUNT: {num_questions}

TARGET CONCEPTS TO EVALUATE:
{concepts_summary}

STUDY MATERIAL EXCERPTS:
{chunks_joined}

Generate {num_questions} high-quality assessment questions targeting these concepts, evenly mixing MCQ and Open-Ended questions."""

    return system_prompt, user_prompt


def build_open_ended_grading_prompt(
    question_prompt: str,
    reference_answer: str,
    explanation: str,
    student_response: str,
    context_chunk: str = "",
) -> tuple[str, str]:
    """Generates prompt for AI Rubric grading of open-ended student responses."""
    system_prompt = (
        "You are an objective academic evaluator grading a student's open-ended response. "
        "Evaluate the response based on conceptual accuracy, completeness, and clarity compared to the reference answer.\n"
        "Grading Rubric:\n"
        "- Score 0.90 to 1.00: Exceptionally accurate, comprehensive, and clear explanation of all core mechanisms.\n"
        "- Score 0.70 to 0.89: Largely correct with minor missing nuances or slightly imprecise phrasing.\n"
        "- Score 0.40 to 0.69: Partially correct; captures some core ideas but contains notable gaps or minor misconceptions.\n"
        "- Score 0.00 to 0.39: Fundamentally incorrect, irrelevant, or major misconceptions.\n"
        "Set 'is_correct' to true if score >= 0.65.\n"
        "Provide constructive feedback broken down into: 'understood' (what they got right), 'missing' (what was incomplete/incorrect), and 'key_concepts' (topics to review)."
    )

    user_prompt = f"""QUESTION:
{question_prompt}

REFERENCE ANSWER:
{reference_answer}

EXPLANATION:
{explanation}

STUDENT'S RESPONSE:
{student_response}

Evaluate the student's answer using the rubric and produce structured scoring and feedback."""

    return system_prompt, user_prompt
