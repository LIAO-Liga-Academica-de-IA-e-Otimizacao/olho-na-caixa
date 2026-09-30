import unittest

from detect.profile import count_from_height, intersect_plane, is_fruit, profile_mean


class ProfileTests(unittest.TestCase):
    def test_grey_ground_and_dark_crate_are_not_peel(self):
        self.assertFalse(is_fruit(0.74, 0.73, 0.70))
        self.assertFalse(is_fruit(0.45, 0.06, 0.05))
        self.assertTrue(is_fruit(0.85, 0.45, 0.08))

    def test_empty_bin_pulls_the_mean_down(self):
        mean = profile_mean([(0.0, 0.10)], y0=-1.0, y1=1.0, floor=0.0, bins=2)
        self.assertAlmostEqual(mean, 0.05)

    def test_ray_hits_the_mid_plane_in_front_of_the_camera(self):
        point = intersect_plane((-1.0, 0.0, 0.2), (1.0, 0.0, 0.1), 0.0)
        self.assertAlmostEqual(point[2], 0.3)
        self.assertIsNone(intersect_plane((1.0, 0.0, 0.0), (1.0, 0.0, 0.0), 0.0))

    def test_line_adds_about_nine_fruits_per_centimeter(self):
        low = count_from_height(10.0, 5.1)
        high = count_from_height(11.0, 5.1)
        self.assertAlmostEqual(high - low, 8.859, places=3)
        self.assertGreater(count_from_height(4.0, 5.1), 30)


if __name__ == "__main__":
    unittest.main()
