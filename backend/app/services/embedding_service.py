from typing import List, Any
from app.core.config import settings

_model = None


def get_embedding_model() -> Any:
    """Lazy-load SentenceTransformer only when actually needed.
    Keeps Uvicorn startup memory < 80MB on 512MB RAM cloud tiers.
    """
    global _model
    if _model is None:
        import torch
        # Constrain PyTorch thread count to 1 to avoid multi-threading memory spikes on free tier instances
        torch.set_num_threads(1)
        from sentence_transformers import SentenceTransformer
        print(f"Loading local embedding model: {settings.EMBEDDING_MODEL} (CPU mode)...")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL, device="cpu")
    return _model


class EmbeddingService:
    def __init__(self):
        pass

    @property
    def model(self) -> Any:
        return get_embedding_model()

    def embed_text(self, text: str) -> List[float]:
        """Generate 384-dim embedding vector for a single query or text."""
        embedding = self.model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate 384-dim embedding vectors for a batch of text chunks."""
        if not texts:
            return []
        embeddings = self.model.encode(texts, batch_size=16, normalize_embeddings=True, show_progress_bar=False)
        return embeddings.tolist()


embedding_service = EmbeddingService()
