import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import ensure_indexes, get_client
from app.middleware.security import limiter, SecurityHeadersMiddleware
from app.routers import auth, users, scan, chat, image_analysis, video_analysis, dashboard, admin, content

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger("cyberrakshak")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (env=%s)", settings.APP_NAME, settings.ENV)
    await ensure_indexes()
    yield
    get_client().close()
    logger.info("Shutdown complete")


app = FastAPI(title=settings.APP_NAME, version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests — please slow down."})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(scan.router)
app.include_router(chat.router)
app.include_router(image_analysis.router)
app.include_router(video_analysis.router)
app.include_router(dashboard.router)
app.include_router(admin.router)
app.include_router(content.router)


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "ok", "service": "CyberRakshak AI"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
