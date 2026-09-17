import json
import asyncio
from typing import AsyncGenerator, Dict, Any, Type
from pydantic import BaseModel
import google.generativeai as genai
from app.core.config import settings
from app.ai.provider import AIProvider


class GeminiProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        if self.api_key:
            genai.configure(api_key=self.api_key)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("Gemini API key not configured")

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config={"temperature": temperature, "max_output_tokens": max_tokens}
        )

        response = await asyncio.to_thread(model.generate_content, user_prompt)
        content = response.text if response else ""
        return {
            "content": content,
            "input_tokens": 0,
            "output_tokens": 0,
            "model": self.model_name,
            "provider": "gemini",
        }

    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise ValueError("Gemini API key not configured")

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config={"temperature": temperature, "max_output_tokens": max_tokens}
        )

        response = await asyncio.to_thread(model.generate_content, user_prompt, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Type[BaseModel],
        temperature: float = 0.2,
    ) -> BaseModel:
        if not self.api_key:
            raise ValueError("Gemini API key not configured")

        system_instruction = (
            f"{system_prompt}\n\nYou MUST respond strictly in valid JSON matching this schema:\n"
            f"{json.dumps(response_schema.model_json_schema())}"
        )

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction,
            generation_config={
                "temperature": temperature,
                "response_mime_type": "application/json"
            }
        )

        response = await asyncio.to_thread(model.generate_content, user_prompt)
        raw_json = response.text if response else "{}"
        data = json.loads(raw_json)
        return response_schema.model_validate(data)


gemini_provider = GeminiProvider()
