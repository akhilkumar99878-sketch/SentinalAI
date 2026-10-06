"""
SentinelAI - Google Colab Training Script for YOLOv11 PPE Model
==============================================================
Run this script or notebook in Google Colab (with T4 or A100 GPU).
"""

# Step 1: Install Ultralytics
# !pip install ultralytics

import os
from ultralytics import YOLO

# Step 2: Define your data.yaml configuration
data_yaml_content = """
# YOLOv11 PPE Detection Dataset Configuration
path: ./dataset  # Root folder where images and labels are stored
train: train_images.txt
val: val_images.txt

names:
  0: person
  1: ear
  2: ear-mufs
  3: face
  4: face-guard
  5: face-mask-medical
  6: foot
  7: tools
  8: glasses
  9: gloves
  10: helmet
  11: hands
  12: head
  13: medical-suit
  14: shoes
  15: safety-suit
  16: safety-vest
"""

with open("data.yaml", "w") as f:
    f.write(data_yaml_content.strip())

print("✅ data.yaml created successfully!")

# Step 3: Train YOLOv11 Model
def train():
    # Load pretrained YOLOv11s model
    model = YOLO("yolo11s.pt")

    # Train on dataset
    results = model.train(
        data="data.yaml",
        epochs=100,
        imgsz=640,
        batch=16,          # 16 for T4 (16GB VRAM) / 32 for A100
        device=0,           # CUDA GPU
        patience=20,        # Early stopping patience
        save=True,
        project="sentinelai_training",
        name="experiment_001",
        # Industrial augmentations
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        mosaic=1.0,
    )
    print("🎉 Training complete! Best weights saved at: sentinelai_training/experiment_001/weights/best.pt")

if __name__ == "__main__":
    train()
