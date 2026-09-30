"""Sphere settling. Each fruit drops into the lowest pocket it can reach, then the mesh is copied on."""

from __future__ import annotations

import math
import random

from ._config import Config

_WALK_STEPS = 16


class SphereSettler:
    def __init__(self, cfg: Config):
        self.cfg = cfg

    def settle(self, bodies: list[list[float]], bounds: dict, seed: int) -> None:
        """Mutate ``[x, y, z, r, r, r, ...]`` records. ``x, y, z`` is the sphere center."""
        rng = random.Random(seed + self.cfg.SETTLE.SALT)
        placed: list[list[float]] = []
        for body in bodies:
            self._drop_into_pocket(body, placed, bounds, rng)
            placed.append(body)
        # A fruit placed early can roll into a pocket that only exists once its neighbors have landed.
        for body in sorted(bodies, key=lambda item: item[2]):
            self._walk_down(body, bodies, bounds)
        peak, mean = profile_meters(bodies, bounds)
        print(
            f"SETTLED {len(bodies)} spheres mean_cm={mean * 100:.1f} peak_cm={peak * 100:.1f}",
            flush=True,
        )

    def _drop_into_pocket(self, body, placed, bounds, rng: random.Random) -> None:
        del rng
        radius = body[3]
        if not placed:
            x = bounds["min_x"] + radius
            y = bounds["min_y"] + radius
            body[0], body[1], body[2] = x, y, bounds["floor_z"] + radius
            return
        seed_x = bounds["min_x"]
        seed_y = bounds["min_y"]
        near = _Near(placed)
        best = None
        for x, y in _pocket_sites(body, placed, near):
            x, y = _clamp_xy(bounds, radius, x, y)
            z = _sphere_rest(x, y, radius, near.around(x, y, radius), bounds)
            # Lowest pocket first. The corner only breaks a tie, so the front stays packed.
            score = (round(z, 5), (x - seed_x) ** 2 + (y - seed_y) ** 2)
            if best is None or score < best[0]:
                best = (score, x, y, z)
        body[0], body[1], body[2] = best[1], best[2], best[3]
        self._walk_down(body, placed, bounds)

    def _walk_down(self, body, others, bounds) -> None:
        """Step sideways into a lower contact, the way a sphere rolls into a hole."""
        radius = body[3]
        near = _Near(others)
        step = radius * 0.65
        for _ in range(_WALK_STEPS):
            best_x, best_y, best_z = body[0], body[1], body[2]
            for turn in range(8):
                angle = turn * math.tau / 8
                x, y = _clamp_xy(
                    bounds,
                    radius,
                    body[0] + step * math.cos(angle),
                    body[1] + step * math.sin(angle),
                )
                z = _sphere_rest(x, y, radius, near.around(x, y, radius), bounds, skip=body)
                if z < best_z - 1e-5:
                    best_x, best_y, best_z = x, y, z
            if best_z >= body[2] - 1e-5:
                step *= 0.5
                if step < 0.001:
                    return
                continue
            body[0], body[1], body[2] = best_x, best_y, best_z

    def keep_inside(self, fruits, bounds: dict):
        settle = self.cfg.SETTLE
        crown = bounds["rim_z"] + settle.CROWN_ABOVE_RIM_M
        slack = settle.WALL_SLACK_M
        kept = []
        heights = []
        for obj in fruits:
            point = obj.matrix_world.translation
            heights.append(point.z)
            inside = (
                bounds["min_x"] - slack < point.x < bounds["max_x"] + slack
                and bounds["min_y"] - slack < point.y < bounds["max_y"] + slack
                and bounds["floor_z"] < point.z < crown
            )
            obj.hide_render = not inside
            if inside:
                kept.append(obj)
        heights.sort()
        if heights:
            print(
                f"INSIDE {len(kept)} of {len(fruits)} "
                f"z_cm={heights[0] * 100:.1f}..{heights[len(heights) // 2] * 100:.1f}..{heights[-1] * 100:.1f} "
                f"crown_z={crown:.3f}",
                flush=True,
            )
        return kept


def profile_meters(bodies: list[list[float]], bounds: dict, samples: int = 80) -> tuple[float, float]:
    """Peak and mean height of the side silhouette, measured from the inner floor."""
    y0 = bounds["min_y"]
    y1 = bounds["max_y"]
    floor = bounds["floor_z"]
    tops = []
    for index in range(samples):
        y = y0 + (y1 - y0) * (index + 0.5) / samples
        top = floor
        for body in bodies:
            dy = abs(y - body[1])
            hy = body[4]
            if dy >= hy:
                continue
            top = max(top, body[2] + body[5] * math.sqrt(1.0 - (dy / hy) ** 2))
        tops.append(top - floor)
    return max(tops), sum(tops) / len(tops)


class _Near:
    """Horizontal bins. A drop only tests spheres close enough to touch."""

    def __init__(self, bodies, cell: float = 0.08):
        self.cell = cell
        self.bins: dict[tuple[int, int], list] = {}
        for body in bodies:
            self.bins.setdefault(self._key(body[0], body[1]), []).append(body)

    def _key(self, x: float, y: float) -> tuple[int, int]:
        cell = self.cell
        return (math.floor(x / cell), math.floor(y / cell))

    def around(self, x: float, y: float, radius: float):
        reach = radius + 0.045
        span = max(1, math.ceil(reach / self.cell))
        ix, iy = self._key(x, y)
        found = []
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                found.extend(self.bins.get((ix + dx, iy + dy), ()))
        return found


def _pocket_sites(body, placed, near: _Near) -> list[tuple[float, float]]:
    """Points where this sphere touches two neighbors, plus a ring around an isolated one."""
    radius = body[3]
    sites = []
    seen = set()
    for left in placed:
        reach = radius + left[3]
        for turn in range(6):
            angle = turn * math.tau / 6
            sites.append((left[0] + reach * math.cos(angle), left[1] + reach * math.sin(angle)))
        for right in near.around(left[0], left[1], radius + left[3]):
            if right is left:
                continue
            pair = (id(left), id(right)) if id(left) < id(right) else (id(right), id(left))
            if pair in seen:
                continue
            seen.add(pair)
            sites.extend(_pair_pockets(left, right, radius))
    return sites


def _pair_pockets(left, right, radius: float) -> list[tuple[float, float]]:
    dx = right[0] - left[0]
    dy = right[1] - left[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-8:
        return []
    left_reach = radius + left[3]
    right_reach = radius + right[3]
    if dist > left_reach + right_reach or dist < abs(left_reach - right_reach):
        return []
    along = (dist * dist + left_reach * left_reach - right_reach * right_reach) / (2.0 * dist)
    height_sq = left_reach * left_reach - along * along
    if height_sq < 0.0:
        return []
    height = math.sqrt(height_sq)
    ux, uy = dx / dist, dy / dist
    base_x = left[0] + ux * along
    base_y = left[1] + uy * along
    return [
        (base_x - uy * height, base_y + ux * height),
        (base_x + uy * height, base_y - ux * height),
    ]


def _sphere_rest(x: float, y: float, radius: float, others, bounds: dict, skip=None) -> float:
    """Center height of a sphere dropped from above onto the fruit already placed."""
    rest = bounds["floor_z"] + radius
    for other in others:
        if other is skip:
            continue
        dx = x - other[0]
        dy = y - other[1]
        reach = radius + other[3]
        gap = reach * reach - dx * dx - dy * dy
        if gap <= 0.0:
            continue
        rest = max(rest, other[2] + math.sqrt(gap))
    return rest


def _clamp_xy(bounds: dict, radius: float, x: float, y: float) -> tuple[float, float]:
    x = min(max(x, bounds["min_x"] + radius), bounds["max_x"] - radius)
    y = min(max(y, bounds["min_y"] + radius), bounds["max_y"] - radius)
    return x, y
