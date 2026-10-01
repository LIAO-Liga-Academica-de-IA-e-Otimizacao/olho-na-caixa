"""Run the trained nano on the val stills and compare the visible count."""

from __future__ import annotations

import json
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1] / "assets" / "detect"
WEIGHTS = ROOT / "top-layer.pt"
# Default NMS (IoU 0.7) keeps two boxes on one cap. 0.55 / 0.45 is the point
# where the val count stops running high and recall of the labeled caps holds.
CONF = 0.55
NMS_IOU = 0.45


def main() -> None:
    """Score the saved weights on the held-out stills and print the visible-count error."""
    model = YOLO(str(WEIGHTS))
    measured = model.val(data=str(ROOT / "data.yaml"), imgsz=320, device=0, plots=False, verbose=False)
    rows = []
    for image in sorted((ROOT / "images" / "val").glob("*.png")):
        meta = json.loads((ROOT / "meta" / "val" / f"{image.stem}.json").read_text(encoding="utf-8"))
        result = model.predict(str(image), imgsz=320, conf=CONF, iou=NMS_IOU, device=0, verbose=False)[0]
        classes = [int(class_id) for class_id in result.boxes.cls.tolist()] if result.boxes is not None else []
        matched = sum(1 for class_id in classes if class_id == meta["class_id"])
        truth = int(meta["boxed"])
        rows.append(
            {
                "stem": image.stem,
                "label": meta["label"],
                "truth": truth,
                "predicted": matched,
                "rel": (matched - truth) / truth if truth else 0.0,
            }
        )
    abs_rel = [abs(row["rel"]) for row in rows]
    summary = {
        "map50": float(measured.box.map50),
        "map50_95": float(measured.box.map),
        "scenes": len(rows),
        "count_mae": sum(abs_rel) / len(abs_rel) if abs_rel else None,
        "count_worst": max(abs_rel) if abs_rel else None,
        "rows": rows,
    }
    (ROOT / "score.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(
        f"MAP50 {summary['map50']:.3f} COUNT_MAE {summary['count_mae']:.1%} "
        f"WORST {summary['count_worst']:.1%} scenes={summary['scenes']}",
        flush=True,
    )
    for row in rows:
        print(f"  {row['stem']} truth={row['truth']} pred={row['predicted']} rel={row['rel']:+.1%}")


if __name__ == "__main__":
    main()
