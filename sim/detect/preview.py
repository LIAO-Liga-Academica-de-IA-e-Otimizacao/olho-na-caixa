"""Draw the trained top-layer boxes on one photograph.

The phone screen does not run this model. Conferir still marks peel color.
This is the YOLO trained on the simulator stills, with the same score cutoff
and the same NMS as ``score.py``.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

from detect.produce import ITEMS
from detect.score import CONF, NMS_IOU, WEIGHTS

NAMES = {item.class_id: item.label for item in ITEMS.values() if item.class_id is not None}
COLORS = {"tangerine": (30, 140, 230), "tomato": (40, 60, 200)}
_MODEL: YOLO | None = None


def predict(image: Path, device: str = "cpu") -> tuple[np.ndarray, list[dict]]:
    """Boxes on one image.

    Returns the RGB picture with the boxes drawn, and one record per box:
    ``label``, ``score``, and ``xyxy`` in pixels of the original image.
    """
    model = _weights()
    result = model.predict(str(image), imgsz=320, conf=CONF, iou=NMS_IOU, device=device, verbose=False)[0]
    canvas = cv2.imread(str(image))
    if canvas is None:
        raise FileNotFoundError(image)
    rows = []
    if result.boxes is not None:
        for box, class_id, score in zip(result.boxes.xyxy.tolist(), result.boxes.cls.tolist(), result.boxes.conf.tolist()):
            label = NAMES.get(int(class_id), str(int(class_id)))
            x0, y0, x1, y1 = (int(round(value)) for value in box)
            color = COLORS.get(label, (255, 255, 255))
            cv2.rectangle(canvas, (x0, y0), (x1, y1), color, 2)
            cv2.putText(
                canvas,
                f"{label} {score:.2f}",
                (x0, max(16, y0 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                1,
                cv2.LINE_AA,
            )
            rows.append({"label": label, "score": float(score), "xyxy": [x0, y0, x1, y1]})
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    return rgb, rows


def _weights() -> YOLO:
    global _MODEL
    if _MODEL is None:
        if not WEIGHTS.is_file():
            raise FileNotFoundError(WEIGHTS)
        _MODEL = YOLO(str(WEIGHTS))
    return _MODEL


def main() -> None:
    """Write ``<stem>-yolo.png`` next to the photo and print each box."""
    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m detect.preview photo.png")
    image = Path(sys.argv[1])
    rgb, rows = predict(image)
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(f"{image.stem}-yolo.png")
    cv2.imwrite(str(dest), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    print(f"{dest} boxes={len(rows)}", flush=True)
    for row in rows:
        print(f"  {row['label']} {row['score']:.2f} {row['xyxy']}")


if __name__ == "__main__":
    main()
