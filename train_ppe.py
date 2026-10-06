import sys
import shutil
import shutil as _shutil  # ensure available everywhere
from pathlib import Path
import yaml
import torch

PROJECT_ROOT = Path(r"C:\Users\Akhil\OneDrive\Desktop\Project")
IMAGES_DIR   = PROJECT_ROOT / "images"
LABELS_DIR   = PROJECT_ROOT / "labels"
TRAIN_LIST   = PROJECT_ROOT / "train_files.txt"
VAL_LIST     = PROJECT_ROOT / "val_files.txt"
ABS_TRAIN    = PROJECT_ROOT / "train_images_abs.txt"
ABS_VAL      = PROJECT_ROOT / "val_images_abs.txt"
YAML_PATH    = PROJECT_ROOT / "data.yaml"
RUNS_DIR     = PROJECT_ROOT / "model" / "training_runs"
RUN_NAME     = "sentinelai_ppe_v1"

CLASS_NAMES = {
    0:"person", 1:"ear", 2:"ear-mufs", 3:"face", 4:"face-guard",
    5:"face-mask-medical", 6:"foot", 7:"tools", 8:"glasses", 9:"gloves",
    10:"helmet", 11:"hands", 12:"head", 13:"medical-suit", 14:"shoes",
    15:"safety-suit", 16:"safety-vest"
}

def run():
    print("=" * 60)
    print("  SentinelAI PPE Training — FRESH START (0 to 100 epochs)")
    print("=" * 60)

    # Step 1: Generate manifests
    print("\n[1/5] Generating image manifests...")
    def make_manifest(src, dst):
        names = [l.strip() for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]
        paths = []
        for name in names:
            p = IMAGES_DIR / name
            if p.exists():
                paths.append(str(p).replace("\\", "/"))
        dst.write_text("\n".join(paths) + "\n", encoding="utf-8")
        print(f"  {dst.name}: {len(paths)} paths")
        return paths

    train_paths = make_manifest(TRAIN_LIST, ABS_TRAIN)
    val_paths   = make_manifest(VAL_LIST,   ABS_VAL)

    # Step 2: Write data.yaml
    print("\n[2/5] Writing data.yaml...")
    data_cfg = {
        "path":  str(PROJECT_ROOT).replace("\\", "/"),
        "train": str(ABS_TRAIN).replace("\\", "/"),
        "val":   str(ABS_VAL).replace("\\", "/"),
        "nc":    17,
        "names": CLASS_NAMES
    }
    with open(YAML_PATH, "w") as f:
        yaml.dump(data_cfg, f, sort_keys=False)
    print(f"  Written: {YAML_PATH}")

    # Step 3: Delete old run to start fresh
    print("\n[3/5] Clearing previous training run...")
    old_run = RUNS_DIR / RUN_NAME
    if old_run.exists():
        shutil.rmtree(old_run)
        print(f"  Deleted: {old_run}")
    # Also clear label cache
    for cache in [LABELS_DIR.parent / "labels.cache", PROJECT_ROOT / "labels.cache"]:
        if cache.exists():
            cache.unlink()
            print(f"  Deleted cache: {cache}")

    # Step 4: CUDA check
    print("\n[4/5] Checking GPU...")
    print(f"  torch : {torch.__version__}")
    print(f"  CUDA  : {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"  GPU   : {torch.cuda.get_device_name(0)}")
        print(f"  VRAM  : {torch.cuda.get_device_properties(0).total_memory/1e9:.1f} GB")
        device = 0
    else:
        device = "cpu"

    # Step 5: Train fresh from yolo11s.pt
    print("\n[5/5] Starting training (epoch 1 to 100)...")
    from ultralytics import YOLO
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    model = YOLO("yolo11s.pt")
    model.train(
        data=str(YAML_PATH),
        epochs=100,
        imgsz=640,
        batch=8,
        device=device,
        patience=20,
        project=str(RUNS_DIR),
        name=RUN_NAME,
        save=True,
        exist_ok=True,
        workers=0,       # Windows: must be 0
        cache=False,
        amp=True,
        verbose=True,
    )

    # Verify
    best_pt = RUNS_DIR / RUN_NAME / "weights" / "best.pt"
    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    if best_pt.exists():
        print(f"  best.pt: {best_pt}")
        trained = YOLO(str(best_pt))
        print(f"  Classes ({len(trained.names)}):")
        for cid, cname in trained.names.items():
            print(f"    {cid:2d}: {cname}")

        # Copy to model/best.pt for backend
        dest = PROJECT_ROOT / "model" / "best.pt"
        shutil.copy(str(best_pt), str(dest))
        print(f"\n  Copied to: {dest}")

        # Update .env
        env_path = PROJECT_ROOT / "backend" / ".env"
        lines = []
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("MODEL_PATH"):
                lines.append("MODEL_PATH=./model/best.pt")
            else:
                lines.append(line)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("  backend/.env updated: MODEL_PATH=./model/best.pt")
        print("\n  ACTION REQUIRED: Restart run_backend.bat to load the new model!")
    else:
        print("  ERROR: best.pt not found!")

if __name__ == "__main__":
    run()
