from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional, List, Type
from pydantic import BaseModel


class AIProvider(ABC):
    """Abstract interface for LLM providers (Groq, Gemini, etc.)."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        """Generate text completion."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> AsyncGenerator[str, None]:
        """Stream token generator for real-time chat."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Type[BaseModel],
        temperature: float = 0.2,
    ) -> BaseModel:
        """Generate validated Pydantic model response."""
        pass
