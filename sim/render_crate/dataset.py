"""Top stills plus a box for every cap. One Blender process, shared mesh, four samples."""

from __future__ import annotations

import json
import math
import random
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from detect.plan import CLASSES, LIGHT_SALT, POUR_SALT, jobs
from render_crate._config import Config
from render_crate._fruit import FruitBuilder, apply_visual_profile, sphere_record
from render_crate._opening import OpeningProbe
from render_crate._settle import SphereSettler
from render_crate._studio import StillStudio
from render_crate._variants import load_variants
from render_crate._visible import area_mean, median_diameter, visible_indices


WIDTH = 640
HEIGHT = 480
DETECT_DIR = "assets/detect"


class DatasetWriter:
    def __init__(self, cfg: Config | None = None, argv: list[str] | None = None):
        self.cfg = cfg or Config()
        self.argv = list(sys.argv if argv is None else argv)
        self.limit = _limit(self.argv)
        self.root = self.cfg.path(DETECT_DIR)
        self.probe = OpeningProbe(self.cfg)
        self.settler = SphereSettler(self.cfg)
        self.studio = StillStudio(self.cfg)

    def run(self) -> None:
        if "--sides" in self.argv:
            self.run_sides()
            return
        started = time.perf_counter()
        variants = load_variants(self.cfg.path(self.cfg.VARIANTS_SCRIPT))
        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        crate = bpy.data.objects[self.cfg.CRATE_OBJECT]
        bounds = self.probe.measure(crate)
        sources = {}
        for label in ("tangerine", "tomato"):
            fruit = self.cfg.FRUITS.get(label)
            source = variants.load_source(self.cfg.path(fruit.BLEND), fruit.SOURCE)
            source.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
            sources[label] = source
        from cycles_gpu import use_gpu

        use_gpu(scene)
        self.studio.apply_cycles(scene)
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
        scene.render.image_settings.file_format = "PNG"
        written = 0
        for job in jobs():
            if self.limit is not None and written >= self.limit:
                break
            self._scene(scene, variants, sources, bounds, job)
            written += 1
        _write_yaml(self.root)
        print(f"DATASET scenes={written} wall_s={time.perf_counter() - started:.1f}", flush=True)

    def run_sides(self) -> None:
        """Side stills of the tangerine scenes, and the silhouette height read from the pixels."""
        import csv

        from detect.profile import is_fruit, profile_mean
        from render_crate._settle import profile_meters

        started = time.perf_counter()
        variants = load_variants(self.cfg.path(self.cfg.VARIANTS_SCRIPT))
        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        crate = bpy.data.objects[self.cfg.CRATE_OBJECT]
        bounds = self.probe.measure(crate)
        fruit = self.cfg.FRUITS.get("tangerine")
        source = variants.load_source(self.cfg.path(fruit.BLEND), fruit.SOURCE)
        source.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
        from cycles_gpu import use_gpu

        use_gpu(scene)
        self.studio.apply_cycles(scene)
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
        scene.render.image_settings.file_format = "PNG"
        rows = []
        for job in jobs():
            if job["label"] != "tangerine":
                continue
            if self.limit is not None and len(rows) >= self.limit:
                break
            rows.append(self._side_scene(scene, variants, source, bounds, job, is_fruit, profile_mean, profile_meters))
        sheet = self.root / "height-sheet.csv"
        with sheet.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        print(f"SIDES scenes={len(rows)} wall_s={time.perf_counter() - started:.1f} sheet={sheet}", flush=True)

    def _side_scene(self, scene, variants, source, bounds, job, is_fruit, profile_mean, profile_meters) -> dict:
        seed = job["seed"]
        fruit = self.cfg.FRUITS.get("tangerine")
        fraction = random.Random(seed + self.cfg.FILL.FRACTION_SALT).uniform(
            self.cfg.FILL.MIN_FRACTION, self.cfg.FILL.MAX_FRACTION
        )
        count = max(1, round(fraction * fruit.CROWNED))
        builder = FruitBuilder(self.cfg, variants, source, "tangerine")
        fruits = builder.build(count)
        random.Random(seed + POUR_SALT).shuffle(fruits)
        bodies = [[0.0, 0.0, 0.0, *sphere_record(obj, builder.axes)] for obj in fruits]
        self.settler.settle(bodies, bounds, seed)
        for obj, body in zip(fruits, bodies):
            apply_visual_profile(obj, body, builder.axes)
            obj.location = (body[0] - body[6], body[1] - body[7], body[2] - body[8])
        bpy.context.view_layer.update()
        kept = self.settler.keep_inside(fruits, bounds)
        kept_ids = {obj.as_pointer() for obj in kept}
        kept_bodies = [body for obj, body in zip(fruits, bodies) if obj.as_pointer() in kept_ids]
        for body in kept_bodies:
            body[4] = body[3]
            body[5] = body[3]
        stem = f"tangerine-s{seed}"
        image = self.root / "sides" / job["split"] / f"{stem}.png"
        light = _light(seed)
        camera, _target = self.studio.render_views(
            scene, bounds, (_side_shot(self.cfg, bounds, image),), len(kept), light
        )
        bpy.context.view_layer.update()
        photo_m = _photo_profile(image, camera, scene, bounds, is_fruit, profile_mean)
        peak_m, sky_m = profile_meters(kept_bodies, bounds)
        row = {
            "seed": seed,
            "split": job["split"],
            "inside": len(kept),
            "d_cm": round(median_diameter(kept_bodies, visible_indices(kept_bodies, bounds)) * 100, 2),
            "h_area_cm": round(area_mean(kept_bodies, bounds) * 100, 2),
            "h_sky_cm": round(sky_m * 100, 2),
            "h_peak_cm": round(peak_m * 100, 2),
            "h_photo_cm": round(photo_m * 100, 2),
        }
        for obj in fruits:
            bpy.data.objects.remove(obj, do_unlink=True)
        print(
            f"SIDE {stem} split={job['split']} inside={row['inside']} "
            f"photo={row['h_photo_cm']} sky={row['h_sky_cm']} area={row['h_area_cm']}",
            flush=True,
        )
        return row

    def _scene(self, scene, variants, sources, bounds, job) -> None:
        label = job["label"]
        seed = job["seed"]
        fruit = self.cfg.FRUITS.get(label)
        fraction = random.Random(seed + self.cfg.FILL.FRACTION_SALT).uniform(
            self.cfg.FILL.MIN_FRACTION, self.cfg.FILL.MAX_FRACTION
        )
        count = max(1, round(fraction * fruit.CROWNED))
        builder = FruitBuilder(self.cfg, variants, sources[label], label)
        fruits = builder.build(count)
        random.Random(seed + POUR_SALT).shuffle(fruits)
        bodies = [[0.0, 0.0, 0.0, *sphere_record(obj, builder.axes)] for obj in fruits]
        self.settler.settle(bodies, bounds, seed)
        for obj, body in zip(fruits, bodies):
            apply_visual_profile(obj, body, builder.axes)
            obj.location = (body[0] - body[6], body[1] - body[7], body[2] - body[8])
        bpy.context.view_layer.update()
        kept = self.settler.keep_inside(fruits, bounds)
        kept_ids = {obj.as_pointer() for obj in kept}
        kept_bodies = [body for obj, body in zip(fruits, bodies) if obj.as_pointer() in kept_ids]
        stem = f"{label}-s{seed}"
        image = self.root / "images" / job["split"] / f"{stem}.png"
        light = _light(seed)
        shot = (_top_shot(self.cfg, bounds, image, light),)
        camera, _target = self.studio.render_views(scene, bounds, shot, len(kept), light)
        bpy.context.view_layer.update()
        shown = visible_indices(kept_bodies, bounds)
        boxes = []
        for index in shown:
            body = kept_bodies[index]
            box = _sphere_box(scene, camera, body[0], body[1], body[2], body[3])
            if box is not None:
                boxes.append(box)
        _write_label(self.root / "labels" / job["split"] / f"{stem}.txt", CLASSES[label], boxes)
        diameter = median_diameter(kept_bodies, shown)
        meta = {
            "label": label,
            "seed": seed,
            "split": job["split"],
            "inside": len(kept),
            "visible": len(shown),
            "boxed": len(boxes),
            "d_cm": round(diameter * 100, 2),
            "h_area_cm": round(area_mean(kept_bodies, bounds) * 100, 2),
            "class_id": CLASSES[label],
        }
        meta_path = self.root / "meta" / job["split"] / f"{stem}.json"
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        meta_path.write_text(json.dumps(meta), encoding="utf-8")
        if boxes:
            _check_center(image, boxes[0], label)
        for obj in fruits:
            bpy.data.objects.remove(obj, do_unlink=True)
        print(
            f"LABELED {stem} split={job['split']} inside={len(kept)} visible={len(shown)} boxed={len(boxes)}",
            flush=True,
        )


def _side_shot(cfg: Config, bounds: dict, image: Path):
    center = bounds["center"]
    beside = cfg.VIEWS.SIDE
    location = (
        bounds["min_x"] - beside.PAST_MIN_X_M,
        center.y + beside.OFFSET_Y_M,
        center.z + beside.OFFSET_Z_M,
    )
    aim = (center.x, center.y, center.z + beside.AIM_Z_M)
    return image, location, aim


def _opening_pixels(scene, camera, bounds, width, height):
    """Inner opening on the near wall, inset so the rim itself is not peel."""
    from bpy_extras.object_utils import world_to_camera_view

    samples = []
    for y in (bounds["min_y"], bounds["max_y"]):
        for z in (bounds["floor_z"], bounds["rim_z"]):
            ndc = world_to_camera_view(scene, camera, Vector((bounds["min_x"], y, z)))
            samples.append((ndc.x * width, (1.0 - ndc.y) * height))
    points = np.array(samples, dtype=np.float64)
    center = points.mean(axis=0)
    order = np.argsort(np.arctan2(points[:, 1] - center[1], points[:, 0] - center[0]))
    points = points[order]
    return center + (points - center) * 0.94


def _inside(xs, ys, polygon):
    """Pixels inside the opening. Either winding is accepted."""
    crosses = []
    for index in range(len(polygon)):
        ax, ay = polygon[index]
        bx, by = polygon[(index + 1) % len(polygon)]
        crosses.append((bx - ax) * (ys - ay) - (by - ay) * (xs - ax))
    stack = np.stack(crosses)
    return np.all(stack >= 0, axis=0) | np.all(stack <= 0, axis=0)


def _photo_profile(image, camera, scene, bounds, is_fruit, profile_mean) -> float:
    """Mean silhouette height, in meters, from peel pixels and the side camera."""
    loaded = bpy.data.images.load(str(image))
    width, height = loaded.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    loaded.pixels.foreach_get(pixels)
    bpy.data.images.remove(loaded)
    frame = pixels.reshape(height, width, 4)[::-1]
    red, green, blue = frame[:, :, 0], frame[:, :, 1], frame[:, :, 2]
    peak = np.maximum(np.maximum(red, green), blue)
    mask = (peak >= 0.25) & ~((green < 0.18) & (blue < 0.15)) & (
        (np.abs(red - green) >= 0.05) | (np.abs(green - blue) >= 0.05)
    ) & (red + green > blue + 0.15)
    opening = _opening_pixels(scene, camera, bounds, width, height)
    rows, cols = np.indices((height, width))
    mask &= _inside(cols, rows, opening)
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return 0.0
    sensor_width = camera.data.sensor_width
    sensor_height = sensor_width * height / width
    lens = camera.data.lens
    cam_x = ((xs + 0.5) / width - 0.5) * sensor_width / lens
    cam_y = (0.5 - (ys + 0.5) / height) * sensor_height / lens
    dirs_cam = np.stack((cam_x, cam_y, -np.ones_like(cam_x)), axis=1)
    rotation = np.array(camera.matrix_world.to_3x3())
    dirs = dirs_cam @ rotation.T
    origin = np.array(camera.matrix_world.translation)
    # The near wall is the ruler. A ray continued to the middle of the crate climbs past the fruit.
    scale = (bounds["min_x"] - origin[0]) / dirs[:, 0]
    points = origin + scale[:, None] * dirs
    y0, y1 = bounds["min_y"], bounds["max_y"]
    floor = bounds["floor_z"]
    keep = (scale > 0.0) & (points[:, 1] >= y0) & (points[:, 1] < y1) & (points[:, 2] > floor)
    hits = list(zip(points[keep, 1].tolist(), points[keep, 2].tolist()))
    return profile_mean(hits, y0, y1, floor)


def _top_shot(cfg: Config, bounds: dict, image: Path, light: dict):
    center = bounds["center"]
    above = cfg.VIEWS.TOP
    location = (
        center.x + light["dx"],
        center.y + above.OFFSET_Y_M + light["dy"],
        bounds["rim_z"] + above.HEIGHT_ABOVE_RIM_M * light["height_scale"],
    )
    aim = (center.x, center.y, bounds["rim_z"] - above.AIM_BELOW_RIM_M)
    return image, location, aim


def _light(seed: int) -> dict:
    rng = random.Random(seed + LIGHT_SALT)
    base = (0.65, 0.12, 0.45)
    return {
        "energy": rng.uniform(2.5, 6.5),
        "rotation": tuple(angle + rng.uniform(-0.18, 0.18) for angle in base),
        "world": [channel * rng.uniform(0.85, 1.05) for channel in (0.74, 0.73, 0.70)],
        "dx": rng.uniform(-0.02, 0.02),
        "dy": rng.uniform(-0.03, 0.03),
        "height_scale": rng.uniform(0.92, 1.08),
    }


def _sphere_box(scene, camera, x: float, y: float, z: float, radius: float):
    """Normalized box of the sphere silhouette. Image y grows downward."""
    origin = camera.matrix_world.translation
    center = Vector((x, y, z))
    toward = center - origin
    distance = toward.length
    if distance <= radius * 1.01:
        return None
    direction = toward / distance
    silhouette = center - direction * (radius * radius / distance)
    reach = radius * math.sqrt(max(0.0, 1.0 - (radius / distance) ** 2))
    helper = Vector((0.0, 0.0, 1.0)) if abs(direction.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    axis_u = direction.cross(helper).normalized()
    axis_v = direction.cross(axis_u).normalized()
    xs = []
    ys = []
    for step in range(16):
        angle = step * math.tau / 16
        point = silhouette + (axis_u * math.cos(angle) + axis_v * math.sin(angle)) * reach
        ndc = world_to_camera_view(scene, camera, point)
        xs.append(ndc.x)
        ys.append(1.0 - ndc.y)
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    if x1 <= 0.0 or y1 <= 0.0 or x0 >= 1.0 or y0 >= 1.0:
        return None
    x0, y0 = max(0.0, x0), max(0.0, y0)
    x1, y1 = min(1.0, x1), min(1.0, y1)
    width, height = x1 - x0, y1 - y0
    if width < 0.008 or height < 0.008:
        return None
    return ((x0 + x1) / 2, (y0 + y1) / 2, width, height)


def _write_label(path: Path, class_id: int, boxes: list[tuple[float, float, float, float]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for cx, cy, w, h in boxes]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def _write_yaml(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    text = (
        "path: .\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n"
        "  0: tangerine\n"
        "  1: tomato\n"
    )
    (root / "data.yaml").write_text(text, encoding="utf-8")


def _check_center(image: Path, box, label: str) -> None:
    """The first box center should land on peel, not on the grey crate."""
    loaded = bpy.data.images.load(str(image))
    width, height = loaded.size
    x = min(width - 1, max(0, int(box[0] * width)))
    y_top = min(height - 1, max(0, int(box[1] * height)))
    y = height - 1 - y_top
    red, green, blue, _alpha = loaded.pixels[(y * width + x) * 4 : (y * width + x) * 4 + 4]
    bpy.data.images.remove(loaded)
    peel = red > green + 0.05 and red > blue + 0.05
    print(
        f"CENTER {label} rgb=({red:.2f},{green:.2f},{blue:.2f}) peel={peel}",
        flush=True,
    )


def _limit(argv: list[str]) -> int | None:
    if "--limit" not in argv:
        return None
    return int(argv[argv.index("--limit") + 1])
