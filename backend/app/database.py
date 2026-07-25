"""
Async MongoDB connection via Motor. A single client is created at app
startup and reused for the lifetime of the process (see main.py lifespan).
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global client
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if client is not None:
        try:
            client_loop = getattr(client, "_io_loop", None) or getattr(client, "io_loop", None)
            if client_loop is None and hasattr(client, "delegate"):
                client_loop = getattr(client.delegate, "_io_loop", None)
            if client_loop is not None and (client_loop.is_closed() or (current_loop is not None and client_loop != current_loop)):
                client = None
        except Exception:
            client = None

    if client is None:
        client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
    return client


def get_db():
    return get_client()[settings.MONGODB_DB_NAME]


# Convenience collection accessors -------------------------------------------------
def db():
    return get_db()


def users_col():
    return db()["users"]


def conversations_col():
    return db()["conversations"]


def chat_messages_col():
    return db()["chat_messages"]


def security_scans_col():
    return db()["security_scans"]


def ai_image_analysis_col():
    return db()["ai_image_analysis"]


def ai_video_analysis_col():
    return db()["ai_video_analysis"]


def safety_assessments_col():
    return db()["cyber_safety_assessments"]


def reports_col():
    return db()["security_reports"]


def achievements_col():
    return db()["achievements"]


def notifications_col():
    return db()["notifications"]


def activity_col():
    return db()["user_activity"]


def admin_logs_col():
    return db()["admin_logs"]


async def ensure_indexes():
    """Create indexes needed for correctness/performance. Called on startup."""
    try:
        await users_col().create_index("email", unique=True)
        await users_col().create_index("username", unique=True)
        await conversations_col().create_index("user_id")
        await chat_messages_col().create_index("conversation_id")
        await security_scans_col().create_index("user_id")
        await ai_image_analysis_col().create_index("user_id")
        await ai_video_analysis_col().create_index("user_id")
    except Exception as e:
        import logging
        logging.getLogger("cyberrakshak").warning("MongoDB index initialization skipped (offline mode): %s", e)
