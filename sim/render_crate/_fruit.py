"""One shared fruit mesh, instanced and parked below the crate until the settler places it."""

from __future__ import annotations

import math
import random

import bpy
from mathutils import Quaternion, Vector

from ._config import Config


class FruitBuilder:
    def __init__(self, cfg: Config, variants, source, label: str):
        self.cfg = cfg
        self.variants = variants
        self.source = source
        self.label = label

    def build(self, count: int):
        """One shared mesh. Size is the object scale; color stays on the object."""
        _center_mesh(self.source.data)
        self.axes = _half_axes(self.source.data)
        for modifier in self.source.modifiers:
            if modifier.type == "SUBSURF":
                modifier.show_render = False
                modifier.show_viewport = False
        fruits = []
        for seed in range(1, count + 1):
            fruits.append(self._make(seed))
        print(f"BUILT {count}", flush=True)
        return fruits

    def _make(self, seed: int):
        spec = self.variants.parameters(seed, self.label)
        obj = self.source.copy()
        obj.data = self.source.data
        obj.hide_render = False
        bpy.context.collection.objects.link(obj)
        scale = (1.0, 1.0, 1.0) if spec is None else spec["scale"]
        obj.scale = scale
        _assign_color(obj, spec, self.cfg)
        pose = random.Random(seed + self.cfg.MESH.POSE_SALT)
        # The stem pit is the +Z pole. This rotation is uniform, so the pit is not forced up.
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = _uniform_quaternion(pose)
        obj.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
        return obj


def sphere_record(obj, axes: tuple[float, float, float]) -> tuple[float, ...]:
    """Sphere volume of this pose, and a zero offset because the mesh is centered."""
    radius = _geometric_mean(_world_extents(obj, axes))
    return radius, radius, radius, 0.0, 0.0, 0.0


def apply_visual_profile(obj, body: list[float], axes: tuple[float, float, float]) -> None:
    """Replace the side-profile radii with the posed mesh. The settle sphere stays in ``body[3]``."""
    extents = _world_extents(obj, axes)
    body[4] = extents[1]
    body[5] = extents[2]


def _uniform_quaternion(rng: random.Random) -> Quaternion:
    """Haar-uniform random rotation. Component order is w, x, y, z."""
    u1 = rng.random()
    u2 = rng.uniform(0.0, math.tau)
    u3 = rng.uniform(0.0, math.tau)
    root = math.sqrt(1.0 - u1)
    return Quaternion((
        root * math.sin(u2),
        root * math.cos(u2),
        math.sqrt(u1) * math.sin(u3),
        math.sqrt(u1) * math.cos(u3),
    ))


def _half_axes(mesh) -> tuple[float, float, float]:
    xs = [vertex.co.x for vertex in mesh.vertices]
    ys = [vertex.co.y for vertex in mesh.vertices]
    zs = [vertex.co.z for vertex in mesh.vertices]
    return (
        (max(xs) - min(xs)) * 0.5,
        (max(ys) - min(ys)) * 0.5,
        (max(zs) - min(zs)) * 0.5,
    )


def _world_extents(obj, axes: tuple[float, float, float]) -> tuple[float, float, float]:
    """Ellipsoid support along world X, Y and Z after scale and rotation."""
    rotation = obj.rotation_quaternion.to_matrix()
    radii = tuple(axis * scale for axis, scale in zip(axes, obj.scale))
    return tuple(
        math.sqrt(sum((radii[column] * rotation[row][column]) ** 2 for column in range(3)))
        for row in range(3)
    )


def _geometric_mean(values: tuple[float, float, float]) -> float:
    return (values[0] * values[1] * values[2]) ** (1.0 / 3.0)


def _center_mesh(mesh) -> None:
    xs = [vertex.co.x for vertex in mesh.vertices]
    ys = [vertex.co.y for vertex in mesh.vertices]
    zs = [vertex.co.z for vertex in mesh.vertices]
    center = Vector((
        (min(xs) + max(xs)) * 0.5,
        (min(ys) + max(ys)) * 0.5,
        (min(zs) + max(zs)) * 0.5,
    ))
    for vertex in mesh.vertices:
        vertex.co -= center
    mesh.update()


def _assign_color(obj, spec, cfg: Config) -> None:
    center = cfg.MESH.ATTRIBUTE_CENTER
    neutral = cfg.NEUTRAL
    if spec is None:
        obj["fruit_hue"] = center
        obj["fruit_sat"] = neutral.SATURATION
        obj["fruit_val"] = neutral.VALUE
        obj["fruit_rough"] = neutral.ROUGHNESS
        obj["fruit_green"] = neutral.GREEN
        obj["fruit_cast"] = center
        obj["fruit_shade"] = neutral.SHADE
        obj["fruit_spot"] = neutral.SPOT
        obj["fruit_band"] = neutral.BAND
        obj["fruit_coat"] = neutral.COAT
        obj["fruit_freq"] = neutral.FREQUENCY
        return
    obj["fruit_hue"] = center + spec["hue"]
    obj["fruit_sat"] = spec["saturation"]
    obj["fruit_val"] = spec["value"]
    obj["fruit_rough"] = spec["roughness"]
    obj["fruit_green"] = spec["green"]
    obj["fruit_cast"] = center + spec["cast"]
    obj["fruit_shade"] = spec["shade"]
    obj["fruit_spot"] = spec["spot"]
    obj["fruit_band"] = spec["band"]
    obj["fruit_coat"] = spec["coat"]
    obj["fruit_freq"] = spec["frequency_scale"]
