import os, sys, glob, xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter

labels_dir = Path('labels')
voc_dir = Path('voc_labels')
images_dir = Path('images')

with open('train_files.txt') as f:
    train_files = [line.strip() for line in f if line.strip()]
with open('val_files.txt') as f:
    val_files = [line.strip() for line in f if line.strip()]

# 1. Full scan across all VOC vs YOLO labels
all_classes = {}
mismatch_count = 0

for p_xml in voc_dir.glob('*.xml'):
    stem = p_xml.stem
    p_lbl = labels_dir / f'{stem}.txt'
    if not p_lbl.exists():
        continue
    tree = ET.parse(p_xml)
    xml_objs = [obj.find('name').text for obj in tree.findall('object')]
    with open(p_lbl) as f:
        lbl_cids = [int(l.strip().split()[0]) for l in f if l.strip()]
    if len(xml_objs) == len(lbl_cids):
        for cid, name in zip(lbl_cids, xml_objs):
            if cid not in all_classes:
                all_classes[cid] = Counter()
            all_classes[cid][name] += 1
    else:
        mismatch_count += 1

print('Class mapping across full dataset:')
id_to_name = {}
for cid in sorted(all_classes.keys()):
    best_name = all_classes[cid].most_common(1)[0][0]
    id_to_name[cid] = best_name
    print(f'  ID {cid:2d}: {best_name:20s} (seen {all_classes[cid][best_name]} times)')

# 2. Count instances per class in train vs val
train_class_counts = Counter()
val_class_counts = Counter()
missing_train_imgs = 0
missing_val_imgs = 0
missing_train_lbls = 0
missing_val_lbls = 0

# Check bbox coordinates validity
invalid_coords_count = 0

for img_name in train_files:
    img_p = images_dir / img_name
    lbl_p = labels_dir / f'{Path(img_name).stem}.txt'
    if not img_p.exists():
        missing_train_imgs += 1
    if not lbl_p.exists():
        missing_train_lbls += 1
    else:
        with open(lbl_p) as f:
            for l in f:
                if l.strip():
                    parts = l.strip().split()
                    cid = int(parts[0])
                    train_class_counts[cid] += 1
                    x, y, w, h = map(float, parts[1:5])
                    if not (0 <= x <= 1 and 0 <= y <= 1 and 0 <= w <= 1 and 0 <= h <= 1):
                        invalid_coords_count += 1

for img_name in val_files:
    img_p = images_dir / img_name
    lbl_p = labels_dir / f'{Path(img_name).stem}.txt'
    if not img_p.exists():
        missing_val_imgs += 1
    if not lbl_p.exists():
        missing_val_lbls += 1
    else:
        with open(lbl_p) as f:
            for l in f:
                if l.strip():
                    parts = l.strip().split()
                    cid = int(parts[0])
                    val_class_counts[cid] += 1
                    x, y, w, h = map(float, parts[1:5])
                    if not (0 <= x <= 1 and 0 <= y <= 1 and 0 <= w <= 1 and 0 <= h <= 1):
                        invalid_coords_count += 1

print('\nValidation Statistics:')
print(f'Missing train images: {missing_train_imgs}, Missing train labels: {missing_train_lbls}')
print(f'Missing val images: {missing_val_imgs}, Missing val labels: {missing_val_lbls}')
print(f'Invalid BBox coords: {invalid_coords_count}')

# Check train/val leakage
train_set = set(train_files)
val_set = set(val_files)
overlap = train_set.intersection(val_set)
print(f'Dataset leakage (overlap between train and val): {len(overlap)}')

print('\nPer-class instance count (Train vs Val):')
print(f"{'ID':2s} | {'Class Name':20s} | {'Train Count':12s} | {'Val Count':10s} | {'Total':10s}")
print('-' * 65)
max_id = max(max(all_classes.keys()), max(train_class_counts.keys(), default=0))
for cid in range(max_id + 1):
    cname = id_to_name.get(cid, 'UNKNOWN')
    t_cnt = train_class_counts[cid]
    v_cnt = val_class_counts[cid]
    print(f"{cid:2d} | {cname:20s} | {t_cnt:12d} | {v_cnt:10d} | {t_cnt+v_cnt:10d}")
