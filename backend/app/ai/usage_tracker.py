import time
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.ai_usage import AIRequestLog
from app.db.session import async_session_maker


class AIUsageTracker:
    @staticmethod
    async def log_request(
        feature: str,
        provider: str,
        model: str,
        latency_ms: int,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float = 0.0,
        success: bool = True,
        error_message: Optional[str] = None,
    ):
        """Asynchronously log AI usage to database."""
        try:
            async with async_session_maker() as session:
                log_entry = AIRequestLog(
                    user_id=user_id,
                    project_id=project_id,
                    feature=feature,
                    provider=provider,
                    model=model,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost_usd,
                    success=success,
                    error_message=error_message,
                )
                session.add(log_entry)
                await session.commit()
        except Exception as e:
            print(f"Warning: Failed to log AI request usage: {e}")


usage_tracker = AIUsageTracker()
