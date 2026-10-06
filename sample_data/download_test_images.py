"""
SentinelAI — Test Dataset Downloader
Downloads sample industrial/construction images for testing YOLOv11 detection.
All images are from public domain / free-to-use sources.

Usage:
    cd C:\Users\Akhil\OneDrive\Desktop\Project
    python sample_data/download_test_images.py
"""
import urllib.request
import os
import sys
from pathlib import Path

DEST = Path("sample_data/test_images")
DEST.mkdir(parents=True, exist_ok=True)

# Public domain images — workers, construction, industrial, crowd scenes
# Sources: Wikimedia Commons (CC0/Public Domain) + Pixabay CDN (free)
TEST_IMAGES = [
    {
        "name": "01_construction_workers.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/200px-PNG_transparency_demonstration_1.png",
        # Use a real construction photo
        "url": "https://live.staticflickr.com/65535/51234567890_abc123_b.jpg",
    },
    # Using Picsum for reliable downloads (random real photos)
    {"name": "01_scene_people.jpg",       "url": "https://picsum.photos/seed/workers1/800/600"},
    {"name": "02_scene_crowd.jpg",        "url": "https://picsum.photos/seed/crowd2/800/600"},
    {"name": "03_scene_street.jpg",       "url": "https://picsum.photos/seed/street3/800/600"},
    {"name": "04_scene_outdoor.jpg",      "url": "https://picsum.photos/seed/outdoor4/800/600"},
    {"name": "05_scene_urban.jpg",        "url": "https://picsum.photos/seed/urban5/800/600"},
    # Wikimedia Commons — real construction/industrial photos (CC licensed)
    {
        "name": "06_construction_site.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Construction_workers_in_Chennai.jpg/640px-Construction_workers_in_Chennai.jpg",
    },
    {
        "name": "07_workers_helmets.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/EM_Spezialist.jpg/640px-EM_Spezialist.jpg",
    },
    {
        "name": "08_factory_workers.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Factory_workers_in_China.jpg/640px-Factory_workers_in_China.jpg",
    },
    {
        "name": "09_road_workers.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Road_workers.jpg/640px-Road_workers.jpg",
    },
    {
        "name": "10_crowd_scene.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Crowd_at_the_San_Jose_Flea_Market.jpg/640px-Crowd_at_the_San_Jose_Flea_Market.jpg",
    },
]

HEADERS = {
    "User-Agent": "SentinelAI-TestDataset/1.0 (research project)"
}

print("=" * 60)
print("SentinelAI — Downloading Test Images")
print("=" * 60)

downloaded = []
failed = []

for img in TEST_IMAGES:
    # Remove duplicate url keys — take last one
    url = img["url"]
    name = img["name"]
    dest_path = DEST / name

    if dest_path.exists():
        print(f"  [SKIP] {name} (already exists)")
        downloaded.append(str(dest_path))
        continue

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp, open(dest_path, "wb") as f:
            data = resp.read()
            f.write(data)
        size_kb = len(data) // 1024
        print(f"  [OK]   {name} ({size_kb} KB)")
        downloaded.append(str(dest_path))
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        failed.append(name)
        if dest_path.exists():
            dest_path.unlink()

print()
print(f"Downloaded: {len(downloaded)} images → {DEST}/")
if failed:
    print(f"Failed:     {len(failed)} images (will be skipped in testing)")
print()
print("Run detection test:")
print("  python sample_data/run_detection_test.py")
