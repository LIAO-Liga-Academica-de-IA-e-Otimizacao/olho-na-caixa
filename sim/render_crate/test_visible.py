"""Cap rule: a buried sphere is not a detection."""

import unittest

from render_crate._visible import area_mean, visible_indices


BOUNDS = {
    "min_x": -0.2,
    "max_x": 0.2,
    "min_y": -0.2,
    "max_y": 0.2,
    "floor_z": 0.0,
    "rim_z": 0.3,
}


class VisibleTests(unittest.TestCase):
    def test_upper_sphere_hides_the_one_under_it(self):
        lower = [0.0, 0.0, 0.05, 0.05]
        upper = [0.0, 0.0, 0.14, 0.05]
        shown = visible_indices([lower, upper], BOUNDS)
        self.assertEqual(shown, [1])

    def test_separated_spheres_are_both_caps(self):
        left = [-0.08, 0.0, 0.05, 0.05]
        right = [0.08, 0.0, 0.05, 0.05]
        shown = visible_indices([left, right], BOUNDS)
        self.assertEqual(shown, [0, 1])

    def test_mean_height_is_the_cap_not_the_floor(self):
        body = [0.0, 0.0, 0.05, 0.05]
        mean = area_mean([body], BOUNDS)
        self.assertGreater(mean, 0.0)
        self.assertLess(mean, 0.10)


if __name__ == "__main__":
    unittest.main()
