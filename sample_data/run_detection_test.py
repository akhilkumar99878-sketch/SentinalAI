"""
SentinelAI — YOLOv11 Detection Test Runner
Runs YOLOv11 on all test images and saves annotated results.

Usage:
    cd C:\Users\Akhil\OneDrive\Desktop\Project
    python sample_data/run_detection_test.py
"""
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
os.chdir(Path(__file__).parent.parent / "backend")

# Load backend .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

import cv2
import numpy as np
from app.ai.model_loader import load_model, get_model_info
from app.ai.detector import detect_frame, _is_ppe_model

TEST_DIR = Path(__file__).parent / "test_images"
OUT_DIR  = Path(__file__).parent / "test_results"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Load model ─────────────────────────────────────────────────────────────
print("=" * 65)
print("SentinelAI — YOLOv11 Detection Test")
print("=" * 65)
print()
print("Loading YOLOv11...")
load_model()
info = get_model_info()

if not info["model_loaded"]:
    print(f"ERROR: Model not loaded — {info['status']}")
    print("Place best.pt at:", info["model_path"])
    sys.exit(1)

ppe_mode = _is_ppe_model(info["classes"])
print(f"  Status   : {info['status']}")
print(f"  Device   : {info['device']}")
print(f"  Classes  : {len(info['classes'])}")
print(f"  Mode     : {'PPE Detection (full compliance)' if ppe_mode else 'COCO Detection (person + objects)'}")
print(f"  Conf     : {info['confidence_threshold']}")
print()

# ── Find test images ───────────────────────────────────────────────────────
images = sorted(list(TEST_DIR.glob("*.jpg")) + list(TEST_DIR.glob("*.png")) + list(TEST_DIR.glob("*.webp")))

if not images:
    print(f"No test images found in {TEST_DIR}")
    print("Run: python sample_data/download_test_images.py")
    sys.exit(1)

print(f"Found {len(images)} test image(s) in {TEST_DIR}")
print("-" * 65)

# ── Run detection on each image ────────────────────────────────────────────
summary = []
for img_path in images:
    frame = cv2.imread(str(img_path))
    if frame is None:
        print(f"  [SKIP] {img_path.name} — could not read")
        continue

    h, w = frame.shape[:2]
    result = detect_frame(frame)

    # Save annotated image
    out_path = OUT_DIR / img_path.name
    if result.annotated_frame is not None:
        cv2.imwrite(str(out_path), result.annotated_frame)

    # Build per-image summary
    unique_labels = list({d.label for d in result.all_detections})
    person_count = sum(1 for d in result.all_detections if d.normalized_label == "person")

    row = {
        "file": img_path.name,
        "size": f"{w}x{h}",
        "detections": len(result.all_detections),
        "persons": person_count,
        "objects": unique_labels,
        "mode": result.model_note.split("—")[0].strip() if "—" in result.model_note else result.model_note,
    }
    if ppe_mode:
        row["workers"] = len(result.workers)
        row["violations"] = result.violation_count
        row["compliant"] = result.compliant_count

    summary.append(row)

    # Print result
    print(f"  {img_path.name}")
    print(f"    Size       : {w}x{h}")
    print(f"    Detections : {len(result.all_detections)} objects")
    print(f"    Persons    : {person_count}")
    if unique_labels:
        print(f"    Objects    : {', '.join(unique_labels[:8])}{'...' if len(unique_labels) > 8 else ''}")
    if ppe_mode:
        print(f"    Workers    : {len(result.workers)}")
        print(f"    Compliant  : {result.compliant_count}")
        print(f"    Violations : {result.violation_count}")
    print(f"    Saved to   : {out_path.name}")
    print()

# ── Summary ────────────────────────────────────────────────────────────────
print("=" * 65)
print("SUMMARY")
print("=" * 65)
total_detections = sum(r["detections"] for r in summary)
total_persons    = sum(r["persons"]    for r in summary)
print(f"  Images processed : {len(summary)}")
print(f"  Total detections : {total_detections}")
print(f"  Total persons    : {total_persons}")
if ppe_mode:
    total_violations = sum(r.get("violations", 0) for r in summary)
    total_compliant  = sum(r.get("compliant",  0) for r in summary)
    print(f"  PPE violations   : {total_violations}")
    print(f"  PPE compliant    : {total_compliant}")

print()
print(f"Annotated images saved to: {OUT_DIR}/")
print()
if not ppe_mode:
    print("NOTE: Currently running standard YOLOv11 (COCO) — detects persons and")
    print("      80 object classes. For PPE compliance (helmet/vest/gloves),")
    print("      replace model/best.pt with a PPE-trained YOLOv11 model.")
    print()
    print("Free PPE dataset to train your model:")
    print("  https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety")
