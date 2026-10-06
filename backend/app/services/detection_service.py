"""
Detection service — orchestrates image/video analysis pipeline:
  upload → validate → OpenCV decode → YOLOv11 → compliance → incident → alert

Supports dual-mode:
  PPE Model  → full compliance checking, violation/incident creation
  COCO Model → person + object detection, no violations (needs PPE model for that)
"""
import io
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.ai.detector import detect_frame, FrameResult
from app.ai.model_loader import get_model_info

logger = logging.getLogger(__name__)


def _calculate_severity(missing_count: int) -> str:
    if missing_count >= 3:
        return "CRITICAL"
    elif missing_count == 2:
        return "HIGH"
    elif missing_count == 1:
        return "MEDIUM"
    return "LOW"


async def analyze_image(
    image_bytes: bytes,
    camera_id: str | None,
    db: AsyncSession,
    current_user,
) -> dict:
    """
    Full pipeline for a single uploaded image.
    Returns detection results and creates incident/violation if PPE model
    detects a violation.
    """
    from app.database.models import DetectionResult, Violation, Incident, Notification
    from app.websocket.manager import manager

    model_info = get_model_info()
    if not model_info["model_loaded"]:
        return {
            "error": "AI_OFFLINE",
            "message": "YOLOv11 model is not loaded. Place best.pt at the configured MODEL_PATH.",
            "model_info": model_info,
        }

    # ── Decode image ───────────────────────────────────────────────────────
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        return {"error": "INVALID_IMAGE", "message": str(e)}

    # ── Run YOLOv11 detection ──────────────────────────────────────────────
    result: FrameResult = detect_frame(frame)

    # ── Save annotated image ───────────────────────────────────────────────
    annotated_url = None
    if result.annotated_frame is not None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        filename = f"{uuid.uuid4()}.jpg"
        save_path = Path(settings.UPLOAD_DIR) / filename
        cv2.imwrite(str(save_path), result.annotated_frame)
        annotated_url = f"/storage/uploads/{filename}"

    ts = datetime.now(timezone.utc)
    cam_uuid = None
    if camera_id:
        try:
            cam_uuid = uuid.UUID(camera_id)
        except ValueError:
            pass

    # ── Save detection record ──────────────────────────────────────────────
    det_record = DetectionResult(
        camera_id=cam_uuid,
        frame_timestamp=ts,
        detected_objects={
            "workers": len(result.workers),
            "is_ppe_model": result.is_ppe_model,
            "model_note": result.model_note,
            "detections": [
                {"label": d.label, "confidence": round(d.confidence, 3)}
                for d in result.all_detections
            ],
        },
        confidence=max((w.confidence for w in result.workers), default=None),
        compliance_status="COMPLIANT" if result.violation_count == 0 else "VIOLATION",
    )
    db.add(det_record)

    # ── Create violations and incidents (PPE model only) ───────────────────
    incident_id = None
    for worker in result.workers:
        # Only create violations when PPE model is active and worker is non-compliant
        if not result.is_ppe_model:
            break
        if not worker.is_compliant and worker.missing_ppe:
            # Save evidence image
            evidence_path = None
            if result.annotated_frame is not None:
                os.makedirs(settings.INCIDENTS_DIR, exist_ok=True)
                ev_file = f"incident_{uuid.uuid4()}.jpg"
                year_month = ts.strftime("%Y/%m")
                ev_dir = Path(settings.INCIDENTS_DIR) / year_month
                ev_dir.mkdir(parents=True, exist_ok=True)
                ev_path = ev_dir / ev_file
                cv2.imwrite(str(ev_path), result.annotated_frame)
                evidence_path = str(ev_path)

            violation = Violation(
                camera_id=cam_uuid,
                violation_type="PPE_MISSING",
                missing_ppe=worker.missing_ppe,
                confidence=worker.confidence,
                evidence_path=evidence_path,
                detected_at=ts,
            )
            db.add(violation)
            await db.flush()

            severity = _calculate_severity(len(worker.missing_ppe))
            incident = Incident(
                violation_id=violation.id,
                description=f"Worker #{worker.worker_index} missing: {', '.join(worker.missing_ppe)}",
                status="OPEN",
                severity=severity,
            )
            db.add(incident)
            await db.flush()
            incident_id = str(incident.id)

            # Create notification
            notif = Notification(
                type="VIOLATION",
                title="PPE Violation Detected",
                message=f"Worker #{worker.worker_index} missing: {', '.join(worker.missing_ppe)}",
                incident_id=incident.id,
            )
            db.add(notif)

            # Broadcast WebSocket alert
            await manager.broadcast({
                "type": "violation",
                "incident_id": str(incident.id),
                "camera_id": camera_id,
                "severity": severity,
                "missing_ppe": worker.missing_ppe,
                "worker_index": worker.worker_index,
                "timestamp": ts.isoformat(),
                "message": f"PPE Violation: {', '.join(worker.missing_ppe)} missing",
            })

    await db.flush()

    return {
        "worker_count": len(result.workers),
        "workers": [
            {
                "worker_index": w.worker_index,
                "bbox": {"x1": w.bbox.x1, "y1": w.bbox.y1, "x2": w.bbox.x2, "y2": w.bbox.y2},
                "confidence": round(w.confidence, 3),
                "detected_ppe": w.detected_ppe,
                "missing_ppe": w.missing_ppe,
                "is_compliant": w.is_compliant,
            }
            for w in result.workers
        ],
        "all_detections": [
            {
                "label": d.label,
                "confidence": round(d.confidence, 3),
                "bbox": {"x1": d.bbox.x1, "y1": d.bbox.y1, "x2": d.bbox.x2, "y2": d.bbox.y2},
            }
            for d in result.all_detections
        ],
        "compliant_count": result.compliant_count,
        "violation_count": result.violation_count,
        "overall_compliant": result.violation_count == 0,
        "is_ppe_model": result.is_ppe_model,
        "model_note": result.model_note,
        "annotated_image_url": annotated_url,
        "incident_id": incident_id,
        "model_info": model_info,
    }
