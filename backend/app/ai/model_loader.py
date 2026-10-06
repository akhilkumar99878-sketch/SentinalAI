"""
YOLOv11 model loader — loads model once and keeps it in memory.
Gracefully handles missing model file.
"""
import logging
import os
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_model = None
_model_info: dict = {
    "model_loaded": False,
    "model_path": settings.MODEL_PATH,
    "device": "N/A",
    "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
    "classes": [],
    "status": "NOT_LOADED",
}


def load_model():
    """Load YOLOv11 model. Called once at startup."""
    global _model, _model_info

    model_path = Path(settings.MODEL_PATH)
    if not model_path.exists():
        logger.warning(
            "⚠️  YOLOv11 model not found at '%s'. "
            "AI Engine running in OFFLINE mode. "
            "Place best.pt at the configured MODEL_PATH to enable detection.",
            settings.MODEL_PATH,
        )
        _model_info["status"] = "MODEL_NOT_FOUND"
        return

    try:
        from ultralytics import YOLO

        device = settings.DEVICE
        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                device = "cpu"

        logger.info("Loading YOLOv11 from '%s' on device '%s'...", settings.MODEL_PATH, device)
        _model = YOLO(str(model_path))

        # Extract real class names from the model
        classes = list(_model.names.values()) if hasattr(_model, "names") else []

        _model_info.update({
            "model_loaded": True,
            "model_path": str(model_path.resolve()),
            "device": device,
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "classes": classes,
            "status": "READY",
        })
        logger.info("✅ YOLOv11 loaded. Classes: %s", classes)

    except Exception as e:
        logger.error("❌ Failed to load YOLOv11: %s", e)
        _model_info["status"] = f"ERROR: {str(e)}"


def get_model():
    """Return the loaded model or None if not available."""
    return _model


def get_model_info() -> dict:
    """Return model metadata dictionary."""
    return _model_info
