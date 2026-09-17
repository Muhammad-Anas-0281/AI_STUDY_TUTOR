import json
import asyncio
from typing import AsyncGenerator, Dict, Any, Type
from pydantic import BaseModel
from groq import AsyncGroq
from app.core.config import settings
from app.ai.provider import AIProvider


class GroqProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model_name = settings.GROQ_MODEL
        self.client = AsyncGroq(api_key=self.api_key) if self.api_key else None

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        if not self.client:
            raise ValueError("Groq API key not configured")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content or ""
        usage = response.usage
        return {
            "content": content,
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "model": self.model_name,
            "provider": "groq",
        }

    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> AsyncGenerator[str, None]:
        if not self.client:
            raise ValueError("Groq API key not configured")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        stream = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield token

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Type[BaseModel],
        temperature: float = 0.2,
    ) -> BaseModel:
        if not self.client:
            raise ValueError("Groq API key not configured")

        system_instruction = (
            f"{system_prompt}\n\nYou MUST respond strictly in valid JSON matching this schema:\n"
            f"{json.dumps(response_schema.model_json_schema())}"
        )

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ]

        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
        )

        raw_json = response.choices[0].message.content or "{}"
        data = json.loads(raw_json)
        return response_schema.model_validate(data)


groq_provider = GroqProvider()
