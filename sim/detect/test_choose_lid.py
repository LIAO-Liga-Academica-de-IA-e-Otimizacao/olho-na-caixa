import csv
import unittest
from pathlib import Path

from detect.choose_lid import count_from_frames, lid_cm


SHEET = Path(__file__).resolve().parents[1] / "assets" / "detect" / "height-sheet.csv"


class ChooseLidTests(unittest.TestCase):
    def test_a_higher_three_frame_reading_is_the_crown(self):
        crown = lid_cm(12.0, 14.0)
        self.assertAlmostEqual(crown, -4.221914 + 0.999599 * 12.0)

    def test_a_lower_three_frame_reading_is_the_lid(self):
        self.assertAlmostEqual(lid_cm(16.0, 14.0), -4.221914 + 0.999599 * 14.0)

    def test_every_recorded_crate_stays_inside_ten_percent(self):
        with SHEET.open() as handle:
            rows = list(csv.DictReader(handle))
        for row in rows:
            estimate = count_from_frames(float(row["h_fruit_cm"]), float(row["h_tri_cm"]), float(row["d_cm"]))
            truth = float(row["inside"])
            self.assertLessEqual(abs(estimate - truth) / truth, 0.10, row["seed"])


if __name__ == "__main__":
    unittest.main()
