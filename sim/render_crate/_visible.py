"""Which settled spheres show a cap, and the mean height of that lid.

The cap rule is the same one used for the pour sheet: a sphere counts when the
area where it is the highest surface is at least half its equatorial disk.
Buried fruit stays out of the detector labels.
"""

from __future__ import annotations

import math


HALF_DISK = 0.5


def visible_indices(bodies: list[list[float]], bounds: dict, half_disk: float = HALF_DISK) -> list[int]:
    """Indices whose visible cap covers at least ``half_disk`` of the equator disk."""
    nx, ny = 90, 120
    width = bounds["max_x"] - bounds["min_x"]
    length = bounds["max_y"] - bounds["min_y"]
    cell = (width / nx) * (length / ny)
    hits = [0] * len(bodies)
    floor = bounds["floor_z"]
    for ix in range(nx):
        x = bounds["min_x"] + width * (ix + 0.5) / nx
        for iy in range(ny):
            y = bounds["min_y"] + length * (iy + 0.5) / ny
            best_i = None
            best_z = floor
            for index, body in enumerate(bodies):
                dx = x - body[0]
                dy = y - body[1]
                gap = body[3] * body[3] - dx * dx - dy * dy
                if gap <= 0.0:
                    continue
                height = body[2] + math.sqrt(gap)
                if height > best_z:
                    best_i = index
                    best_z = height
            if best_i is not None:
                hits[best_i] += 1
    shown = []
    for index, body in enumerate(bodies):
        fraction = hits[index] * cell / (math.pi * body[3] * body[3])
        if fraction >= half_disk:
            shown.append(index)
    return shown


def median_diameter(bodies: list[list[float]], indices: list[int]) -> float:
    diameters = sorted(2.0 * bodies[index][3] for index in indices)
    if not diameters:
        diameters = sorted(2.0 * body[3] for body in bodies)
    mid = len(diameters) // 2
    if len(diameters) % 2:
        return diameters[mid]
    return 0.5 * (diameters[mid - 1] + diameters[mid])


def area_mean(bodies: list[list[float]], bounds: dict) -> float:
    """Mean of the upper surface over the floor. Bare floor counts as zero."""
    floor = bounds["floor_z"]
    nx, ny = 36, 48
    total = 0.0
    width = bounds["max_x"] - bounds["min_x"]
    length = bounds["max_y"] - bounds["min_y"]
    for ix in range(nx):
        x = bounds["min_x"] + width * (ix + 0.5) / nx
        for iy in range(ny):
            y = bounds["min_y"] + length * (iy + 0.5) / ny
            top = floor
            for body in bodies:
                dx = x - body[0]
                dy = y - body[1]
                gap = body[3] * body[3] - dx * dx - dy * dy
                if gap > 0.0:
                    top = max(top, body[2] + math.sqrt(gap))
            total += top - floor
    return total / (nx * ny)
