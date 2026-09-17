from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class ChunkResponse(BaseModel):
    id: str
    document_id: str
    project_id: str
    page_number: int
    chunk_index: int
    content: str
    metadata_json: Dict[str, Any] = {}
    similarity: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    status: str  # queued, processing, ready, failed
    page_count: int
    error_message: Optional[str] = None
    created_at: datetime
    chunks_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    chunks: List[ChunkResponse] = []


class SearchQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page_number: int
    content: str
    similarity: float
