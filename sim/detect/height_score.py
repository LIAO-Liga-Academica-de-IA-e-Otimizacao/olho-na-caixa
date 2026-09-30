"""Score the full-crate count when the height comes from the side photo."""

from __future__ import annotations

import csv
from pathlib import Path

from detect.profile import count_from_height


SHEET = Path(__file__).resolve().parents[1] / "assets" / "detect" / "height-sheet.csv"


def main() -> None:
    rows = list(csv.DictReader(SHEET.open()))
    for row in rows:
        for key in ("inside", "d_cm", "h_area_cm", "h_sky_cm", "h_photo_cm"):
            row[key] = float(row[key])
    train = [row for row in rows if row["split"] == "train"]
    val = [row for row in rows if row["split"] == "val"]
    slope, intercept = _fit([row["h_photo_cm"] for row in train], [row["h_area_cm"] for row in train])
    print(f"area_cm = {intercept:.2f} + {slope:.3f} * photo_cm   train={len(train)} val={len(val)}")
    _report("oracle area", val, lambda row: count_from_height(row["h_area_cm"], row["d_cm"]))
    _report("photo", val, lambda row: count_from_height(row["h_photo_cm"], row["d_cm"]))
    _report(
        "photo corrected",
        val,
        lambda row: count_from_height(intercept + slope * row["h_photo_cm"], row["d_cm"]),
    )


def _report(name: str, rows: list[dict], estimate) -> None:
    rels = []
    for row in rows:
        truth = row["inside"]
        rels.append((estimate(row) - truth) / truth)
    mean = sum(rels) / len(rels)
    mae = sum(abs(value) for value in rels) / len(rels)
    print(f"{name}: bias {mean:+.1%} mae {mae:.1%} min {min(rels):+.1%} max {max(rels):+.1%}")


def _fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    count = len(xs)
    sx = sum(xs)
    sy = sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, ys))
    slope = (count * sxy - sx * sy) / (count * sxx - sx * sx)
    intercept = (sy - slope * sx) / count
    return slope, intercept


if __name__ == "__main__":
    main()
