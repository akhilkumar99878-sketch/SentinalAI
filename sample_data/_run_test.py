import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'backend'))

for line in open('.env'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

from app.ai.model_loader import load_model, get_model_info
from app.ai.detector import detect_frame
import cv2
from pathlib import Path

print('Loading YOLOv11...')
load_model()
info = get_model_info()
print('Status :', info['status'])
print('Device :', info['device'])
print('Classes:', len(info['classes']))
print()

test_dir = Path('../sample_data/test_images')
out_dir  = Path('../sample_data/test_results')
out_dir.mkdir(exist_ok=True)

images = sorted(list(test_dir.glob('*.jpg')) + list(test_dir.glob('*.png')))
print('Running YOLOv11 on', len(images), 'test images')
print('-' * 55)

total_persons, total_dets = 0, 0
for img_path in images:
    frame = cv2.imread(str(img_path))
    if frame is None:
        continue
    h, w = frame.shape[:2]
    result = detect_frame(frame)

    persons = sum(1 for d in result.all_detections if d.normalized_label == 'person')
    other_labels = list({d.label for d in result.all_detections if d.normalized_label != 'person'})
    total_persons += persons
    total_dets    += len(result.all_detections)

    if result.annotated_frame is not None:
        cv2.imwrite(str(out_dir / img_path.name), result.annotated_frame)

    print(' ', img_path.name)
    print('    Image size :', w, 'x', h)
    print('    Persons    :', persons)
    print('    All objects:', len(result.all_detections))
    if other_labels:
        print('    Also saw   :', ', '.join(other_labels[:8]))
    print()

print('=' * 55)
print('Images processed :', len(images))
print('Total persons    :', total_persons)
print('Total detections :', total_dets)
print()
print('Annotated results saved to:')
print(' ', str(out_dir.resolve()))
