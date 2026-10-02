"""The tomato lid line, frozen on the training crates and scored on the sheet."""

from __future__ import annotations

import csv
import unittest
from pathlib import Path

import numpy as np

from detect.fruit_height import CAMERAS
from detect.tomato_volume import lid_cm, reading_cm

SHEET = Path(__file__).resolve().parents[1] / "assets" / "detect" / "tomato-height-sheet.csv"


class TomatoVolumeTest(unittest.TestCase):
    def test_rim_and_spike_stay_out_of_the_median(self) -> None:
        floor = CAMERAS["floor_z"]
        near = CAMERAS["min_x"] + 0.01
        body = CAMERAS["min_x"] + 0.08

        def point(x: float, height_cm: float) -> np.ndarray:
            return np.array((x, 0.0, floor + height_cm / 100.0))

        points = [point(near, 40.0)] + [point(body, 10.0) for _ in range(6)] + [point(body, 30.0)]
        self.assertAlmostEqual(reading_cm(points), 10.0)

    def test_held_out_liters_stay_inside_10_percent(self) -> None:
        with SHEET.open() as handle:
            rows = list(csv.DictReader(handle))
        val = [row for row in rows if row["split"] == "val"]
        self.assertEqual(len(val), 16)
        worst = 0.0
        for row in val:
            truth = float(row["h_area_cm"])
            estimate = lid_cm(float(row["h_read_cm"]))
            relative = abs(estimate - truth) / truth
            worst = max(worst, relative)
            self.assertLessEqual(relative, 0.10, row["seed"])
        self.assertLess(worst, 0.07)


if __name__ == "__main__":
    unittest.main()
