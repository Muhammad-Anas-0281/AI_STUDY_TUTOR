from typing import List
from sentence_transformers import SentenceTransformer
from app.core.config import settings

_model = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"Loading local embedding model: {settings.EMBEDDING_MODEL}...")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


class EmbeddingService:
    def __init__(self):
        self._model = None

    @property
    def model(self) -> SentenceTransformer:
        return get_embedding_model()

    def embed_text(self, text: str) -> List[float]:
        """Generate 384-dim embedding vector for a single query or text."""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate 384-dim embedding vectors for a batch of text chunks."""
        if not texts:
            return []
        embeddings = self.model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
        return embeddings.tolist()


embedding_service = EmbeddingService()
