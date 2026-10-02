"""Train the top-layer YOLO nano with heavy color jitter.

Same data, epochs and size as ``train.py``. The hue swing (default 0.015)
goes to 0.12 and saturation to 0.9, so the network must lean on fruit shape
instead of the simulator's peel tint. Real pokans read as tomato under the
published weights; this run tests whether color pressure moves them back.
The run lands in ``runs/top-layer-hue`` and never overwrites
``top-layer.pt``: compare before any swap.
"""

import os
import sys
from pathlib import Path

# The script directory (sim/detect) shadows the stdlib `profile` module that
# the training stack imports. Drop it: this script needs nothing from it.
sys.path = [entry for entry in sys.path if os.path.basename(entry) != "detect"]

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1] / "assets" / "detect"


def main() -> None:
    """Train the color-pressured nano. The venv torch is CPU-only."""
    model = YOLO(str(ROOT / "yolo11n.pt"))
    model.train(
        data=str(ROOT / "data.yaml"),
        epochs=40,
        imgsz=320,
        batch=16,
        device="cpu",
        project=str(ROOT / "runs"),
        name="top-layer-hue",
        exist_ok=True,
        workers=4,
        patience=12,
        plots=False,
        hsv_h=0.12,
        hsv_s=0.9,
    )


if __name__ == "__main__":
    main()
