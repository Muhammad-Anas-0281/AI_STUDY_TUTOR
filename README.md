# 🎓 AI Study Companion — AI-Powered Learning & Growth Workspace

> A persistent, contextual, measurable AI learning partner built with **FastAPI**, **Next.js 14**, **Supabase (PostgreSQL + pgvector)**, **Groq**, **Google Gemini**, and local **sentence-transformers**.

---

## 🌟 Overview & Core Mental Model

AI Study Companion is not just a chatbot with a PDF uploader. It is a unified, event-driven learning workspace built around four interconnected subsystems:

1. **Knowledge System**: PDF upload ➔ Text extraction (`pymupdf`) ➔ Sliding-window chunking ➔ Local embeddings (`sentence-transformers/all-MiniLM-L6-v2`) ➔ Vector index in Supabase `pgvector`.
2. **Tutor System**: Grounded RAG chat with streaming Server-Sent Events (SSE), page citations, and automatic refusal on insufficient evidence.
3. **Assessment System**: Adaptive quiz generation (MCQ + open-ended) with LLM rubric grading and dynamic mastery tracking.
4. **Insight System**: Growth trend analysis, weakness pattern detection, and actionable next-step recommendations.

---

## 🛠️ $0 Zero-Budget Architecture & Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router) + TypeScript + shadcn/ui + Tailwind CSS | Fast dark-mode study workspace with streaming chat & charts |
| **Backend** | FastAPI (Python 3.10+) + Pydantic v2 + SQLAlchemy 2.0 Async | High-performance async REST API & SSE streaming |
| **Database & Vectors** | Supabase PostgreSQL + `pgvector` extension | Unified relational storage and 384-dim cosine vector search |
| **Background Queue** | Arq + Upstash Redis | Asynchronous PDF processing & mastery update workflows |
| **AI LLM Providers** | Groq (`openai/gpt-oss-120b`) + Google Gemini (`gemini-3.6-flash`) | Fast token streaming for Tutor & structured JSON output for assessments |
| **Embeddings** | Local `sentence-transformers/all-MiniLM-L6-v2` | 384-dimensional dense embeddings running locally on CPU ($0 cost) |
| **Authentication** | Self-rolled JWT (FastAPI + bcrypt + python-jose) | Stateless auth with strict project-level data isolation |

---

## 🚀 Quickstart Guide

### Prerequisites
* **Python 3.10+**
* **Node.js 18+ & npm**
* **Supabase Project** with `vector` extension enabled
* **Upstash Redis Database**
* **Groq & Google AI Studio (Gemini) API Keys**

---

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # On Windows

pip install -r requirements.txt
```

Create `backend/.env` from `backend/.env.example` and set your credentials:
```env
PROJECT_NAME="AI Study Companion"
ENVIRONMENT="development"
SECRET_KEY="your-jwt-secret-key"

DATABASE_URL="postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
REDIS_URL="rediss://default:<password>@<host>.upstash.io:6379"

GROQ_API_KEY="gsk_..."
GEMINI_API_KEY="AIza..."

EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION=384
```

Start the Backend Server:
```bash
uvicorn app.main:app --reload --port 8000
```
API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
```

Start the Frontend Dev Server:
```bash
npm run dev
```
Web Application: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testing

Run backend integration test suite:
```bash
cd backend
.\.venv\Scripts\pytest tests/ -v
```

---

## 📂 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── ai/                # Unified AIProvider, Groq, Gemini & prompts
│   │   ├── core/              # Config, security, logging, deps
│   │   ├── db/                # Models & session (16 core tables)
│   │   ├── routers/           # Auth, Spaces, Projects, Materials, Tutor
│   │   ├── schemas/           # Pydantic v2 schemas
│   │   └── services/          # MaterialService, RetrievalService, TutorService
│   ├── tests/                 # Pytest integration test suites
│   └── requirements.txt
├── frontend/
│   ├── app/                   # Next.js 14 App Router pages
│   ├── components/ui/         # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   └── lib/                   # API client & Auth context
├── project.md                 # Product Requirements Document (PRD)
├── info.md                    # Full Engineering Blueprint
└── prompts.md                 # Step-by-Step Task & Prompt Log
```

---

## 📄 License
MIT
