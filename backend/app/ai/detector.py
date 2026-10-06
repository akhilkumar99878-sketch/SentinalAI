"""
PPE detector — runs YOLOv11 inference and returns structured results.

Supports two model modes:
  - PPE Model:   Custom-trained model with PPE classes (helmet, vest, etc.)
                 → Full compliance checking per worker
  - COCO Model:  Standard YOLOv11 (yolo11n/s/m/l/x.pt)
                 → Person detection + object detection, compliance N/A
                   until a PPE-trained model is loaded
"""
import logging
from dataclasses import dataclass, field

import cv2
import numpy as np

from app.core.config import settings
from app.ai.model_loader import get_model, get_model_info

logger = logging.getLogger(__name__)

# ── PPE class aliases ──────────────────────────────────────────────────────
# Maps naming variants (including SH17 dataset class names) to canonical
# PPE item names used for compliance checking.
PPE_ALIASES: dict[str, str] = {
    # ── Helmet ──────────────────────────────────────────────────────────────
    "helmet": "helmet", "hard hat": "helmet", "hardhat": "helmet",
    "hard-hat": "helmet", "safety helmet": "helmet",
    # ── Safety Vest ─────────────────────────────────────────────────────────
    "vest": "vest", "safety vest": "vest", "hi-vis": "vest",
    "hi vis": "vest", "high visibility vest": "vest", "reflective vest": "vest",
    "safety-vest": "vest", "safetyvest": "vest",
    # ── Gloves ──────────────────────────────────────────────────────────────
    "gloves": "gloves", "glove": "gloves", "safety gloves": "gloves",
    # ── Goggles / Glasses ───────────────────────────────────────────────────
    "goggles": "goggles", "safety goggles": "goggles",
    "glasses": "goggles", "safety glasses": "goggles", "eye protection": "goggles",
    # ── Boots / Shoes ───────────────────────────────────────────────────────
    "boots": "boots", "safety boots": "boots", "safety shoes": "boots",
    "shoes": "boots", "footwear": "boots", "foot": "boots", "safetyshoes": "boots",
    # ── Mask ────────────────────────────────────────────────────────────────
    "mask": "mask", "face mask": "mask", "dust mask": "mask",
    "face-mask-medical": "mask", "face mask medical": "mask",
    # ── Ear Protection ──────────────────────────────────────────────────────
    "ear-mufs": "ear_protection", "ear muffs": "ear_protection",
    "earmuffs": "ear_protection", "ear protection": "ear_protection",
    # ── Face Guard ──────────────────────────────────────────────────────────
    "face-guard": "face_guard", "face guard": "face_guard",
    "face shield": "face_guard",
    # ── Safety Suit ─────────────────────────────────────────────────────────
    "safety-suit": "suit", "medical-suit": "suit",
    "safety suit": "suit", "medical suit": "suit", "coverall": "suit",
    # ── Body-part annotations — NOT PPE items ───────────────────────────────
    "head": "head_part", "face": "face_part",
    "ear": "ear_part", "hands": "hands_part",
    # ── Tools & Construction Site Objects ───────────────────────────────────
    "tools": "tools", "barricade": "barricade", "dumpster": "dumpster",
    "excavators": "excavators", "safety net": "safety_net",
    "dump truck": "vehicle", "mini-van": "vehicle", "truck": "vehicle",
    "wheel loader": "vehicle",
    # ── Person ──────────────────────────────────────────────────────────────
    "person": "person", "worker": "person", "human": "person",
    # ── Negative PPE classes (explicit non-compliance) ──────────────────────
    "no helmet": "no_helmet", "no-helmet": "no_helmet",
    "no-hardhat": "no_helmet", "no hardhat": "no_helmet",
    "no vest": "no_vest", "no-vest": "no_vest",
    "no-safety vest": "no_vest", "no safety vest": "no_vest",
    "no gloves": "no_gloves", "no goggles": "no_goggles",
    "no mask": "no_mask", "no-mask": "no_mask", "no boots": "no_boots",
}

# Canonical PPE items (positive detections — not "no_xxx" variants).
# Includes both generic names AND dataset-specific canonical names.
POSITIVE_PPE_ITEMS = {
    "helmet", "vest", "gloves", "goggles", "boots", "mask",
    # Specialized canonical
    "ear_protection", "face_guard", "suit",
}
NEGATIVE_PPE_ITEMS = {"no_helmet", "no_vest", "no_gloves", "no_goggles", "no_boots", "no_mask"}

# Body-part and background objects — NOT PPE, not workers
SH17_BODY_PARTS = {"head_part", "face_part", "ear_part", "hands_part"}
SITE_OBJECTS = {"barricade", "dumpster", "excavators", "safety_net", "vehicle", "tools"}

# Non-PPE object classes
NON_PPE_OBJECTS = {*SITE_OBJECTS, *SH17_BODY_PARTS}


# COCO model class names that are NOT person (to skip as PPE)
COCO_NON_PPE = {
    "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird",
    "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
    "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis",
    "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush",
}

# Colors for annotation (BGR)
COLOR_COMPLIANT = (34, 197, 94)      # green
COLOR_VIOLATION = (68, 68, 239)      # red-ish blue (OpenCV BGR)
COLOR_PPE_OK = (0, 200, 255)         # cyan-yellow
COLOR_PPE_BAD = (68, 68, 239)        # orange-ish
COLOR_OBJECT = (180, 180, 180)       # gray for non-PPE detections
COLOR_PERSON_COCO = (59, 130, 246)   # blue for COCO person


@dataclass
class BBox:
    x1: float
    y1: float
    x2: float
    y2: float
    conf: float = 0.0

    def area(self) -> float:
        return max(0, self.x2 - self.x1) * max(0, self.y2 - self.y1)

    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)


@dataclass
class Detection:
    label: str
    normalized_label: str
    confidence: float
    bbox: BBox


@dataclass
class WorkerResult:
    worker_index: int
    bbox: BBox
    confidence: float
    detected_ppe: list[str] = field(default_factory=list)
    missing_ppe: list[str] = field(default_factory=list)
    is_compliant: bool = False


@dataclass
class FrameResult:
    workers: list[WorkerResult] = field(default_factory=list)
    all_detections: list[Detection] = field(default_factory=list)
    annotated_frame: "np.ndarray | None" = None
    compliant_count: int = 0
    violation_count: int = 0
    is_ppe_model: bool = False   # True = custom PPE model, False = standard COCO
    model_note: str = ""          # Human-readable note about model capability


def _normalize_label(label: str) -> str:
    return PPE_ALIASES.get(label.lower().strip(), label.lower().strip())


def _is_ppe_model(class_names: list[str]) -> bool:
    """Detect if the loaded model was trained for PPE detection."""
    normalized = {_normalize_label(c) for c in class_names}
    # A PPE model has at least one canonical PPE item OR a "no_xxx" class
    return bool(normalized & (POSITIVE_PPE_ITEMS | NEGATIVE_PPE_ITEMS))


def _iou_box_contains(worker_bbox: BBox, ppe_bbox: BBox, margin: float = 0.25) -> bool:
    """Check if PPE center point is inside (expanded) worker bounding box."""
    cx, cy = ppe_bbox.center()
    w = worker_bbox.x2 - worker_bbox.x1
    h = worker_bbox.y2 - worker_bbox.y1
    exp_x1 = worker_bbox.x1 - w * margin
    exp_y1 = worker_bbox.y1 - h * margin
    exp_x2 = worker_bbox.x2 + w * margin
    exp_y2 = worker_bbox.y2 + h * margin
    return exp_x1 <= cx <= exp_x2 and exp_y1 <= cy <= exp_y2


def detect_frame(
    frame: np.ndarray,
    required_ppe: list[str] | None = None,
) -> FrameResult:
    """
    Run YOLOv11 on a single BGR frame.
    Returns structured detection + compliance results.
    Works with both PPE-trained models and standard COCO models.
    """
    model = get_model()
    if model is None:
        return FrameResult(model_note="AI Engine Offline — model not loaded")

    info = get_model_info()
    class_names = info.get("classes", [])
    ppe_model = _is_ppe_model(class_names)

    # ── Run inference ──────────────────────────────────────────────────────
    max_dim = max(frame.shape[:2]) if frame is not None else 640
    imgsz = max(settings.IMAGE_SIZE, 960) if max_dim >= 1200 else settings.IMAGE_SIZE

    results = model.predict(
        source=frame,
        conf=settings.CONFIDENCE_THRESHOLD,
        iou=settings.IOU_THRESHOLD,
        imgsz=imgsz,
        verbose=False,
    )

    all_detections: list[Detection] = []
    workers: list[Detection] = []
    ppe_items: list[Detection] = []
    other_items: list[Detection] = []

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            norm = _normalize_label(label)
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            det = Detection(
                label=label,
                normalized_label=norm,
                confidence=conf,
                bbox=BBox(x1, y1, x2, y2, conf),
            )
            all_detections.append(det)

            if norm == "person":
                workers.append(det)
            elif norm in POSITIVE_PPE_ITEMS or norm in NEGATIVE_PPE_ITEMS:
                # Exclude SH17 body-part annotations from PPE items
                if norm not in NON_PPE_OBJECTS:
                    ppe_items.append(det)
            else:
                other_items.append(det)

    # ── Handle COCO model (person-only, no PPE classes) ────────────────────
    if not ppe_model:
        model_note = (
            f"Standard YOLOv11 (COCO) — detected {len(workers)} person(s) "
            f"and {len(other_items)} other object(s). "
            "Load a PPE-trained model for compliance checking."
        )
        worker_results = [
            WorkerResult(
                worker_index=i + 1,
                bbox=w.bbox,
                confidence=w.confidence,
                detected_ppe=[],
                missing_ppe=[],
                is_compliant=False,
            )
            for i, w in enumerate(workers)
        ]
        annotated = _draw_coco_annotations(frame.copy(), workers, all_detections)
        return FrameResult(
            workers=worker_results,
            all_detections=all_detections,
            annotated_frame=annotated,
            compliant_count=0,
            violation_count=0,
            is_ppe_model=False,
            model_note=model_note,
        )

    # ── PPE model path ─────────────────────────────────────────────────────
    # Resolve required PPE: 1) explicit arg, 2) settings, 3) model classes, 4) default
    if required_ppe is None:
        cfg_ppe = getattr(settings, "REQUIRED_PPE", None)
        if cfg_ppe:
            # Parse comma-separated string from .env
            required_ppe = [p.strip() for p in cfg_ppe.split(",") if p.strip()]
        else:
            # Fall back to PPE items that actually exist in the model
            required_ppe = [c for c in POSITIVE_PPE_ITEMS if c in {_normalize_label(n) for n in class_names}]
    if not required_ppe:
        required_ppe = ["helmet", "vest"]  # absolute fallback

    # Handle "no_xxx" classes — treat them as confirmed violations
    confirmed_violations: dict[str, list[str]] = {}  # worker_bbox_key → [missing_ppe]
    for det in ppe_items:
        if det.normalized_label in NEGATIVE_PPE_ITEMS:
            missing_item = det.normalized_label.replace("no_", "")
            key = f"{int(det.bbox.x1)}_{int(det.bbox.y1)}"
            confirmed_violations.setdefault(key, []).append(missing_item)

    # If no workers detected but PPE items found, approximate worker from PPE cluster
    if not workers and (ppe_items or all_detections):
        h_dim, w_dim = frame.shape[:2]
        if ppe_items:
            min_x = min(p.bbox.x1 for p in ppe_items)
            min_y = min(p.bbox.y1 for p in ppe_items)
            max_x = max(p.bbox.x2 for p in ppe_items)
            max_y = max(p.bbox.y2 for p in ppe_items)
            # Expand bounding box around PPE to encompass the worker body
            pad_w = (max_x - min_x) * 0.35
            pad_h = (max_y - min_y) * 0.8
            w_x1 = max(0.0, min_x - pad_w)
            w_y1 = max(0.0, min_y - pad_w * 0.5)
            w_x2 = min(float(w_dim), max_x + pad_w)
            w_y2 = min(float(h_dim), max_y + pad_h)
            workers = [Detection(
                label="person", normalized_label="person", confidence=0.85,
                bbox=BBox(w_x1, w_y1, w_x2, w_y2, 0.85),
            )]
        else:
            workers = [Detection(
                label="person", normalized_label="person", confidence=0.9,
                bbox=BBox(0, 0, float(w_dim), float(h_dim), 0.9),
            )]

    # Compliance per worker
    worker_results: list[WorkerResult] = []
    norm_required = [_normalize_label(p) for p in required_ppe]

    for idx, worker in enumerate(workers):
        # Positive PPE associated with this worker
        associated_ppe = [
            _normalize_label(p.label)
            for p in ppe_items
            if _normalize_label(p.label) in POSITIVE_PPE_ITEMS
            and _iou_box_contains(worker.bbox, p.bbox)
        ]

        # Negative classes (explicit violations) associated with this worker
        explicit_missing = [
            _normalize_label(p.label).replace("no_", "")
            for p in ppe_items
            if _normalize_label(p.label) in NEGATIVE_PPE_ITEMS
            and _iou_box_contains(worker.bbox, p.bbox)
        ]

        # Compute missing: required items not found AND explicitly marked missing
        detected_set = set(associated_ppe)
        missing = list({p for p in norm_required if p not in detected_set} | set(explicit_missing))

        wr = WorkerResult(
            worker_index=idx + 1,
            bbox=worker.bbox,
            confidence=worker.confidence,
            detected_ppe=sorted(set(associated_ppe)),
            missing_ppe=sorted(set(missing)),
            is_compliant=(len(missing) == 0),
        )
        worker_results.append(wr)

    compliant = sum(1 for w in worker_results if w.is_compliant)
    violations = len(worker_results) - compliant

    annotated = _draw_ppe_annotations(frame.copy(), worker_results, ppe_items)

    return FrameResult(
        workers=worker_results,
        all_detections=all_detections,
        annotated_frame=annotated,
        compliant_count=compliant,
        violation_count=violations,
        is_ppe_model=True,
        model_note=f"PPE model active — {len(required_ppe)} item(s) required: {', '.join(required_ppe)}",
    )


# ── Annotation helpers ─────────────────────────────────────────────────────

def _put_label(frame: np.ndarray, text: str, x: int, y: int, color: tuple,
               font_scale: float = 0.5, thickness: int = 1) -> None:
    """Draw label with a high-contrast background border for visibility."""
    (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    pad = max(3, int(4 * (font_scale / 0.5)))
    x = max(2, min(x, frame.shape[1] - tw - pad * 2 - 4))
    y = max(th + pad * 2 + 2, min(y, frame.shape[0] - pad - 2))
    cv2.rectangle(frame, (x, y - th - pad * 2), (x + tw + pad * 2, y + pad), (20, 20, 20), -1)
    cv2.rectangle(frame, (x, y - th - pad * 2), (x + tw + pad * 2, y + pad), color, max(1, thickness // 2))
    cv2.putText(frame, text, (x + pad, y - pad), cv2.FONT_HERSHEY_SIMPLEX,
                font_scale, (255, 255, 255), thickness, cv2.LINE_AA)


def _draw_coco_annotations(
    frame: np.ndarray,
    workers: list[Detection],
    all_detections: list[Detection],
) -> np.ndarray:
    """Annotations for standard COCO model — show all detected objects."""
    scale = max(frame.shape[1], frame.shape[0]) / 900.0
    box_thick = max(2, int(round(2.5 * scale)))
    font_scale = max(0.5, 0.45 * scale)
    font_thick = max(1, int(round(1.5 * scale)))

    for det in all_detections:
        b = det.bbox
        if det.normalized_label == "person":
            color = COLOR_PERSON_COCO
            label = f"Person ({det.confidence:.2f})"
        else:
            color = COLOR_OBJECT
            label = f"{det.label} ({det.confidence:.2f})"
        cv2.rectangle(frame, (int(b.x1), int(b.y1)), (int(b.x2), int(b.y2)), color, box_thick)
        _put_label(frame, label, int(b.x1), int(b.y1), color, font_scale, font_thick)

    # Overlay note
    note = f"YOLOv11 COCO: {len(workers)} person(s) detected | Load PPE model for compliance"
    bar_h = max(28, int(30 * scale))
    cv2.rectangle(frame, (0, 0), (frame.shape[1], bar_h), (0, 0, 0), -1)
    cv2.putText(frame, note, (8, int(bar_h * 0.7)), cv2.FONT_HERSHEY_SIMPLEX,
                max(0.5, 0.45 * scale), (255, 200, 0), font_thick, cv2.LINE_AA)
    return frame


def _draw_ppe_annotations(
    frame: np.ndarray,
    workers: list[WorkerResult],
    ppe_items: list[Detection],
) -> np.ndarray:
    """Annotations for PPE-trained model — high-visibility compliance visualization."""
    scale = max(frame.shape[1], frame.shape[0]) / 900.0
    ppe_thick = max(2, int(round(2.0 * scale)))
    worker_thick = max(3, int(round(3.5 * scale)))
    font_scale = max(0.5, 0.45 * scale)
    font_thick = max(1, int(round(1.5 * scale)))

    # Draw PPE item boxes
    for det in ppe_items:
        b = det.bbox
        norm = det.normalized_label
        if norm in POSITIVE_PPE_ITEMS:
            color = COLOR_PPE_OK
        elif norm in NEGATIVE_PPE_ITEMS:
            color = COLOR_PPE_BAD
        else:
            color = COLOR_OBJECT
        cv2.rectangle(frame, (int(b.x1), int(b.y1)), (int(b.x2), int(b.y2)), color, ppe_thick)
        _put_label(frame, f"{det.label} {det.confidence:.2f}", int(b.x1), int(b.y1), color, font_scale * 0.85, font_thick)

    # Draw worker boxes with compliance status
    for wr in workers:
        color = COLOR_COMPLIANT if wr.is_compliant else COLOR_VIOLATION
        b = wr.bbox
        cv2.rectangle(frame, (int(b.x1), int(b.y1)), (int(b.x2), int(b.y2)), color, worker_thick)

        if wr.is_compliant:
            status = "COMPLIANT"
        else:
            status = f"MISSING: {', '.join(wr.missing_ppe)}"
        label = f"Worker #{wr.worker_index} | {status}"
        _put_label(frame, label, int(b.x1), int(b.y1) - 4, color, font_scale, font_thick)

        # PPE badges along bottom of worker box
        badge_y = int(b.y2) - max(6, int(8 * scale))
        badge_spacing = int(140 * scale)
        badge_idx = 0
        for ppe in wr.detected_ppe:
            _put_label(frame, f"[OK] {ppe}", int(b.x1) + badge_idx * badge_spacing, badge_y, COLOR_COMPLIANT, font_scale * 0.75, font_thick)
            badge_idx += 1
        for ppe in wr.missing_ppe:
            _put_label(frame, f"[X] {ppe}", int(b.x1) + badge_idx * badge_spacing, badge_y, COLOR_VIOLATION, font_scale * 0.75, font_thick)
            badge_idx += 1

    return frame
