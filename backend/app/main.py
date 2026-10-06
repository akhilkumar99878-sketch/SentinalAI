"""
FastAPI application entry point — SentinelAI backend.
"""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database.database import init_db
from app.ai.model_loader import load_model

# ── Routers ────────────────────────────────────────────────────────────────
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.resources import camera_router, worker_router, location_router
from app.routers.detection import router as detection_router
from app.routers.incidents import violation_router, incident_router
from app.routers.analytics import analytics_router, reports_router
from app.routers.notifications import notif_router, ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SentinelAI",
    description="AI-Driven Industrial Safety Monitoring Framework — PPE Compliance Detection, Incident Reporting, and Safety Analytics",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include routers ────────────────────────────────────────────────────────
for r in [auth_router, users_router, camera_router, worker_router, location_router,
          detection_router, violation_router, incident_router,
          analytics_router, reports_router, notif_router, ws_router]:
    app.include_router(r)


# ── Startup ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Create storage directories
    for d in [settings.UPLOAD_DIR, settings.STORAGE_DIR, settings.INCIDENTS_DIR]:
        os.makedirs(d, exist_ok=True)

    # Init DB + seed admin
    await init_db()

    # Load YOLOv11 model (graceful if missing)
    load_model()

    logger.info("🚀 SentinelAI backend started on http://localhost:8081")
    logger.info("📖 API docs: http://localhost:8081/docs")


# ── Static files ───────────────────────────────────────────────────────────
@app.on_event("startup")
async def mount_static():
    try:
        app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR), name="storage")
    except Exception:
        pass  # directory may not exist yet on very first run


# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    from app.ai.model_loader import get_model_info
    return {"status": "ok", "version": "1.0.0", "ai": get_model_info()["status"]}


# ── Global error handler ───────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
