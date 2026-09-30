"""Train the top-layer YOLO nano. The weights are scored on the val seeds."""

from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1] / "assets" / "detect"


def main() -> None:
    model = YOLO("yolo11n.pt")
    model.train(
        data=str(ROOT / "data.yaml"),
        epochs=40,
        imgsz=320,
        batch=16,
        device=0,
        project=str(ROOT / "runs"),
        name="top-layer",
        exist_ok=True,
        workers=4,
        patience=12,
        plots=False,
    )


if __name__ == "__main__":
    main()
