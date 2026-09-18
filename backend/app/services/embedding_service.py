import numpy as np
from typing import List, Any
from app.core.config import settings

_model = None


def get_embedding_model() -> Any:
    """Load lightweight ONNX embedding model (FastEmbed).
    Memory footprint is only ~12MB (vs >300MB with PyTorch),
    completely eliminating memory limit restarts on 512MB RAM cloud tiers.
    """
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
            print(f"Loading lightweight ONNX embedding model: {settings.EMBEDDING_MODEL}...")
            _model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
        except Exception as e:
            print(f"FastEmbed load error: {e}, falling back to SentenceTransformer...")
            try:
                import torch
                torch.set_num_threads(1)
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer(settings.EMBEDDING_MODEL, device="cpu")
            except Exception as e2:
                print(f"SentenceTransformer fallback error: {e2}")
                _model = None
    return _model


class EmbeddingService:
    def __init__(self):
        pass

    @property
    def model(self) -> Any:
        return get_embedding_model()

    def embed_text(self, text: str) -> List[float]:
        """Generate 384-dim normalized embedding vector for a single query or text."""
        model = self.model
        if model is None:
            # Safe zero-vector fallback in case of catastrophic error
            return [0.0] * 384

        if hasattr(model, "embed"):
            # FastEmbed ONNX (12MB RAM)
            vector = list(model.embed([text]))[0]
            norm = np.linalg.norm(vector)
            if norm > 0:
                vector = vector / norm
            return vector.tolist()
        else:
            # SentenceTransformer fallback
            embedding = model.encode(text, normalize_embeddings=True, show_progress_bar=False)
            return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate 384-dim normalized embedding vectors for a batch of text chunks."""
        if not texts:
            return []
        model = self.model
        if model is None:
            return [[0.0] * 384 for _ in texts]

        if hasattr(model, "embed"):
            # FastEmbed ONNX (12MB RAM)
            results = []
            for vec in model.embed(texts, batch_size=16):
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                results.append(vec.tolist())
            return results
        else:
            # SentenceTransformer fallback
            embeddings = model.encode(texts, batch_size=16, normalize_embeddings=True, show_progress_bar=False)
            return embeddings.tolist()


embedding_service = EmbeddingService()
