"""
Dedicated Ollama integration module. All Ollama calls go through this file —
routers never talk to Ollama directly. This keeps model selection, the
system prompt, streaming, caching, and error handling in one modular,
swappable place (per the brief's "modular so different locally hosted
models can be configured through backend environment variables"
requirement).

Root causes fixed here (see PR description / README for details):
  1. Inconsistent answers  -> Ollama was called with no `options`, so it used
     its default temperature (~0.8) and no seed. Every call was genuinely
     random. Fixed by sending a low, configurable temperature + a fixed seed.
  2. Bad formatting        -> the system prompt never told the model to use
     Markdown consistently. Fixed with explicit formatting rules.
  3. Multilingual support  -> the `language` field the frontend/API already
     modelled was never read or forwarded to the model, so the LLM only ever
     guessed the reply language from the raw prompt. Fixed by building a
     language directive into the system prompt, and (for non-auto languages)
     verifying the output is actually in that language with `langdetect`,
     retrying once with a firmer instruction if not.
  4. Performance            -> duplicate/identical prompts (e.g. the Quick
     Prompt buttons) now hit a small in-memory TTL cache, and concurrent
     identical requests are coalesced instead of hitting Ollama twice.
"""
import asyncio
import hashlib
import json
import logging
import time
from typing import AsyncGenerator, Optional

import httpx

from app.config import settings

logger = logging.getLogger("cyberrakshak.ollama")

# ---------------------------------------------------------------------------
# Supported languages
# ---------------------------------------------------------------------------
# code (matches the frontend's <select> values) -> (English name, native
# name, ISO 639-1 code used by langdetect for verification)
SUPPORTED_LANGUAGES: dict[str, tuple[str, str, str]] = {
    "en-US": ("English", "English", "en"),
    "hi-IN": ("Hindi", "हिन्दी", "hi"),
    "te-IN": ("Telugu", "తెలుగు", "te"),
    "ta-IN": ("Tamil", "தமிழ்", "ta"),
    "kn-IN": ("Kannada", "ಕನ್ನಡ", "kn"),
    "ml-IN": ("Malayalam", "മലയാളം", "ml"),
    "mr-IN": ("Marathi", "मराठी", "mr"),
    "bn-IN": ("Bengali", "বাংলা", "bn"),
    "gu-IN": ("Gujarati", "ગુજરાતી", "gu"),
    "pa-IN": ("Punjabi", "ਪੰਜਾਬੀ", "pa"),
}

BASE_SYSTEM_PROMPT = """You are CyberRakshak AI Assistant, a friendly cybersecurity assistant. Answer the user's question simply and directly. Keep your reply concise and use markdown formatting to organize your response."""


def _language_directive(language_code: Optional[str]) -> str:
    if not language_code or language_code == "auto":
        return (
            "\nLanguage: Reply in the same language (or natural language-mix, e.g. Hinglish) that "
            "the user's latest message is written in. Match their style naturally."
        )
    meta = SUPPORTED_LANGUAGES.get(language_code)
    if not meta:
        # Unknown code from an older client build — degrade gracefully instead of failing.
        logger.warning("Unknown language code %r; falling back to auto-detect", language_code)
        return _language_directive("auto")
    english_name, native_name, _ = meta
    return (
        f"\nLanguage: The user has explicitly selected \"{english_name}\" ({native_name}) as the "
        f"conversation language. You MUST write your ENTIRE reply in {english_name} ({native_name}), "
        f"including headings and list items, regardless of what language the user typed in. Do not "
        f"mix in English unless a term has no natural {english_name} equivalent (e.g. \"OTP\", \"URL\")."
    )


def _build_system_prompt(language_code: Optional[str]) -> str:
    return BASE_SYSTEM_PROMPT + _language_directive(language_code)


class OllamaUnavailableError(Exception):
    pass


async def is_ollama_available() -> bool:
    if not settings.OLLAMA_ENABLED:
        return False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            return resp.status_code == 200
    except Exception as e:
        logger.warning("Ollama availability check failed: %s", type(e).__name__)
        return False


async def get_working_model(requested_model: Optional[str] = None) -> str:
    target = requested_model or settings.OLLAMA_MODEL
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") or m.get("model") for m in resp.json().get("models", [])]
                if target in models:
                    return target
                for m in models:
                    if m and (m.startswith(target) or target.startswith(m.split(":")[0])):
                        return m
                if models:
                    return models[0]
    except Exception:
        pass
    return target


def _build_messages(history: list[dict], user_message: str, language_code: Optional[str]) -> list[dict]:
    messages = [{"role": "system", "content": _build_system_prompt(language_code)}]
    for m in history[-6:]:  # keep recent context only, bounded window
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


def _generation_options() -> dict:
    options = {
        "temperature": settings.OLLAMA_TEMPERATURE,
        "top_p": settings.OLLAMA_TOP_P,
        "num_ctx": settings.OLLAMA_NUM_CTX,
        "num_predict": settings.OLLAMA_NUM_PREDICT,
        "repeat_penalty": 1.1,
    }
    if settings.OLLAMA_SEED is not None and settings.OLLAMA_SEED >= 0:
        options["seed"] = settings.OLLAMA_SEED
    return options


# ---------------------------------------------------------------------------
# Response cache + in-flight request coalescing
# ---------------------------------------------------------------------------
# Only used for the common "fresh conversation, no history" case (e.g. Quick
# Prompt buttons, or someone re-asking the same first question). This keeps
# the cache key simple/safe and avoids ever caching multi-turn context.
_response_cache: dict[str, tuple[float, str]] = {}
_inflight_locks: dict[str, asyncio.Lock] = {}


def _cache_key(model: str, language_code: Optional[str], user_message: str) -> str:
    raw = f"{model}|{language_code or 'auto'}|{user_message.strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[str]:
    if not settings.CHAT_CACHE_ENABLED:
        return None
    entry = _response_cache.get(key)
    if not entry:
        return None
    stored_at, text = entry
    if time.time() - stored_at > settings.CHAT_CACHE_TTL_SECONDS:
        _response_cache.pop(key, None)
        return None
    return text


def _cache_set(key: str, text: str) -> None:
    if not settings.CHAT_CACHE_ENABLED:
        return
    if len(_response_cache) >= settings.CHAT_CACHE_MAX_ENTRIES:
        # Evict the oldest entry (simple FIFO eviction is fine for this size).
        oldest_key = min(_response_cache, key=lambda k: _response_cache[k][0])
        _response_cache.pop(oldest_key, None)
    _response_cache[key] = (time.time(), text)


def _detected_language_matches(text: str, expected_iso: str) -> bool:
    """Best-effort check using langdetect. Never raises — on any failure we
    assume the language is fine so we don't loop retrying forever."""
    try:
        from langdetect import DetectorFactory, detect

        DetectorFactory.seed = 0  # deterministic detection
        sample = text.strip()
        if len(sample) < 8:
            return True  # too short to reliably detect; don't punish short replies
        return detect(sample) == expected_iso
    except Exception as e:  # langdetect raises LangDetectException on ambiguous input
        logger.debug("Language detection skipped (%s)", type(e).__name__)
        return True


async def _call_ollama_once(messages: list[dict], model_name: str) -> str:
    """Non-streaming call — returns the full response text."""
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "options": _generation_options(),
        "keep_alive": "30m",
    }
    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        resp = await client.post(f"{settings.OLLAMA_HOST}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")


async def _stream_ollama(messages: list[dict], model_name: str) -> AsyncGenerator[str, None]:
    """True token streaming — used for the common auto/English case where we
    don't need to buffer the whole reply to verify its language."""
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True,
        "options": _generation_options(),
        "keep_alive": "30m",
    }
    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        async with client.stream("POST", f"{settings.OLLAMA_HOST}/api/chat", json=payload) as resp:
            if resp.status_code != 200:
                logger.error("Ollama returned status %s", resp.status_code)
                raise OllamaUnavailableError(f"status {resp.status_code}")
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break


def _chunk_text(text: str, chunk_size: int = 64) -> AsyncGenerator[str, None]:
    """Splits an already-complete response into small pieces so the client
    still gets an incremental "typing" effect even though we generated the
    full answer server-side (needed for the language-verification path)."""

    async def _gen():
        for i in range(0, len(text), chunk_size):
            yield text[i:i + chunk_size]
            await asyncio.sleep(0.005)

    return _gen()


async def stream_chat(
    history: list[dict],
    user_message: str,
    language: str = "auto",
    model: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Streams response tokens as they're generated (or, for verified-language
    replies, as simulated incremental chunks). Yields plain text chunks
    (caller wraps them as SSE). Falls back to a clearly-labeled demo response
    if Ollama is unreachable.
    """
    model_name = await get_working_model(model)
    language_code = language or "auto"
    is_new_conversation = len(history) == 0

    if not settings.OLLAMA_ENABLED:
        async for chunk in _demo_fallback_stream(user_message, language_code):
            yield chunk
        return

    # --- Cache lookup (fresh conversations only) ---------------------------
    cache_key = _cache_key(model_name, language_code, user_message) if is_new_conversation else None
    if cache_key:
        cached = _cache_get(cache_key)
        if cached is not None:
            logger.info("Chat cache hit")
            async for chunk in _chunk_text(cached):
                yield chunk
            return

    # --- Coalesce concurrent identical requests -----------------------------
    lock = None
    if cache_key:
        lock = _inflight_locks.setdefault(cache_key, asyncio.Lock())
        await lock.acquire()
        # Someone else may have finished populating the cache while we waited.
        cached = _cache_get(cache_key)
        if cached is not None:
            lock.release()
            _inflight_locks.pop(cache_key, None)
            async for chunk in _chunk_text(cached):
                yield chunk
            return

    full_reply = ""
    try:
        messages = _build_messages(history, user_message, language_code)
        needs_verification = (
            settings.CHAT_LANGUAGE_VERIFICATION_ENABLED
            and language_code != "auto"
            and language_code in SUPPORTED_LANGUAGES
        )

        if not needs_verification:
            # Fast path: real token-by-token streaming straight to the client.
            try:
                async for chunk in _stream_ollama(messages, model_name):
                    full_reply += chunk
                    yield chunk
            except (httpx.ConnectError, httpx.TimeoutException, OllamaUnavailableError) as e:
                logger.warning("Ollama unreachable (%s) — falling back to demo response", type(e).__name__)
                async for chunk in _demo_fallback_stream(user_message, language_code):
                    yield chunk
                return
        else:
            # Verification path: generate fully, check the language, retry
            # once with a firmer instruction if it's wrong, THEN simulate
            # streaming so the UI still feels responsive.
            try:
                full_reply = await _call_ollama_once(messages, model_name)
                _, _, expected_iso = SUPPORTED_LANGUAGES[language_code]
                if not _detected_language_matches(full_reply, expected_iso):
                    logger.info("Reply language mismatch for %s — retrying once", language_code)
                    retry_messages = messages + [
                        {"role": "assistant", "content": full_reply},
                        {
                            "role": "user",
                            "content": (
                                f"That reply was not fully in {SUPPORTED_LANGUAGES[language_code][0]}. "
                                f"Rewrite your entire previous answer again, this time only in "
                                f"{SUPPORTED_LANGUAGES[language_code][0]} "
                                f"({SUPPORTED_LANGUAGES[language_code][1]})."
                            ),
                        },
                    ]
                    full_reply = await _call_ollama_once(retry_messages, model_name)
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                logger.warning("Ollama unreachable (%s) — falling back to demo response", type(e).__name__)
                async for chunk in _demo_fallback_stream(user_message, language_code):
                    yield chunk
                return
            except httpx.HTTPStatusError as e:
                logger.error("Ollama returned status %s", e.response.status_code)
                async for chunk in _demo_fallback_stream(user_message, language_code):
                    yield chunk
                return

            async for chunk in _chunk_text(full_reply):
                yield chunk

        if cache_key and full_reply.strip():
            _cache_set(cache_key, full_reply)

    except Exception:
        logger.exception("Unexpected Ollama error")
        yield "\n\n[CyberRakshak Assistant] Something went wrong reaching the AI engine. Please try again."
    finally:
        if lock is not None:
            lock.release()
            _inflight_locks.pop(cache_key, None)


# ---------------------------------------------------------------------------
# Offline demo fallback
# ---------------------------------------------------------------------------
_DEMO_FALLBACK_TEXT_EN = (
    "**[Demo Mode — Ollama is not running locally]**\n\n"
    "I can't reach the local AI engine right now, so here's a general safety note instead of a "
    "live AI-generated answer:\n\n"
    "- Never share OTPs or passwords with anyone.\n"
    "- Verify suspicious links using the Threat Scanner.\n"
    "- If you've already been affected, check the Incident Response Guide for step-by-step help.\n\n"
    "*(Your message was: \"{msg}\")*\n\n"
    "To enable real AI responses, install Ollama and run `ollama pull {model}`, then restart the "
    "backend."
)


async def _demo_fallback_stream(user_message: str, language_code: str) -> AsyncGenerator[str, None]:
    """Clearly-labeled fallback used when Ollama isn't running locally, so the
    product still demos end-to-end (per Demo Mode requirement). Demo mode
    itself is English-only (translating safety-critical guidance without a
    live model risks incorrect translations), but we say so explicitly so the
    language switcher doesn't look broken/ignored."""
    text = _DEMO_FALLBACK_TEXT_EN.format(msg=user_message[:120], model=settings.OLLAMA_MODEL)
    if language_code != "auto" and language_code != "en-US" and language_code in SUPPORTED_LANGUAGES:
        native_name = SUPPORTED_LANGUAGES[language_code][1]
        text += (
            f"\n\n*(Demo mode currently only available in English. Connect Ollama for full "
            f"{native_name} responses.)*"
        )
    for chunk in text.split(" "):
        yield chunk + " "
        await asyncio.sleep(0.05)
