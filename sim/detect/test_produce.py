"""The catalog is the extension point. Carrot and banana reuse an account and nothing else."""

from __future__ import annotations

import unittest

from detect.plan import CLASSES, jobs
from detect.produce import item, require_peel


class ProduceCatalogTest(unittest.TestCase):
    def test_detector_jobs_stay_the_two_items_already_rendered(self) -> None:
        rows = jobs()
        self.assertEqual(len(rows), 136)
        self.assertEqual(CLASSES, {"tangerine": 0, "tomato": 1})
        self.assertEqual(sum(1 for row in rows if row["label"] == "tangerine"), 88)
        self.assertEqual(sum(1 for row in rows if row["label"] == "tomato"), 48)

    def test_carrot_reuses_liters_and_banana_reuses_bunches(self) -> None:
        self.assertEqual(item("carrot").account, item("tomato").account)
        self.assertEqual(item("banana").account, "bunches")
        self.assertIsNone(item("carrot").seeds)
        self.assertIsNone(item("banana").seeds)

    def test_an_item_without_a_peel_says_what_is_missing(self) -> None:
        with self.assertRaises(ValueError) as raised:
            require_peel("carrot")
        self.assertIn("height reader", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
