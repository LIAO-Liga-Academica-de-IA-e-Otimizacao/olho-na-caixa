"""Lid height from two arc frames and three.

When the three-frame reading sits above the two-frame reading, the third
camera only saw the crown, and the two-frame reading is the lid. Otherwise
the three-frame reading is the lid: the extra frame removed false crosses.

The offset was fit on the 64 training crates. Leave-one-out on those crates
chose a margin of zero. The 16 held-out crates were scored after that freeze.
"""

from __future__ import annotations

from detect.profile import count_from_height

# area_cm = -4.221914 + 0.999599 * reading_cm, on the training crates.
LID_OFFSET_CM = -4.221914
LID_SLOPE = 0.999599


def lid_cm(two_cm: float, three_cm: float) -> float:
    """Height of the lid, in centimeters, after the training offset."""
    reading = two_cm if three_cm > two_cm else three_cm
    return LID_OFFSET_CM + LID_SLOPE * reading


def count_from_frames(two_cm: float, three_cm: float, diameter_cm: float) -> float:
    """Tangerine count from the two readings and the median visible diameter."""
    return count_from_height(lid_cm(two_cm, three_cm), diameter_cm)
