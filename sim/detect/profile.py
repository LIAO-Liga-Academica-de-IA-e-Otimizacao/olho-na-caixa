"""Side-photo profile and the height-to-count line.

The photo measurement is the mean of the silhouette along the inner length.
Empty stretches count as zero. The line below the first layer is the dome
formula; above it, count rises by 8.859 fruits per centimeter.
"""

from __future__ import annotations

import math


SLOPE = 8.859
INTERCEPT = 15.57
SWITCH_CM = 5.5
PHI = math.pi / (3.0 * math.sqrt(3.0))
AREA_CM2 = 28.2 * 39.2


def is_fruit(red: float, green: float, blue: float) -> bool:
    """Peel, not the grey ground and not the dark red crate.

    The crate is red with almost no green. Tangerine peel keeps a green channel.
    """
    peak = max(red, green, blue)
    if peak < 0.25:
        return False
    if green < 0.18 and blue < 0.15:
        return False
    if abs(red - green) < 0.05 and abs(green - blue) < 0.05:
        return False
    return red + green > blue + 0.15


def intersect_plane(origin, direction, plane_x: float):
    """Point where a ray hits the plane x = plane_x. None if it never gets there."""
    if abs(direction[0]) < 1e-8:
        return None
    distance = (plane_x - origin[0]) / direction[0]
    if distance <= 0.0:
        return None
    return (
        origin[0] + distance * direction[0],
        origin[1] + distance * direction[1],
        origin[2] + distance * direction[2],
    )


def profile_mean(hits: list[tuple[float, float]], y0: float, y1: float, floor: float, bins: int = 80) -> float:
    """Mean silhouette height. A bin with no peel is the bare floor."""
    tops = [floor] * bins
    span = y1 - y0
    for y, z in hits:
        if y < y0 or y >= y1:
            continue
        index = min(bins - 1, int((y - y0) / span * bins))
        if z > tops[index]:
            tops[index] = z
    return sum(top - floor for top in tops) / bins


def count_from_height(height_cm: float, diameter_cm: float) -> float:
    """Tangerine units from the floor-average lid height.

    Below 5.5 cm the lid is still a dome and the packing fraction applies.
    Above that, units rise by about 8.9 fruits per centimeter on this crate.
    """
    if height_cm < SWITCH_CM:
        radius = 0.5 * diameter_cm
        volume = (4.0 / 3.0) * math.pi * radius ** 3
        return AREA_CM2 * (height_cm + diameter_cm / 6.0) * PHI / volume
    return INTERCEPT + SLOPE * height_cm
