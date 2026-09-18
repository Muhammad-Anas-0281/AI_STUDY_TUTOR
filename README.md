# 🧠 AI Study Companion (AI Study Tutor)

**AI-Powered Personalized Learning Platform with Grounded RAG, Adaptive Mastery Assessment & Growth Analytics**

> B.Tech Computer Science Project | Under Academic Guidance | Academic Year 2025–2026

---

## 📌 Overview

The **AI Study Companion** is a production-ready, full-stack AI learning platform designed to replace generic chatbots with a grounded, measurable, and curriculum-driven study experience. Built on a $0 free-tier architecture, the platform ingests academic course materials (PDFs), indexes them into dense vector spaces, and delivers:

1. **Grounded AI Professor (RAG)**: Conversational tutor streaming with line/page citations, active recall hooks, and zero hallucinations (strict refusal on unverified content).
2. **Adaptive Quiz Assessment**: Dynamic generation of multiple-choice and open-ended conceptual questions targeting a student's weakest knowledge frontiers.
3. **AI Rubric Grading**: Pedagogical answer evaluation with nuanced feedback and Bayesian moving-average concept mastery updates.
4. **Growth & Analytics Engine**: Visual mastery progression charts, weakness diagnostics, and autonomous study action recommendations.
5. **Real-time Observability & Admin Console**: Token telemetry, cost tracking, system latency checks, and admin role security.

---

## 🏗️ System Architecture

```
                      ┌─────────────────────────────────────────┐
                      │        Next.js 14 Web Frontend          │
                      │  (Tailwind CSS + shadcn/ui + Recharts)  │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS / SSE (EventStream)
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │           FastAPI Async Backend         │
                      │       (Pydantic v2 + SQLAlchemy 2.0)    │
                      └───────┬─────────────┬─────────────┬─────┘
                              │             │             │
                 ┌────────────▼──┐   ┌──────▼──────┐   ┌──▼───────────┐
                 │  Tutor Stream │   │  Assessment │   │ Growth Recs  │
                 │  (Groq LLaMA) │   │  (Gemini)   │   │  & Analytics │
                 └───────────────┘   └─────────────┘   └──────────────┘
                              │             │                 │
                              ▼             ▼                 ▼
          ┌─────────────────────────────────────────────────────────────┐
          │                  Supabase PostgreSQL + pgvector              │
          │      (Spaces, Projects, Documents, Chunks, Embeddings,      │
          │       Concepts, Mastery, Quizzes, Events, AI Usage Logs)     │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
                                         ▼
          ┌─────────────────────────────────────────────────────────────┐
          │                   Upstash Redis (Cache / Queue)             │
          │             (Task Coordination, Caching, Health Check)      │
          └─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Core AI Engines & Subsystems

| Subsystem | Role | Primary AI Engine | Key Responsibility |
|---|---|---|---|
| 🎓 **Tutor RAG Engine** | Socratic Academic Professor | Groq (`openai/gpt-oss-120b` / `llama-3.3-70b`) | Multi-tier academic responses, page-level citations, active recall inquiry, hallucination refusal |
| 📝 **Adaptive Quiz Engine** | Diagnostic Examiner | Google Gemini (`gemini-2.0-flash`) | Context-grounded MCQ and open-ended questions targeting lowest mastery concepts |
| ⚖️ **AI Rubric Grader** | Pedagogical Evaluator | Google Gemini (`gemini-2.0-flash`) | Multi-criteria grading of open-ended answers, identifying missed nuances and misconceptions |
| 📈 **Bayesian Mastery Engine** | Knowledge State Tracker | Deterministic Exponential Moving Average | Updates concept proficiency (0–100%) and tracks mastery statuses (`mastered`, `practicing`, `struggling`) |
| 🧭 **Recommendation Engine** | Academic Advisor | Google Gemini / Groq Hybrid | Autonomous study prescriptions based on quiz mistake patterns and curriculum gaps |

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** (App Router, Server & Client Components)
- **TypeScript** + **Tailwind CSS**
- **shadcn/ui** + **Radix UI** primitives
- **Recharts** (Interactive Area, Line & Bar Charts)
- **React-Markdown** + **remark-gfm** (Rich LaTeX & Markdown formatting)
- **Lucide React** (Modern iconography)

### Backend
- **FastAPI** (High-performance async ASGI web framework)
- **SQLAlchemy 2.0** (Async ORM with `asyncpg`)
- **Pydantic v2** (Strict schema validation & serialization)
- **PyMuPDF (`fitz`)** (Document parsing and semantic chunking)
- **Sentence-Transformers** (`all-MiniLM-L6-v2`, 384-dimensional dense embeddings)
- **python-jose** + **passlib (bcrypt)** (Stateless JWT security)
- **Server-Sent Events (SSE)** (Real-time LLM token streaming)

### Database & Storage
- **PostgreSQL 15+** (Relational user, project, quiz, and mastery records)
- **pgvector** (Cosine distance vector similarity search for RAG)
- **Upstash Redis** (Distributed caching, task broker connection, and system health telemetry)

### Infrastructure & Deployment
- **Render** / **Railway** (Backend web service container)
- **Vercel** / **Render** (Frontend Next.js edge deployment)
- **Supabase Cloud** (Managed Postgres + pgvector storage)
- **Upstash Cloud** (Serverless Redis instance)

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- Supabase account with `pgvector` enabled
- Upstash Redis database URL
- Groq API Key & Google Gemini API Key

---

### 1. Clone the Repository

```bash
git clone https://github.com/Muhammad-Anas-0281/AI_STUDY_TUTOR.git
cd AI_STUDY_TUTOR
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your database and API credentials

# Run FastAPI development server
uvicorn main:app --reload --port 8000
```

The backend API will be available at: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

---

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment variables (create .env.local)
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Run development server
npm run dev
```

The frontend application will be running at: `http://localhost:3000`.

---

## 📁 Project Structure

```
AI_STUDY_TUTOR/
├── backend/
│   ├── main.py                     # FastAPI application entrypoint & middleware
│   ├── requirements.txt            # Python dependencies
│   ├── app/
│   │   ├── ai/
│   │   │   ├── guardrails.py       # Prompt injection screening & sanitization
│   │   │   ├── providers/          # Groq and Gemini AI provider clients
│   │   │   └── prompts/            # Pedagogical system prompts
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic environment configuration
│   │   │   ├── deps.py             # FastAPI dependency injections & auth guards
│   │   │   └── security.py         # Password hashing & JWT token generators
│   │   ├── db/
│   │   │   ├── session.py          # SQLAlchemy async engine & sessionmaker
│   │   │   └── models/             # Database ORM models (User, Space, Project, Material, Concept, Mastery, etc.)
│   │   ├── routers/
│   │   │   ├── auth.py             # User registration, login, and profile
│   │   │   ├── spaces.py           # Spaces CRUD
│   │   │   ├── projects.py         # Project workspaces CRUD
│   │   │   ├── materials.py        # PDF upload, chunking & vectorization
│   │   │   ├── tutor.py            # RAG streaming chat & history endpoints
│   │   │   ├── quiz.py             # Adaptive quiz generation & rubric submission
│   │   │   ├── growth.py           # Growth metrics, mastery trends & activity stream
│   │   │   └── admin.py            # Admin dashboard, AI telemetry & system health
│   │   ├── schemas/                # Pydantic request/response validation models
│   │   └── services/               # Core business logic services
│   └── tests/                      # Automated test suites
├── frontend/
│   ├── app/
│   │   ├── layout.tsx              # Root HTML wrapper and AuthProvider
│   │   ├── page.tsx                # Marketing landing page
│   │   ├── login/page.tsx          # User sign-in page
│   │   ├── register/page.tsx       # User sign-up page
│   │   ├── spaces/                 # Spaces & projects listing
│   │   │   └── [spaceId]/projects/[projectId]/
│   │   │       ├── tutor/page.tsx      # Markdown-rendered AI Tutor chat
│   │   │       ├── quiz/page.tsx       # Adaptive quiz runner with visual score charts
│   │   │       ├── growth/page.tsx     # Concept mastery gauges, trends & recommendations
│   │   │       └── materials/page.tsx  # Document upload & ingestion status
│   │   └── admin/page.tsx          # Real-time admin observability dashboard
│   ├── components/
│   │   ├── Navbar.tsx              # Top navigation bar with role-gated Admin link
│   │   └── ui/                     # Reusable UI component library (shadcn/ui)
│   ├── lib/
│   │   ├── api.ts                  # Axios/Fetch API client wrapper
│   │   └── auth-context.tsx        # React client-side authentication provider
│   └── package.json
├── docs/                           # Architectural and evaluation documentation
├── prompts.md                      # Audit log of developer prompts & implementation steps
└── README.md
```

---

## 🔑 Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `PROJECT_NAME` | Name of the application | `AI Study Companion` |
| `ENVIRONMENT` | Runtime environment mode | `production` / `development` |
| `SECRET_KEY` | Secret key used for signing JWT tokens | Random 64-char string |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan in minutes | `1440` (24 hours) |
| `DATABASE_URL` | PostgreSQL + pgvector async connection URL | `postgresql+asyncpg://...` |
| `REDIS_URL` | Upstash Redis connection string | `rediss://default:...@host:6379` |
| `GROQ_API_KEY` | Groq API Key for Tutor SSE streaming | `gsk_...` |
| `GROQ_MODEL` | Groq LLM model name | `openai/gpt-oss-120b` or `llama-3.3-70b-versatile` |
| `GEMINI_API_KEY` | Google Gemini API Key for quizzes & grading | `AIza...` |
| `GEMINI_MODEL` | Google Gemini model name | `gemini-2.0-flash` or `gemini-1.5-flash` |
| `EMBEDDING_MODEL` | HuggingFace embedding model identifier | `sentence-transformers/all-MiniLM-L6-v2` |
| `EMBEDDING_DIMENSION` | Dimension of the vector embeddings | `384` |
| `STORAGE_LOCAL_DIR` | Local directory for document uploads | `./uploads` |
| `BACKEND_CORS_ORIGINS` | JSON list of allowed CORS client origins | `["https://your-frontend.onrender.com"]` |

### Frontend Configuration (`frontend/.env.local`)

| Variable | Description | Example / Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Full URL to the Backend API v1 endpoint | `https://your-backend.onrender.com/api/v1` |

---

## 🔐 Security & Reliability Features

- **Stateless JWT Authentication**: Secure password hashing with bcrypt and token invalidation on logout.
- **Strict Tenant & Project Isolation**: All vector queries, documents, quiz results, and chat threads are enforced with `user_id` and `project_id` foreign key constraints.
- **Input Guardrails & Sanitization**: Pre-retrieval screening against prompt injections and malicious instruction overrides.
- **Zero-Hallucination Honesty**: System prompt architecture mandates automatic refusal when retrieved materials lack necessary evidence.
- **Provider Failover Resiliency**: Automated fallback routing between Groq and Gemini on API rate limits or service disruptions.
- **Hardcoded Admin Access Gate**: Admin telemetry dashboard is strictly restricted to `smdanas0281@gmail.com`.

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new student account |
| `POST` | `/api/v1/auth/login` | Authenticate student and issue JWT |
| `GET` | `/api/v1/spaces/` | List all spaces owned by the student |
| `POST` | `/api/v1/spaces/{id}/projects` | Create a new project workspace |
| `POST` | `/api/v1/projects/{id}/materials/upload` | Upload PDF and trigger chunking & embedding |
| `POST` | `/api/v1/projects/{id}/tutor/ask` | Send question and stream grounded response (SSE) |
| `GET` | `/api/v1/projects/{id}/tutor/sessions` | Retrieve past tutor chat sessions |
| `POST` | `/api/v1/projects/{id}/quiz/generate` | Generate adaptive quiz based on lowest mastery |
| `POST` | `/api/v1/projects/{id}/quiz/{id}/submit` | Submit answers for AI rubric grading |
| `GET` | `/api/v1/projects/{id}/growth` | Get growth metrics, trendline & concept mastery |
| `POST` | `/api/v1/projects/{id}/recommendations/generate` | Generate targeted study recommendations |
| `GET` | `/api/v1/admin/stats` | System-wide statistics (Admin only) |
| `GET` | `/api/v1/admin/system-health` | Live PostgreSQL, pgvector & Redis health latency check |

---

## 🌐 Deployment Guide (Render)

### Step 1: Deploy Backend on Render (Web Service)
1. In Render, select **New Web Service** and connect your GitHub repository.
2. Configure settings:
   - **Name**: `ai-study-tutor-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add the Backend Environment Variables from the table above in Render's **Environment** tab.

### Step 2: Deploy Frontend on Render (Web Service)
1. Select **New Web Service** (or Static Site) for the frontend.
2. Configure settings:
   - **Name**: `ai-study-tutor-frontend`
   - **Root Directory**: `frontend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
3. Add the Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://ai-study-tutor-backend.onrender.com/api/v1`
4. Update `BACKEND_CORS_ORIGINS` on the backend service to include the frontend Render URL.
