import unittest
from pathlib import Path

import numpy as np

from detect.fruit_height import CAMERAS, ROOT, project
from detect.rim_pose import _mouth_model, camera_from_corners, mouth_corners

SIDES = ROOT / "sides"


class RimPoseTests(unittest.TestCase):
    def test_exact_mouth_corners_recover_the_stored_camera(self):
        camera = CAMERAS["cameras"][0]
        pixels = np.array([project(camera, point) for point in _mouth_model()])
        recovered = camera_from_corners(pixels)
        origin = np.asarray(recovered["origin"])
        self.assertLess(float(np.linalg.norm(origin - np.asarray(camera["origin"]))), 0.002)

    def test_train_still_corners_land_near_the_projected_mouth(self):
        # Train stills only. The truth projection is the ruler, not an input.
        cases = [
            ("train/tangerine-s3.png", 0),
            ("train/tangerine-s3-b.png", 1),
            ("train/tangerine-s3-c.png", 2),
        ]
        for stem, index in cases:
            pixels = mouth_corners(SIDES / stem)
            truth = np.array([project(CAMERAS["cameras"][index], point) for point in _mouth_model()])
            worst = float(np.linalg.norm(pixels - truth, axis=1).max())
            self.assertLess(worst, 25.0, f"{stem} worst corner {worst:.0f} px")


if __name__ == "__main__":
    unittest.main()
