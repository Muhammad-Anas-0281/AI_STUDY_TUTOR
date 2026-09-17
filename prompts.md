# AI Study Companion - Development Prompts & Task Log

This document records the user prompts, actions performed, timestamps, and corresponding implementation phases as required by the project development rules.

---

### Entry 1
- **Phase**: Phase 0 — Foundations & Project Setup
- **Timestamp**: 2026-09-17T16:41:05+05:30
- **User Prompt**:
  > "so in this project 
  > You have to maintain a rule that you can see there is prompts.md there you have to specify the prompt , what work you have done then timestamp for each task i give to you and represent to which phase it belongs to . this is the rule 
  > Second is there is the project.md which is my problem statement and info.md the approch to use for this project 
  > So now you have to implement those phases listed each and everything step by step 
  > So before starting tell me how to setup the project first then i would setup all and then you will continue to the doing of project"
- **Work Done**:
  1. Reviewed `project.md` (Product Requirements Document v3.0) and `info.md` (Next.js + FastAPI Full Engineering Blueprint).
  2. Initialized `prompts.md` with the strict tracking template for all future development tasks.
  3. Formulated the complete prerequisite and local setup guide (Python, Node.js, PostgreSQL with pgvector, Redis, Docker, and API keys) to enable seamless phase-by-phase execution.

---

### Entry 2
- **Phase**: Phase 0 — Foundations & Project Configuration
- **Timestamp**: 2026-09-17T17:43:59+05:30
- **User Prompt**:
  > User provided Supabase PostgreSQL credentials, Upstash Redis credentials, and OpenAI API Key. User requested review of the Zero-Budget ($0) engineering blueprint adaptation to accommodate the lack of an Anthropic subscription and use OpenAI / Groq / Gemini.
- **Work Done**:
  1. Updated project configuration strategy to seamlessly use OpenAI (`gpt-4o-mini` + `text-embedding-3-small`) with fallbacks/support for Gemini / Groq / local embeddings via the unified `AIProvider` interface.
  2. Verified the compatibility of Supabase PostgreSQL (`pgvector`), Upstash Redis (`rediss://`), and self-rolled JWT authentication.
  3. Formulated Phase 0 implementation plan (Backend skeleton with FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2 schemas, JWT auth, and Next.js 14 frontend setup).

---

### Entry 3
- **Phase**: Phase 0 — Blueprint Deep-Dive & Architecture Alignment
- **Timestamp**: 2026-09-17T17:47:22+05:30
- **User Prompt**:
  > User requested a comprehensive review of the entire Zero-Budget Engineering Blueprint (FastAPI + Next.js 14, Arq + Upstash Redis, Supabase Postgres with pgvector, Free-tier AI Providers, and 8-phase execution plan) to ensure full alignment before code generation.
- **Work Done**:
  1. Detailed the full architectural breakdown of the 4 core subsystems (Knowledge, Tutor RAG, Adaptive Assessment, and Growth/Insights).
  2. Confirmed the exact mapping of all 8 phases (Phase 0 through Phase 7 + Phase 8 differentiators).
  3. Validated technical alignment for all database schemas, API routes, tool interfaces (PRD §8 safe tool calls), and background jobs.

---

### Entry 4
- **Phase**: Phase 0 — Foundations (Zero-Budget Stack Setup & Scaffolding Kickoff)
- **Timestamp**: 2026-09-17T17:55:38+05:30
- **User Prompt**:
  > User confirmed the transition to the $0 Zero-Budget Stack (Groq for Tutor streaming, Google Gemini for structured tasks, local sentence-transformers `all-MiniLM-L6-v2` for embeddings, Supabase Postgres with pgvector, Upstash Redis with Arq), provided Gemini & Groq API keys, and instructed to initialize the Python virtual environment and implement Phase 0 step-by-step.
- **Work Done**:
  1. Updated project configuration to utilize Groq (`llama-3.3-70b-versatile`), Google Gemini (`gemini-2.0-flash`), and local embeddings (`sentence-transformers/all-MiniLM-L6-v2` - 384 dim).
  2. Initialized backend Python virtual environment (`.venv`) and installed dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `pgvector`, `pydantic-settings`, `python-jose`, `passlib[bcrypt]`, `sentence-transformers`, `groq`, `google-genai`, `arq`, `redis`, `structlog`).
  3. Scaffolded `backend/` and `frontend/` directory structures for Phase 0.

---

### Entry 5
- **Phase**: Phase 1 — Materials & Knowledge Pipeline (with shadcn/ui Component Setup)
- **Timestamp**: 2026-09-17T18:20:14+05:30
- **User Prompt**:
  > "yeah all are ok but implement using shadcnUI instead of tailwind so that the components can be easily done 
  > And yeah lets go to the phase 1 
  > and also tell me how to check the work 
  > And do cautiously"
- **Work Done**:
  1. Integrated shadcn/ui UI component library (`button`, `card`, `dialog`, `badge`, `progress`, `tabs`, `input`, `textarea`, `dropdown-menu`) into `frontend/components/ui/` with `clsx` and `tailwind-merge` (`cn` utility).
  2. Implemented Document Ingestion API (`POST /projects/{project_id}/documents`, `GET /projects/{project_id}/documents`, `GET /documents/{document_id}`).
  3. Built background document processing pipeline with PyMuPDF / pdfplumber extraction, metadata tagging, sliding-window chunking, and local `sentence-transformers/all-MiniLM-L6-v2` embedding generation.
  4. Implemented semantic vector retrieval service (`retrieval_service.search`) using `pgvector` with strict project isolation (`WHERE project_id = :id`) and cosine distance ranking.
  5. Built frontend Materials dashboard with PDF drag-and-drop uploader, real-time status polling badge (`queued` -> `processing` -> `ready` / `failed`), and chunk inspector.
  6. Provided exact verification steps to test the entire ingestion and retrieval flow.

---

### Entry 6
- **Phase**: Phase 2 — AI Tutor (Grounded RAG, Streaming SSE, Citations, Insufficient Evidence Refusal) & GitHub Repo Sync
- **Timestamp**: 2026-09-17T18:46:12+05:30
- **User Prompt**:
  > "i am ready for phase 2 
  > You can proceed and before doing can you push this code to github of link https://github.com/Muhammad-Anas-0281/AI_STUDY_TUTOR.git which i have created just now and i didnt initialized readme yet for that 
  > And then do the phase 2"
- **Work Done**:
  1. Configured repository `.gitignore` (ignoring `.env`, `.venv`, `node_modules`, `uploads/`, `__pycache__`) and generated comprehensive `README.md`.
  2. Initialized Git repository and pushed current clean codebase to `https://github.com/Muhammad-Anas-0281/AI_STUDY_TUTOR.git`.
  3. Implemented Unified `AIProvider` abstraction supporting Groq (`openai/gpt-oss-120b`) and Google Gemini (`gemini-3.6-flash`), with automatic fallback and `ai_requests` observability logging.
  4. Implemented `tutor_service.py` with multi-tier context composition (retrieved chunks + rolling summary + learning context), confidence scoring, and strict refusal on insufficient evidence.
  5. Implemented Server-Sent Events (SSE) streaming endpoint `POST /api/v1/projects/{project_id}/tutor/ask` and session history.
  6. Built modern two-pane AI Tutor Chat UI in Next.js using shadcn/ui with live streaming tokens, expandable Sources panel (page-level citations), and amber Insufficient Evidence banner.

---
