"""Detection router: image upload, video, stream control, AI status."""
import os
import uuid
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import User
from app.ai.model_loader import get_model_info
from app.services.detection_service import analyze_image
from app.schemas.schemas import AIStatus

router = APIRouter(prefix="/api/detection", tags=["Detection"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/avi", "video/x-msvideo", "video/quicktime", "video/x-matroska"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB


@router.get("/status", response_model=AIStatus)
async def ai_status(_: User = Depends(get_current_user)):
    """Return YOLOv11 engine status and model metadata."""
    info = get_model_info()
    return AIStatus(
        model_loaded=info["model_loaded"],
        model_path=info["model_path"],
        device=info["device"],
        confidence_threshold=info["confidence_threshold"],
        classes=info["classes"],
        status=info["status"],
    )


@router.post("/image")
async def detect_image(
    file: UploadFile = File(...),
    camera_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image for YOLOv11 PPE analysis.
    Returns detection results + annotated image URL.
    Single image → immediate violation creation (no frame buffering needed).
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, detail=f"Unsupported image type: {file.content_type}")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(413, detail="Image too large (max 20 MB)")

    result = await analyze_image(image_bytes, camera_id, db, current_user)

    if "error" in result:
        code = 503 if result["error"] == "AI_OFFLINE" else 422
        return JSONResponse(status_code=code, content=result)

    return result


@router.post("/video")
async def detect_video(
    file: UploadFile = File(...),
    camera_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a video for frame-by-frame YOLOv11 PPE analysis.

    Violation confirmation logic:
    - A violation is only created after VIOLATION_CONFIRMATION_FRAMES consecutive
      frames show the same worker missing the same PPE.
    - INCIDENT_COOLDOWN_SECONDS prevents duplicate violations for the same worker.
    - Each confirmed violation is saved to DB with evidence image.
    """
    from app.ai.detector import detect_frame
    from app.database.models import DetectionResult, Violation, Incident, Notification
    from app.websocket.manager import manager

    info = get_model_info()
    if not info["model_loaded"]:
        return JSONResponse(status_code=503, content={
            "error": "AI_OFFLINE",
            "message": "YOLOv11 model not loaded. Configure MODEL_PATH."
        })

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(415, detail=f"Unsupported video type: {file.content_type}")

    video_bytes = await file.read()
    if len(video_bytes) > MAX_VIDEO_SIZE:
        raise HTTPException(413, detail="Video too large (max 500 MB)")

    # Save to temp file for OpenCV
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    cam_uuid = None
    if camera_id:
        try:
            cam_uuid = uuid.UUID(camera_id)
        except ValueError:
            pass

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(422, detail="Could not open video file")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_skip = max(settings.FRAME_SKIP, 1)
        confirm_needed = max(settings.VIOLATION_CONFIRMATION_FRAMES, 2)
        cooldown_sec = settings.INCIDENT_COOLDOWN_SECONDS

        # ── Persistent Worker Tracker for Video ──────────────────────────────
        class VideoWorkerTrack:
            def __init__(self, track_id: int, bbox: list[float], frame_idx: int):
                self.track_id = track_id
                self.bbox = bbox  # [x1, y1, x2, y2]
                self.last_frame = frame_idx
                self.total_frames = 1
                self.compliant_frames = 0
                self.violation_frames = 0
                self.consecutive_violations = 0
                self.has_violation = False
                self.last_violation_sec = -9999.0
                self.last_missing_ppe: list[str] = []
                self.best_confidence = 0.0

            def update(self, bbox: list[float], frame_idx: int, conf: float):
                self.bbox = bbox
                self.last_frame = frame_idx
                self.total_frames += 1
                if conf > self.best_confidence:
                    self.best_confidence = conf

        def box_iou(b1, b2) -> float:
            ix1, iy1 = max(b1[0], b2[0]), max(b1[1], b2[1])
            ix2, iy2 = min(b1[2], b2[2]), min(b1[3], b2[3])
            inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
            a1 = max(0.0, b1[2] - b1[0]) * max(0.0, b1[3] - b1[1])
            a2 = max(0.0, b2[2] - b2[0]) * max(0.0, b2[3] - b2[1])
            union = a1 + a2 - inter
            return inter / union if union > 0 else 0.0

        def box_center_dist(b1, b2) -> float:
            c1 = ((b1[0] + b1[2]) / 2, (b1[1] + b1[3]) / 2)
            c2 = ((b2[0] + b2[2]) / 2, (b2[1] + b2[3]) / 2)
            return ((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2) ** 0.5

        all_tracks: list[VideoWorkerTrack] = []
        next_track_id = 1
        max_lost_frames = int(fps * 2.0)  # persist track across up to 2 seconds of occlusion

        processed = 0
        total_violations_confirmed = 0
        max_concurrent_workers = 0
        violation_records_created = []
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_num += 1
            if frame_num % frame_skip != 0:
                continue

            result = detect_frame(frame)
            processed += 1
            ts = datetime.now(timezone.utc)
            video_sec = frame_num / fps

            num_workers_now = len(result.workers)
            if num_workers_now > max_concurrent_workers:
                max_concurrent_workers = num_workers_now

            # Save detection result record
            det_record = DetectionResult(
                camera_id=cam_uuid,
                frame_timestamp=ts,
                detected_objects={
                    "frame": frame_num,
                    "workers": num_workers_now,
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

            if not result.is_ppe_model:
                continue

            # ── Track association for current frame ─────────────────────────
            assigned_track_ids = set()
            active_tracks = [t for t in all_tracks if (frame_num - t.last_frame) <= max_lost_frames]

            for worker in result.workers:
                wb = [worker.bbox.x1, worker.bbox.y1, worker.bbox.x2, worker.bbox.y2]
                best_track = None
                best_score = -1.0

                for t in active_tracks:
                    if t.track_id in assigned_track_ids:
                        continue
                    iou = box_iou(wb, t.bbox)
                    w_diag = max(wb[2] - wb[0], wb[3] - wb[1], 1.0)
                    dist = box_center_dist(wb, t.bbox)
                    norm_dist = max(0.0, 1.0 - (dist / (w_diag * 1.5)))
                    score = iou * 0.7 + norm_dist * 0.3

                    if (iou >= 0.20 or dist <= w_diag * 0.8) and score > best_score:
                        best_score = score
                        best_track = t

                if best_track is not None:
                    best_track.update(wb, frame_num, worker.confidence)
                    assigned_track_ids.add(best_track.track_id)
                    matched_track = best_track
                else:
                    # New worker entered the scene
                    matched_track = VideoWorkerTrack(next_track_id, wb, frame_num)
                    next_track_id += 1
                    all_tracks.append(matched_track)
                    assigned_track_ids.add(matched_track.track_id)

                # ── Evaluate Compliance for this Track ──────────────────────
                if worker.is_compliant or not worker.missing_ppe:
                    matched_track.compliant_frames += 1
                    matched_track.consecutive_violations = 0
                else:
                    matched_track.violation_frames += 1
                    matched_track.consecutive_violations += 1
                    matched_track.last_missing_ppe = list(worker.missing_ppe)

                    # Trigger confirmed violation if consecutive violations reached and cooldown passed
                    if matched_track.consecutive_violations >= confirm_needed:
                        if (video_sec - matched_track.last_violation_sec) >= cooldown_sec:
                            matched_track.last_violation_sec = video_sec
                            matched_track.has_violation = True
                            matched_track.consecutive_violations = 0
                            total_violations_confirmed += 1

                            # Save evidence frame
                            evidence_path = None
                            if result.annotated_frame is not None:
                                ev_dir = Path(settings.INCIDENTS_DIR) / ts.strftime("%Y/%m")
                                ev_dir.mkdir(parents=True, exist_ok=True)
                                ev_file = ev_dir / f"video_violation_{uuid.uuid4()}.jpg"
                                cv2.imwrite(str(ev_file), result.annotated_frame)
                                evidence_path = str(ev_file)

                            n_missing = len(worker.missing_ppe)
                            severity = "CRITICAL" if n_missing >= 3 else "HIGH" if n_missing == 2 else "MEDIUM"

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

                            incident = Incident(
                                violation_id=violation.id,
                                description=f"Video Worker #{matched_track.track_id} missing: {', '.join(worker.missing_ppe)}",
                                status="OPEN",
                                severity=severity,
                            )
                            db.add(incident)
                            await db.flush()

                            notif = Notification(
                                type="VIOLATION",
                                title="PPE Violation (Video)",
                                message=f"Worker #{matched_track.track_id} missing: {', '.join(worker.missing_ppe)}",
                                incident_id=incident.id,
                            )
                            db.add(notif)

                            violation_records_created.append({
                                "worker_index": matched_track.track_id,
                                "missing_ppe": worker.missing_ppe,
                                "frame": frame_num,
                                "incident_id": str(incident.id),
                            })

                            await manager.broadcast({
                                "type": "violation",
                                "incident_id": str(incident.id),
                                "camera_id": camera_id,
                                "severity": severity,
                                "missing_ppe": worker.missing_ppe,
                                "worker_index": matched_track.track_id,
                                "timestamp": ts.isoformat(),
                                "message": f"Video PPE Violation: Worker #{matched_track.track_id} missing {', '.join(worker.missing_ppe)}",
                            })

        cap.release()
        await db.flush()

        # ── Final Metrics Computation ─────────────────────────────────────────
        # Filter genuine tracks (observed in multiple frames to eliminate single-frame glitches)
        min_track_frames = max(3, int(processed * 0.02))
        valid_tracks = [t for t in all_tracks if t.total_frames >= min_track_frames]
        
        # Total distinct workers in the video
        if valid_tracks:
            # If tracks exceed max_concurrent significantly due to occlusion re-identification,
            # use max_concurrent_workers as a stable ground truth anchor
            total_distinct_workers = max(max_concurrent_workers, len(valid_tracks))
            violating_tracks = [t for t in valid_tracks if t.has_violation or (t.violation_frames > t.compliant_frames)]
            violating_workers_count = min(len(violating_tracks), total_distinct_workers)
            compliant_workers_count = max(0, total_distinct_workers - violating_workers_count)

            total_obs = sum(t.total_frames for t in valid_tracks)
            total_comp_obs = sum(t.compliant_frames for t in valid_tracks)
            comp_rate = round((total_comp_obs / max(total_obs, 1)) * 100, 1)
        else:
            total_distinct_workers = max_concurrent_workers
            compliant_workers_count = max_concurrent_workers
            violating_workers_count = 0
            comp_rate = 100.0

        return {
            "total_frames": total_frames,
            "processed_frames": processed,
            "fps": round(fps, 1),
            "total_workers_detected": total_distinct_workers,
            "compliant_count": compliant_workers_count,
            "violation_count": violating_workers_count,
            "compliance_rate": comp_rate,
            "violations_saved": violation_records_created,
            "is_ppe_model": info.get("is_ppe_model", False),
        }

    finally:
        os.unlink(tmp_path)



