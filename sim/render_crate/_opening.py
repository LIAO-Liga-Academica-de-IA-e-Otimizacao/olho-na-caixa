"""Inner floor, rim, and the four walls a sideways ray actually hits."""

from __future__ import annotations

import bpy
from mathutils import Vector

from ._config import Config


class OpeningProbe:
    def __init__(self, cfg: Config):
        self.cfg = cfg

    def measure(self, crate) -> dict:
        probe = self.cfg.OPENING
        corners = [crate.matrix_world @ Vector(corner) for corner in crate.bound_box]
        xs = [corner.x for corner in corners]
        ys = [corner.y for corner in corners]
        zs = [corner.z for corner in corners]
        center = Vector(((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, 0.0))
        rim_z = max(zs)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        floor_hit = self._march(
            depsgraph,
            center + Vector((0.0, 0.0, rim_z + probe.FLOOR_LIFT_M)),
            Vector((0.0, 0.0, -1.0)),
            rim_z + probe.FLOOR_LIMIT_EXTRA_M,
        )
        floor_z = floor_hit.z if floor_hit is not None else min(zs)
        limits = {"+x": [], "-x": [], "+y": [], "-y": []}
        directions = {
            "+x": Vector((1.0, 0.0, 0.0)),
            "-x": Vector((-1.0, 0.0, 0.0)),
            "+y": Vector((0.0, 1.0, 0.0)),
            "-y": Vector((0.0, -1.0, 0.0)),
        }
        for height in probe.SAMPLE_HEIGHTS_M:
            origin = Vector((center.x, center.y, floor_z + height))
            for name, direction in directions.items():
                hit = self._march(depsgraph, origin, direction, probe.WALL_LIMIT_M)
                if hit is not None:
                    limits[name].append(hit)
        return {
            "floor_z": floor_z,
            "rim_z": rim_z,
            "min_x": max(hit.x for hit in limits["-x"]),
            "max_x": min(hit.x for hit in limits["+x"]),
            "min_y": max(hit.y for hit in limits["-y"]),
            "max_y": min(hit.y for hit in limits["+y"]),
            "center": Vector((center.x, center.y, (floor_z + rim_z) * 0.5)),
        }

    def _march(self, depsgraph, origin, direction, limit):
        probe = self.cfg.OPENING
        position = Vector(origin)
        step = direction.normalized() * probe.STEP_M
        guard = direction.normalized()
        for _ in range(int(limit / probe.STEP_M)):
            hit, location, *_rest = bpy.context.scene.ray_cast(depsgraph, position, guard)
            if hit and (location - position).length < probe.HIT_M:
                return location
            position += step
        return None
