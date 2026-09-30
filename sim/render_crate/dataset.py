"""Top stills plus a box for every cap. One Blender process, shared mesh, four samples."""

from __future__ import annotations

import json
import math
import random
import sys
import time
from pathlib import Path

import bpy
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
        f"path: {root}\n"
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
