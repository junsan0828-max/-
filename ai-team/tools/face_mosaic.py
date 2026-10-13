# 사진 속 얼굴을 찾아 모자이크한다 (회원 얼굴이 블로그에 나가지 않게).
#  python face_mosaic.py <입력> <출력>   → stdout 에 JSON {"faces": n, "boxes": [[x,y,w,h],...]}
# 탐지기: YuNet(정면·측면·작은 얼굴에 강함) + Haar(정면/측면 보조) 의 합집합. 놓치는 것보다 과하게 가리는 쪽을 택한다.
# EXIF(위치·기기 정보)는 저장하지 않는다.
import json
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
MODEL = HERE / "models" / "face_detection_yunet_2023mar.onnx"


def imread(p):
    return cv2.imdecode(np.fromfile(p, dtype=np.uint8), cv2.IMREAD_COLOR)  # EXIF 회전 자동 적용


def imwrite(p, img):
    ext = Path(p).suffix.lower()
    ok, buf = cv2.imencode(ext, img, [cv2.IMWRITE_JPEG_QUALITY, 95] if ext in (".jpg", ".jpeg") else [])
    if not ok:
        raise RuntimeError("이미지 저장 실패")
    buf.tofile(p)


def yunet(img):
    boxes = []
    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN_create(str(MODEL), "", (w, h), 0.5, 0.3, 5000)
    # 원본 크기 + 확대본(작은 얼굴) 두 번 본다
    for scale in (1.0, 1.6):
        im = img if scale == 1.0 else cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        det.setInputSize((im.shape[1], im.shape[0]))
        _, faces = det.detect(im)
        for f in (faces if faces is not None else []):
            x, y, bw, bh = f[:4] / scale
            boxes.append([float(x), float(y), float(bw), float(bh)])
    return boxes


def haar(img):
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    boxes = []
    base = cv2.data.haarcascades
    for name in ("haarcascade_frontalface_alt2.xml", "haarcascade_profileface.xml"):
        c = cv2.CascadeClassifier(base + name)
        for flip in (False, True):  # 측면 얼굴은 좌우 반전도 본다
            src = cv2.flip(g, 1) if flip else g
            for (x, y, bw, bh) in c.detectMultiScale(src, scaleFactor=1.1, minNeighbors=5, minSize=(max(24, img.shape[1] // 40),) * 2):
                if flip:
                    x = g.shape[1] - x - bw
                boxes.append([float(x), float(y), float(bw), float(bh)])
    return boxes


def iou(a, b):
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    return inter / (a[2] * a[3] + b[2] * b[3] - inter + 1e-9)


def merge(boxes):
    out = []
    for b in sorted(boxes, key=lambda b: -b[2] * b[3]):
        if not any(iou(b, o) > 0.25 for o in out):
            out.append(b)
    return out


def pixelate(img, box, grow=0.4):
    h, w = img.shape[:2]
    x, y, bw, bh = box
    x0 = int(max(0, x - bw * grow)); y0 = int(max(0, y - bh * grow))
    x1 = int(min(w, x + bw * (1 + grow))); y1 = int(min(h, y + bh * (1 + grow)))
    if x1 - x0 < 4 or y1 - y0 < 4:
        return
    roi = img[y0:y1, x0:x1]
    small = cv2.resize(roi, (6, 6), interpolation=cv2.INTER_AREA)  # 6x6 블록: 복원 불가 수준
    img[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    if not MODEL.exists():
        print(json.dumps({"error": f"얼굴 탐지 모델이 없습니다: {MODEL}"}))
        sys.exit(2)
    img = imread(src)
    if img is None:
        print(json.dumps({"error": "이미지를 읽을 수 없습니다"}))
        sys.exit(2)
    boxes = merge(yunet(img) + haar(img))
    out = img.copy()
    for b in boxes:
        pixelate(out, b)
    imwrite(dst, out)
    print(json.dumps({"faces": len(boxes), "boxes": [[round(v) for v in b] for b in boxes]}))


if __name__ == "__main__":
    main()
