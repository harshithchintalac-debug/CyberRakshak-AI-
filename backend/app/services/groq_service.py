import logging
from typing import AsyncGenerator

import httpx
from groq import APIError, AsyncGroq

from app.config import settings

logger = logging.getLogger("cyberrakshak.groq")


async def is_groq_available() -> bool:
    if not settings.GROQ_API_KEY:
        return False

    try:
        async with AsyncGroq(api_key=settings.GROQ_API_KEY, timeout=5.0) as client:
            models = await client.models.list()
        return any(model.id == settings.GROQ_MODEL for model in models.data)
    except (APIError, httpx.HTTPError) as exc:
        logger.warning("Groq availability check failed (%s)", type(exc).__name__)
        return False


async def complete_groq_chat(messages: list[dict], model: str) -> str:
    async with AsyncGroq(
        api_key=settings.GROQ_API_KEY,
        timeout=settings.GROQ_TIMEOUT_SECONDS,
    ) as client:
        completion = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.5,
            max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS,
        )
    return completion.choices[0].message.content or ""


async def stream_groq_chat(messages: list[dict], model: str) -> AsyncGenerator[str, None]:
    async with AsyncGroq(
        api_key=settings.GROQ_API_KEY,
        timeout=settings.GROQ_TIMEOUT_SECONDS,
    ) as client:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.5,
            max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            content = chunk.choices[0].delta.content
            if content:
                yield content
