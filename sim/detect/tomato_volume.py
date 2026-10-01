"""Tomato liters from two arc frames.

The ray crossing already sits near the skin, so the tangerine radius is not
added. The first 3 cm inside the near wall are the rim. A point more than 6 cm
above the median is a false cross. The lid is the median of what remains.

The line was fit on the 32 training scenes. Leave-one-out there chose this
trim over the raw median. The 8 held-out scenes were scored after that freeze.
Two training crates near 9 cm still miss 10%: the floor average sits about 2 cm
under the fruits the camera matched, and 1 cm is already more than 10% of that
pile.
"""

from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

from detect.fruit_height import CAMERAS, matched_points

NEAR_M = 0.03
SPIKE_CM = 6.0
# height_cm = -1.0879 + 0.998045 * reading_cm, on the training crates.
OFFSET_CM = -1.0879
SLOPE = 0.998045
AREA_CM2 = 28.2 * 39.2
ROOT = Path(__file__).resolve().parents[1] / "assets" / "detect"


def reading_cm(points: list[np.ndarray]) -> float:
    """Median skin height, in centimeters, after the rim and the spikes are out."""
    floor = CAMERAS["floor_z"]
    near = CAMERAS["min_x"] + NEAR_M
    heights = [(float(point[2]) - floor) * 100.0 for point in points if float(point[0]) >= near]
    if not heights:
        return 0.0
    median = float(np.median(heights))
    kept = [height for height in heights if height <= median + SPIKE_CM]
    return float(np.median(kept if kept else heights))


def lid_cm(reading: float) -> float:
    """Floor-average lid height, in centimeters, after the training line."""
    return OFFSET_CM + SLOPE * reading


def liters(height_cm: float) -> float:
    """Pile volume. Mass is this times the lot's kilograms per liter."""
    return AREA_CM2 * height_cm / 1000.0


def reading_from_frames(image_a: Path, image_b: Path) -> float:
    """Median reading of one tomato crate, from the two arc stills."""
    return reading_cm(matched_points(image_a, image_b, "tomato"))


def write_sheet() -> None:
    """Store the median reading next to the true lid height."""
    sheet = ROOT / "tomato-height-sheet.csv"
    rows = list(csv.DictReader(sheet.open()))
    for row in rows:
        seed = int(float(row["seed"]))
        image = ROOT / "sides" / "tomato" / row["split"] / f"tomato-s{seed}.png"
        row["h_read_cm"] = round(reading_from_frames(image, image.with_name(image.stem + "-b.png")), 2)
    with sheet.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    write_sheet()
