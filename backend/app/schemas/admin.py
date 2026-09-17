from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AdminPlatformStats(BaseModel):
    total_users: int
    total_spaces: int
    total_projects: int
    total_documents: int
    total_chunks: int
    total_quizzes_taken: int
    total_events: int
    total_ai_requests: int


class AdminUserItem(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime
    spaces_count: int = 0
    projects_count: int = 0


class AdminUserDetail(BaseModel):
    user: AdminUserItem
    spaces: List[Dict[str, Any]]
    recent_events: List[Dict[str, Any]]
    total_ai_requests: int


class AIUsageLogItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    feature: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
    success: bool
    error_message: Optional[str] = None
    created_at: datetime


class AIUsageSummary(BaseModel):
    total_requests: int
    avg_latency_ms: float
    success_rate: float
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    by_feature: Dict[str, int]
    by_provider: Dict[str, int]
    by_model: Dict[str, int]
    recent_logs: List[AIUsageLogItem]


class BackgroundJobItem(BaseModel):
    id: str
    job_id: str
    type: str
    status: str
    attempts: int
    last_error: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class SystemHealthResponse(BaseModel):
    status: str
    database_healthy: bool
    database_latency_ms: float
    pgvector_installed: bool
    redis_healthy: bool
    redis_latency_ms: float
    timestamp: datetime
