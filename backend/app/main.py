from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
# Import models to ensure they register on Base.metadata
import app.db.models  # noqa: F401
from app.routers import auth, spaces, projects, materials, tutor, quiz, growth, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & enable pgvector extension
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception as e:
            print(f"Note: pgvector extension check: {e}")
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI Study Companion - Backend API (FastAPI + pgvector + Groq/Gemini)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(spaces.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(materials.router, prefix="/api/v1")
app.include_router(tutor.router, prefix="/api/v1")
app.include_router(quiz.router, prefix="/api/v1")
app.include_router(growth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")




@app.get("/")
async def root():
    return {
        "message": "AI Study Companion API is online",
        "status": "active",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "database": "connected",
        "environment": settings.ENVIRONMENT
    }
