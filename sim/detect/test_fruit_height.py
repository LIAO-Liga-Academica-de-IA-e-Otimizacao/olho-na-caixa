import unittest

from detect.fruit_height import _roundtrip_error


class FruitHeightTests(unittest.TestCase):
    def test_a_known_point_triangulates_back_to_itself(self):
        self.assertLess(_roundtrip_error(), 1e-3)


if __name__ == "__main__":
    unittest.main()
