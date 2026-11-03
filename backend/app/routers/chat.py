import logging
import urllib.parse
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.auth.dependencies import get_current_user
from app.database import conversations_col, chat_messages_col
from app.models.scan import ChatMessageIn, ConversationRename
from app.services.ollama_service import stream_chat, is_ollama_available
from app.services.groq_service import is_groq_available

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger("cyberrakshak.chat")


@router.get("/status")
async def ollama_status():
    groq_available = await is_groq_available()
    ollama_available = await is_ollama_available()
    provider = "groq" if groq_available else "ollama" if ollama_available else None
    return {
        "ai_available": provider is not None,
        "provider": provider,
        "ollama_available": ollama_available,
    }


@router.get("/tts")
async def text_to_speech(text: str, lang: str):
    """
    Proxies Google Translate TTS to avoid CORS / NotSupportedError in the frontend browser.
    """
    lang_base = lang.split("-")[0].lower()
    quoted_text = urllib.parse.quote(text)
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl={lang_base}&client=tw-ob&q={quoted_text}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
    }
    
    async def stream_audio():
        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream("GET", url, headers=headers) as r:
                r.raise_for_status()
                async for chunk in r.aiter_bytes():
                    yield chunk

    try:
        return StreamingResponse(stream_audio(), media_type="audio/mpeg")
    except Exception as e:
        logger.error("TTS proxy failed: %s", str(e))
        raise HTTPException(500, "Failed to generate speech")


@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    cursor = conversations_col().find({"user_id": str(user["_id"])}).sort("updated_at", -1)
    items = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        items.append(c)
    return {"items": items}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    convo = await conversations_col().find_one({"_id": ObjectId(conversation_id), "user_id": str(user["_id"])})
    if not convo:
        raise HTTPException(404, "Conversation not found")
    cursor = chat_messages_col().find({"conversation_id": conversation_id}).sort("created_at", 1)
    items = []
    async for m in cursor:
        m["_id"] = str(m["_id"])
        items.append(m)
    return {"items": items}


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(conversation_id: str, payload: ConversationRename, user: dict = Depends(get_current_user)):
    result = await conversations_col().update_one(
        {"_id": ObjectId(conversation_id), "user_id": str(user["_id"])},
        {"$set": {"title": payload.title}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Conversation not found")
    return {"message": "Renamed"}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    await conversations_col().delete_one({"_id": ObjectId(conversation_id), "user_id": str(user["_id"])})
    await chat_messages_col().delete_many({"conversation_id": conversation_id})
    return {"message": "Deleted"}


@router.post("/send")
async def send_message(payload: ChatMessageIn, user: dict = Depends(get_current_user)):
    """
    Streams the assistant's reply as Server-Sent Events. The frontend consumes
    this with EventSource / fetch+ReadableStream for a real-time typing effect.
    """
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)

    conversation_id = payload.conversation_id or str(ObjectId())
    history = []

    try:
        if payload.conversation_id:
            convo = await conversations_col().find_one({"_id": ObjectId(payload.conversation_id), "user_id": user_id})
            if convo:
                history_cursor = chat_messages_col().find({"conversation_id": payload.conversation_id}).sort("created_at", 1)
                history = [{"role": m["role"], "content": m["content"]} async for m in history_cursor]
        else:
            title = payload.message[:48] + ("…" if len(payload.message) > 48 else "")
            result = await conversations_col().insert_one({
                "user_id": user_id, "title": title, "created_at": now, "updated_at": now,
            })
            conversation_id = str(result.inserted_id)

        await chat_messages_col().insert_one({
            "conversation_id": conversation_id, "role": "user", "content": payload.message, "created_at": now,
        })
        if payload.conversation_id:
            await conversations_col().update_one({"_id": ObjectId(conversation_id)}, {"$set": {"updated_at": now}})
    except Exception as e:
        logger.warning("Chat history DB persistence skipped: %s", e)

    async def event_generator():
        full_reply = ""
        yield f"event: conversation\ndata: {conversation_id}\n\n"
        try:
            async for chunk in stream_chat(history, payload.message, language=payload.language):
                full_reply += chunk
                safe_chunk = chunk.replace("\n", "\\n")
                yield f"event: token\ndata: {safe_chunk}\n\n"
        except Exception:
            logger.exception("Chat stream failed for conversation %s", conversation_id)
            if not full_reply.strip():
                fallback = "Sorry, something went wrong generating a response. Please try again."
                yield f"event: token\ndata: {fallback}\n\n"
                full_reply = fallback
            yield "event: error\ndata: stream_failed\n\n"

        if full_reply.strip():
            try:
                await chat_messages_col().insert_one({
                    "conversation_id": conversation_id, "role": "assistant", "content": full_reply,
                    "created_at": datetime.now(timezone.utc),
                })
            except Exception:
                pass
        yield "event: done\ndata: end\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
