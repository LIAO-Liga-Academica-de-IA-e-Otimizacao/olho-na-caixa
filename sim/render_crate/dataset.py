"""Top stills plus a box for every cap. One Blender process, shared mesh, four samples."""

from __future__ import annotations

import csv
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
    """One Blender process that settles crates and writes the stills the detector reads.

    ``run`` chooses the job from the command line. No flag writes the top stills
    and the YOLO boxes. ``--sides`` and ``--third`` are the tangerine arc.
    ``--arc tomato`` (or ``--tomato``) writes that item's three frames and the
    true lid height. A later item uses the same flag once it has a mesh and a
    seed range. ``--pairs`` rescores the silhouette shift. ``--seeds 85,90``
    renders only those jobs (new rows merge into the sheets, old rows stay).
    """

    def __init__(self, cfg: Config | None = None, argv: list[str] | None = None):
        self.cfg = cfg or Config()
        self.argv = list(sys.argv if argv is None else argv)
        self.limit = _limit(self.argv)
        self.seeds = _seeds(self.argv)
        self.root = self.cfg.path(DETECT_DIR)
        self.probe = OpeningProbe(self.cfg)
        self.settler = SphereSettler(self.cfg)
        self.studio = StillStudio(self.cfg)

    def _wanted(self, seed: int) -> bool:
        """True when *seed* passes the ``--seeds`` allow-list (or no list was given)."""
        return self.seeds is None or seed in self.seeds

    def run(self) -> None:
        """Dispatch to the top-stills job or to one of the arc jobs."""
        if "--pairs" in self.argv:
            self.score_pairs()
            return
        if "--arc" in self.argv:
            self.run_arc(_option(self.argv, "--arc"))
            return
        if "--tomato" in self.argv:
            self.run_arc("tomato")
            return
        if "--third" in self.argv:
            self.run_third()
            return
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
            if not self._wanted(job["seed"]):
                continue
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
            if not self._wanted(job["seed"]):
                continue
            rows.append(self._side_scene(scene, variants, source, bounds, job, is_fruit, profile_mean, profile_meters))
        sheet = self.root / "height-sheet.csv"
        _merge_sheet(sheet, rows)
        print(f"SIDES scenes={len(rows)} wall_s={time.perf_counter() - started:.1f} sheet={sheet}", flush=True)

    def run_third(self) -> None:
        """One more arc frame, on the other side of the first two. The stills already rendered stay."""
        from cycles_gpu import use_gpu

        started = time.perf_counter()
        variants = load_variants(self.cfg.path(self.cfg.VARIANTS_SCRIPT))
        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        bounds = self.probe.measure(bpy.data.objects[self.cfg.CRATE_OBJECT])
        fruit = self.cfg.FRUITS.get("tangerine")
        source = variants.load_source(self.cfg.path(fruit.BLEND), fruit.SOURCE)
        source.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
        use_gpu(scene)
        self.studio.apply_cycles(scene)
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
        scene.render.image_settings.file_format = "PNG"
        _record_third_camera(scene, self.cfg, bounds)
        written = 0
        for job in jobs():
            if job["label"] != "tangerine":
                continue
            if self.limit is not None and written >= self.limit:
                break
            if not self._wanted(job["seed"]):
                continue
            self._third_scene(scene, variants, source, bounds, job)
            written += 1
        print(f"THIRD scenes={written} wall_s={time.perf_counter() - started:.1f}", flush=True)

    def run_arc(self, label: str) -> None:
        """Three arc frames and the true mean lid, for one item that already has scenes.

        The pixel reader is separate. An item with no peel, such as carrot or
        banana, can be rendered once it has a mesh and a seed range. Matching
        centers across frames still refuses it until a peel and a height reader
        exist. ``--tomato`` is this method for the tomato.
        """
        import csv

        from cycles_gpu import use_gpu
        from detect.produce import item

        found = item(label)
        if found.seeds is None:
            raise SystemExit(found.note)
        started = time.perf_counter()
        variants = load_variants(self.cfg.path(self.cfg.VARIANTS_SCRIPT))
        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        bounds = self.probe.measure(bpy.data.objects[self.cfg.CRATE_OBJECT])
        fruit = self.cfg.FRUITS.get(label)
        if fruit is None:
            raise SystemExit(f"{label} has scenes but no mesh in crate.toml")
        source = variants.load_source(self.cfg.path(fruit.BLEND), fruit.SOURCE)
        source.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
        use_gpu(scene)
        self.studio.apply_cycles(scene)
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
        scene.render.image_settings.file_format = "PNG"
        rows = []
        for job in jobs():
            if job["label"] != label:
                continue
            if self.limit is not None and len(rows) >= self.limit:
                break
            if not self._wanted(job["seed"]):
                continue
            rows.append(self._arc_scene(scene, variants, source, bounds, job, label))
        sheet = self.root / f"{label}-height-sheet.csv"
        _merge_sheet(sheet, rows)
        print(f"ARC {label} scenes={len(rows)} wall_s={time.perf_counter() - started:.1f} sheet={sheet}", flush=True)

    def score_pairs(self) -> None:
        """Height from the shift between the two arc frames. The stills are already on disk."""
        import csv

        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        bounds = self.probe.measure(bpy.data.objects[self.cfg.CRATE_OBJECT])
        sheet = self.root / "height-sheet.csv"
        rows = list(csv.DictReader(sheet.open()))
        if self.limit is not None:
            rows = rows[: self.limit]
        for row in rows:
            seed = int(float(row["seed"]))
            image = self.root / "sides" / row["split"] / f"tangerine-s{seed}.png"
            shots = _rim_shots(bounds, image)
            rays = []
            for path, location, aim in shots:
                camera = _aim_camera(scene, self.cfg, location, aim)
                rays.append(_boundary_rays(path, camera, scene, bounds))
            height_m, met = _stereo_mean(rays[0], rays[1], bounds)
            row["h_stereo_cm"] = round(height_m * 100, 2)
            row["stereo_hit"] = round(met, 2)
            print(
                f"PAIR s{seed} stereo={row['h_stereo_cm']} hit={row['stereo_hit']} "
                f"photo={row['h_photo_cm']} area={row['h_area_cm']}",
                flush=True,
            )
        if self.limit is None:
            with sheet.open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
        print(f"PAIRS scenes={len(rows)} sheet={sheet}", flush=True)

    def _settle(self, variants, source, bounds, job, label: str):
        """Drop one item's fruit into the opening. The same path serves every label."""
        seed = job["seed"]
        fruit = self.cfg.FRUITS.get(label)
        fraction = random.Random(seed + self.cfg.FILL.FRACTION_SALT).uniform(
            self.cfg.FILL.MIN_FRACTION, self.cfg.FILL.MAX_FRACTION
        )
        count = max(1, round(fraction * fruit.CROWNED))
        builder = FruitBuilder(self.cfg, variants, source, label)
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
        return fruits, kept, kept_bodies

    def _side_scene(self, scene, variants, source, bounds, job, is_fruit, profile_mean, profile_meters) -> dict:
        seed = job["seed"]
        fruits, kept, kept_bodies = self._settle(variants, source, bounds, job, "tangerine")
        stem = f"tangerine-s{seed}"
        image = self.root / "sides" / job["split"] / f"{stem}.png"
        light = _light(seed, "tangerine")
        frames = []
        for shot in _rim_shots(bounds, image):
            camera, _target = self.studio.render_views(scene, bounds, (shot,), len(kept), light)
            bpy.context.view_layer.update()
            frames.append(_station_hits(shot[0], camera, scene, bounds))
        photo_m = _mean_height(_higher_tops(frames), bounds, profile_mean)
        frame_m = [_mean_height(frame, bounds, profile_mean) for frame in frames]
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
            f"photo={row['h_photo_cm']} frames={[round(height * 100, 2) for height in frame_m]} "
            f"sky={row['h_sky_cm']} area={row['h_area_cm']}",
            flush=True,
        )
        return row

    def _third_scene(self, scene, variants, source, bounds, job) -> None:
        seed = job["seed"]
        fruits, kept, _bodies = self._settle(variants, source, bounds, job, "tangerine")
        image = self.root / "sides" / job["split"] / f"tangerine-s{seed}.png"
        shot = _third_shot(bounds, image)
        self.studio.render_views(scene, bounds, (shot,), len(kept), _light(seed, "tangerine"))
        for obj in fruits:
            bpy.data.objects.remove(obj, do_unlink=True)
        print(f"THIRD tangerine-s{seed} split={job['split']} inside={len(kept)}", flush=True)

    def _arc_scene(self, scene, variants, source, bounds, job, label: str) -> dict:
        seed = job["seed"]
        fruits, kept, kept_bodies = self._settle(variants, source, bounds, job, label)
        image = self.root / "sides" / label / job["split"] / f"{label}-s{seed}.png"
        light = _light(seed, label)
        for shot in (*_rim_shots(bounds, image), _third_shot(bounds, image)):
            self.studio.render_views(scene, bounds, (shot,), len(kept), light)
        row = {
            "seed": seed,
            "split": job["split"],
            "inside": len(kept),
            "d_cm": round(median_diameter(kept_bodies, visible_indices(kept_bodies, bounds)) * 100, 2),
            "h_area_cm": round(area_mean(kept_bodies, bounds) * 100, 2),
        }
        for obj in fruits:
            bpy.data.objects.remove(obj, do_unlink=True)
        print(
            f"ARC {label}-s{seed} split={job['split']} inside={row['inside']} area={row['h_area_cm']}",
            flush=True,
        )
        return row

    def _scene(self, scene, variants, sources, bounds, job) -> None:
        label = job["label"]
        seed = job["seed"]
        fruits, kept, kept_bodies = self._settle(variants, sources[label], bounds, job, label)
        stem = f"{label}-s{seed}"
        image = self.root / "images" / job["split"] / f"{stem}.png"
        light = _light(seed, label)
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


def _rim_shots(bounds: dict, image: Path):
    """Two frames a few centimeters apart along the arc, both over the near rim.

    A bar that hides the fruit in one frame does not hide it in the other.
    Each station keeps the higher reading.
    """
    center = bounds["center"]
    aim = (center.x, center.y, bounds["rim_z"] - 0.05)
    return (
        (image, (bounds["min_x"] - 0.22, center.y, bounds["rim_z"] + 0.32), aim),
        (
            image.with_name(image.stem + "-b" + image.suffix),
            (bounds["min_x"] - 0.18, center.y + 0.08, bounds["rim_z"] + 0.38),
            aim,
        ),
    )


def _third_shot(bounds: dict, image: Path):
    """A third arc frame, shifted the other way along the crate and a little higher."""
    center = bounds["center"]
    aim = (center.x, center.y, bounds["rim_z"] - 0.05)
    return (
        image.with_name(image.stem + "-c" + image.suffix),
        (bounds["min_x"] - 0.15, center.y - 0.08, bounds["rim_z"] + 0.44),
        aim,
    )


def _record_third_camera(scene, cfg: Config, bounds: dict) -> None:
    """Store the third camera next to the two already used to match fruits."""
    path = Path(__file__).resolve().parents[1] / "detect" / "pair_cameras.json"
    data = json.loads(path.read_text())
    _image, location, aim = _third_shot(bounds, Path("frame.png"))
    camera = _aim_camera(scene, cfg, location, aim)
    record = {
        "origin": list(camera.matrix_world.translation),
        "rotation": [list(row) for row in camera.matrix_world.to_3x3()],
        "lens": camera.data.lens,
        "sensor_width": camera.data.sensor_width,
    }
    if len(data["cameras"]) >= 3:
        data["cameras"][2] = record
    else:
        data["cameras"].append(record)
    path.write_text(json.dumps(data, indent=2) + "\n")


def _aim_camera(scene, cfg: Config, location, aim):
    """Same lens and track constraint as the still, without rendering."""
    target = bpy.data.objects.get("pair-target")
    if target is None:
        target = bpy.data.objects.new("pair-target", None)
        bpy.context.collection.objects.link(target)
    camera = bpy.data.objects.get("pair-camera")
    if camera is None:
        data = bpy.data.cameras.new("pair-camera")
        data.lens = cfg.STUDIO.LENS_MM
        data.sensor_fit = cfg.STUDIO.SENSOR_FIT
        camera = bpy.data.objects.new("pair-camera", data)
        bpy.context.collection.objects.link(camera)
        track = camera.constraints.new("TRACK_TO")
        track.target = target
        track.track_axis = "TRACK_NEGATIVE_Z"
        track.up_axis = "UP_Y"
    target.location = aim
    camera.location = location
    scene.camera = camera
    bpy.context.view_layer.update()
    return camera


def _peel_mask(image, camera, scene, bounds):
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
    mask &= ~_far_lip_band(scene, camera, bounds, width, height)
    return mask, width, height


def _station_hits(image, camera, scene, bounds) -> list:
    """Fruit height at each station along the length. None where no pile is seen.

    The camera looks over the near rim, so the far wall is the backdrop. The
    peel pixel inside that lip is the back row. Its ray meets the plane one
    radius inside the far wall.
    """
    mask, width, height = _peel_mask(image, camera, scene, bounds)
    floor = bounds["floor_z"]
    plane_x = bounds["max_x"] - 0.026
    y0, y1 = bounds["min_y"], bounds["max_y"]
    stations = 80
    tops = []
    for index in range(stations):
        y = y0 + (y1 - y0) * (index + 0.5) / stations
        pixel = _first_peel_inside_far_rim(mask, scene, camera, bounds, y, width, height)
        point = None if pixel is None else _ray_on_plane(camera, pixel[0], pixel[1], width, height, plane_x)
        if point is None or not (floor < point[2] < bounds["rim_z"] + 0.08):
            tops.append(None)
        else:
            tops.append(point[2])
    return tops


def _higher_tops(frames: list[list]) -> list:
    """Per station, the frame in which the lattice hid less of the fruit."""
    combined = []
    for index in range(len(frames[0])):
        found = [frame[index] for frame in frames if frame[index] is not None]
        combined.append(max(found) if found else None)
    return combined


def _mean_height(tops: list, bounds: dict, profile_mean) -> float:
    """Mean silhouette. A station with no peel is the bare floor."""
    y0, y1 = bounds["min_y"], bounds["max_y"]
    stations = len(tops)
    hits = []
    for index, top in enumerate(tops):
        if top is None:
            continue
        y = y0 + (y1 - y0) * (index + 0.5) / stations
        hits.append((y, top))
    return profile_mean(hits, y0, y1, bounds["floor_z"], bins=stations)


def _far_lip_band(scene, camera, bounds, width: int, height: int, radius: int = 16):
    """Pixels on the far lip. Specular plastic there is not the fruit surface."""
    band = np.zeros((height, width), dtype=bool)
    for y in np.linspace(bounds["min_y"], bounds["max_y"], 48):
        for point in (
            (bounds["max_x"], y, bounds["rim_z"]),
            (bounds["max_x"] + 0.012, y, bounds["rim_z"] + 0.006),
            (bounds["max_x"] - 0.008, y, bounds["rim_z"] - 0.004),
        ):
            pixel = _pixel(scene, camera, point, width, height)
            if pixel is None:
                continue
            column, row = int(round(pixel[0])), int(round(pixel[1]))
            row0, row1 = max(0, row - radius), min(height, row + radius + 1)
            col0, col1 = max(0, column - radius), min(width, column + radius + 1)
            band[row0:row1, col0:col1] = True
    return band


def _first_peel_inside_far_rim(mask, scene, camera, bounds, y: float, width: int, height: int):
    """First peel pixel walking from outside the far lip into the crate."""
    rim = _pixel(scene, camera, (bounds["max_x"], y, bounds["rim_z"]), width, height)
    inward = _pixel(scene, camera, (bounds["max_x"] - 0.10, y, bounds["rim_z"] - 0.04), width, height)
    if rim is None or inward is None:
        return None
    direction = np.array(inward) - np.array(rim)
    length = float(np.hypot(direction[0], direction[1]))
    if length < 1.0:
        return None
    step = direction / length
    start = np.array(rim) - step * 40.0
    samples = []
    for index in range(280):
        point = start + step * index
        column = int(round(point[0]))
        row = int(round(point[1]))
        if column < 0 or row < 0 or column >= width or row >= height:
            continue
        samples.append((column, row, bool(mask[row, column])))
    # The pile is a solid mass of peel. A fruit in one lattice hole is a short run
    # separated from that mass by the bar. Crevices between fruits are shorter.
    window = 24
    solid = None
    for index in range(len(samples) - window):
        block = samples[index : index + window]
        if sum(1 for sample in block if sample[2]) >= 0.7 * window:
            solid = index
            break
    if solid is None:
        return None
    top = solid
    gap = 0
    cursor = solid
    while cursor > 0:
        cursor -= 1
        if samples[cursor][2]:
            gap = 0
            top = cursor
        else:
            gap += 1
            if gap > 8:
                break
    return samples[top][0], samples[top][1]


def _pixel(scene, camera, point, width: int, height: int):
    ndc = world_to_camera_view(scene, camera, Vector(point))
    if ndc.z <= 0.0:
        return None
    return (ndc.x * width, (1.0 - ndc.y) * height)


def _pixel_ray(camera, column: int, row: int, width: int, height: int):
    sensor_width = camera.data.sensor_width
    sensor_height = sensor_width * height / width
    lens = camera.data.lens
    cam_x = ((column + 0.5) / width - 0.5) * sensor_width / lens
    cam_y = (0.5 - (row + 0.5) / height) * sensor_height / lens
    rotation = np.array(camera.matrix_world.to_3x3())
    direction = np.array((cam_x, cam_y, -1.0)) @ rotation.T
    origin = np.array(camera.matrix_world.translation)
    return origin, direction


def _ray_on_plane(camera, column: int, row: int, width: int, height: int, plane_x: float):
    origin, direction = _pixel_ray(camera, column, row, width, height)
    if abs(direction[0]) < 1e-8:
        return None
    scale = (plane_x - origin[0]) / direction[0]
    if scale <= 0.0:
        return None
    return origin + scale * direction


def _boundary_rays(image, camera, scene, bounds) -> list:
    """Ray through the fruit edge at each station, or None when the station is bare."""
    mask, width, height = _peel_mask(image, camera, scene, bounds)
    y0, y1 = bounds["min_y"], bounds["max_y"]
    rays = []
    for index in range(80):
        y = y0 + (y1 - y0) * (index + 0.5) / 80
        pixel = _first_peel_inside_far_rim(mask, scene, camera, bounds, y, width, height)
        rays.append(None if pixel is None else _pixel_ray(camera, pixel[0], pixel[1], width, height))
    return rays


def _closest_point(origin_a, direction_a, origin_b, direction_b, gap_m: float = 0.03):
    """Midpoint where the two rays pass within gap_m. None when they miss."""
    direction_a = direction_a / np.linalg.norm(direction_a)
    direction_b = direction_b / np.linalg.norm(direction_b)
    across = origin_a - origin_b
    cross = float(np.dot(direction_a, direction_b))
    denom = 1.0 - cross * cross
    if denom < 1e-6:
        return None
    along_a = float(np.dot(direction_a, across))
    along_b = float(np.dot(direction_b, across))
    ta = (cross * along_b - along_a) / denom
    tb = (along_b - cross * along_a) / denom
    if ta <= 0.0 or tb <= 0.0:
        return None
    point_a = origin_a + ta * direction_a
    point_b = origin_b + tb * direction_b
    if np.linalg.norm(point_a - point_b) > gap_m:
        return None
    return (point_a + point_b) / 2.0


def _stereo_mean(rays_a: list, rays_b: list, bounds: dict) -> tuple[float, float]:
    """Mean height where the two frames see the same edge. A bare station is the floor.

    A station seen in only one frame, or whose rays miss, stays out of the mean:
    it is not proof of an empty stretch.
    """
    y0, y1 = bounds["min_y"], bounds["max_y"]
    floor = bounds["floor_z"]
    decided = []
    met = 0
    for ray_a, ray_b in zip(rays_a, rays_b):
        if ray_a is None and ray_b is None:
            decided.append(0.0)
            continue
        if ray_a is None or ray_b is None:
            continue
        mid = _closest_point(ray_a[0], ray_a[1], ray_b[0], ray_b[1])
        if mid is None:
            continue
        inside = (
            bounds["min_x"] < mid[0] < bounds["max_x"]
            and y0 <= mid[1] < y1
            and floor < mid[2] < bounds["rim_z"] + 0.08
        )
        if not inside:
            continue
        met += 1
        decided.append(float(mid[2] - floor))
    if not decided:
        return 0.0, 0.0
    return sum(decided) / len(decided), met / len(rays_a)


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


def _wide(seed: int, label: str) -> bool:
    """Proof-extension scenes (past the original catalog) get wider light.

    The original 80/40 scenes keep the narrow studio so their stills stay
    reproducible; the new proof tests the frozen rig under harder light.
    Seed numbers overlap between items, so the cutoff needs the label.
    """
    return seed > (1080 if label == "tomato" else 120)


def _light(seed: int, label: str) -> dict:
    rng = random.Random(seed + LIGHT_SALT)
    base = (0.65, 0.12, 0.45)
    wide = _wide(seed, label)
    energy = (1.8, 8.0) if wide else (2.5, 6.5)
    swing = 0.35 if wide else 0.18
    tint = (0.75, 1.15) if wide else (0.85, 1.05)
    return {
        "energy": rng.uniform(*energy),
        "rotation": tuple(angle + rng.uniform(-swing, swing) for angle in base),
        "world": [channel * rng.uniform(*tint) for channel in (0.74, 0.73, 0.70)],
        "floor": [rng.uniform(0.7, 1.3) if wide else 1.0 for _channel in range(3)],
        "dx": rng.uniform(-0.045, 0.045) if wide else rng.uniform(-0.02, 0.02),
        "dy": rng.uniform(-0.06, 0.06) if wide else rng.uniform(-0.03, 0.03),
        "height_scale": rng.uniform(0.88, 1.12) if wide else rng.uniform(0.92, 1.08),
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
    """Class names for items that already have a detector id. Later items stay out."""
    from detect.produce import detector_classes

    root.mkdir(parents=True, exist_ok=True)
    names = "\n".join(f"  {class_id}: {label}" for label, class_id in sorted(detector_classes().items(), key=lambda pair: pair[1]))
    text = f"path: .\ntrain: images/train\nval: images/val\nnames:\n{names}\n"
    (root / "data.yaml").write_text(text, encoding="utf-8")


def _option(argv: list[str], name: str) -> str:
    """Value of a ``--name value`` flag on the Blender command tail."""
    index = argv.index(name)
    if index + 1 >= len(argv):
        raise SystemExit(f"{name} needs a value")
    return argv[index + 1]


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


def _seeds(argv: list[str]) -> set[int] | None:
    """Seed allow-list from ``--seeds 85,90`` (render only these jobs)."""
    if "--seeds" not in argv:
        return None
    return {int(part) for part in _option(argv, "--seeds").split(",") if part.strip()}


def _merge_sheet(path: Path, rows: list[dict], key: str = "seed") -> None:
    """Upsert *rows* into an existing count sheet, keeping scorer-added columns.

    A blind rewrite would drop columns the scorer adds later (``h_read_cm``),
    so read the sheet first, replace rows whose key matches, append new ones,
    and write back the union of the field names.
    """
    old_rows: list[dict] = []
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            old_rows = list(csv.DictReader(handle))
    index = {row[key]: position for position, row in enumerate(old_rows)}
    for row in rows:
        string_row = {field: str(value) for field, value in row.items()}
        if string_row[key] in index:
            old_rows[index[string_row[key]]].update(string_row)
        else:
            index[string_row[key]] = len(old_rows)
            old_rows.append(string_row)
    fields: list[str] = []
    for row in old_rows:
        for field in row:
            if field not in fields:
                fields.append(field)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(old_rows)
