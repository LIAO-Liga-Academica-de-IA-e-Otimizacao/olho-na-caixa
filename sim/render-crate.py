"""One full crate, two stills: top and side.

Plastic crate 01. Fruit starts at random positions and rotations just above
the pile, then rigid body drops it in. The count is how many remain inside
after they settle. Pass the fruit after --, for example `-- tomato`.
"""

import importlib.util
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cycles_gpu import use_gpu

ROOT = Path("/home/dante/Code/projects/olho-na-caixa/sim/assets")
CRATE = ROOT / "crates/plastic-crate-01/plastic-crate-01.blend"


def chosen_label() -> str:
    if "--" in sys.argv:
        tail = sys.argv[sys.argv.index("--") + 1 :]
        if tail:
            return tail[0]
    return "tangerine"


LABEL = chosen_label()
if LABEL == "tomato":
    FRUIT = ROOT / "tomato/tomato-01.blend"
    SOURCE_NAME = "Tomato_01"
    TOP = ROOT / "preview/crate-01-tomato-top.png"
    SIDE = ROOT / "preview/crate-01-tomato-side.png"
    TRUTH = ROOT / "preview/crate-01-tomato.txt"
    # Larger than the tangerine fill, so the pour can stop on the rim.
    TARGET = 220
elif LABEL == "tangerine":
    FRUIT = ROOT / "tangerine/tangerine-01.blend"
    SOURCE_NAME = "Tangerine01"
    TOP = ROOT / "preview/crate-01-full-top.png"
    SIDE = ROOT / "preview/crate-01-full-side.png"
    TRUTH = ROOT / "preview/crate-01-full.txt"
    TARGET = 240
else:
    raise SystemExit(f"unknown fruit {LABEL}")


def load_variants():
    path = Path(__file__).resolve().parent / "render-variants.py"
    spec = importlib.util.spec_from_file_location("render_variants", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def march(depsgraph, origin, direction, limit):
    position = Vector(origin)
    step = direction.normalized() * 0.003
    guard = direction.normalized()
    for _ in range(int(limit / 0.003)):
        hit, location, *_rest = bpy.context.scene.ray_cast(depsgraph, position, guard)
        if hit and (location - position).length < 0.012:
            return location
        position += step
    return None


def opening(crate):
    """Inner floor, rim, and the four walls that a sideways ray actually hits."""
    corners = [crate.matrix_world @ Vector(corner) for corner in crate.bound_box]
    xs = [corner.x for corner in corners]
    ys = [corner.y for corner in corners]
    zs = [corner.z for corner in corners]
    center = Vector(((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, 0.0))
    rim_z = max(zs)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    floor_hit = march(depsgraph, center + Vector((0.0, 0.0, rim_z + 0.05)), Vector((0.0, 0.0, -1.0)), rim_z + 0.2)
    floor_z = floor_hit.z if floor_hit is not None else min(zs)
    limits = {"+x": [], "-x": [], "+y": [], "-y": []}
    directions = {
        "+x": Vector((1.0, 0.0, 0.0)),
        "-x": Vector((-1.0, 0.0, 0.0)),
        "+y": Vector((0.0, 1.0, 0.0)),
        "-y": Vector((0.0, -1.0, 0.0)),
    }
    for height in (0.03, 0.07, 0.11, 0.15, 0.19, 0.23):
        origin = Vector((center.x, center.y, floor_z + height))
        for name, direction in directions.items():
            hit = march(depsgraph, origin, direction, 0.28)
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


def center_mesh(mesh) -> None:
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


def assign_color(obj, spec) -> None:
    if spec is None:
        obj["fruit_hue"] = 0.5
        obj["fruit_sat"] = 1.0
        obj["fruit_val"] = 1.0
        obj["fruit_rough"] = 1.0
        obj["fruit_green"] = 0.0
        obj["fruit_cast"] = 0.5
        obj["fruit_shade"] = 1.0
        obj["fruit_spot"] = 0.5
        obj["fruit_band"] = 0.5
        obj["fruit_coat"] = 0.0
        obj["fruit_freq"] = 12.0
        return
    obj["fruit_hue"] = 0.5 + spec["hue"]
    obj["fruit_sat"] = spec["saturation"]
    obj["fruit_val"] = spec["value"]
    obj["fruit_rough"] = spec["roughness"]
    obj["fruit_green"] = spec["green"]
    obj["fruit_cast"] = 0.5 + spec["cast"]
    obj["fruit_shade"] = spec["shade"]
    obj["fruit_spot"] = spec["spot"]
    obj["fruit_band"] = spec["band"]
    obj["fruit_coat"] = spec["coat"]
    obj["fruit_freq"] = spec["frequency_scale"]


def make_fruit(variants, source, seed, location):
    spec = variants.parameters(seed, LABEL)
    obj = source.copy()
    obj.data = source.data.copy()
    obj.hide_render = False
    for modifier in obj.modifiers:
        if modifier.type == "SUBSURF":
            modifier.levels = 0
            modifier.render_levels = 1
    bpy.context.collection.objects.link(obj)
    if spec is not None:
        variants.deform(obj.data, spec)
    center_mesh(obj.data)
    assign_color(obj, spec)
    pose = random.Random(seed + 5000)
    obj.rotation_euler = (
        pose.uniform(0.0, math.tau),
        pose.uniform(0.0, math.tau),
        pose.uniform(0.0, math.tau),
    )
    obj.location = location
    return obj


def bounding_radius(obj) -> float:
    return max(vertex.co.length for vertex in obj.data.vertices)


def passive_box(name, location, dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = location
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.rigidbody.object_add()
    obj.rigid_body.type = "PASSIVE"
    obj.rigid_body.collision_shape = "BOX"
    obj.rigid_body.collision_margin = 0.002
    obj.rigid_body.friction = 0.8
    obj.hide_render = True
    obj.select_set(False)
    return obj


def build_container(bounds, cloud_top):
    width = bounds["max_x"] - bounds["min_x"]
    length = bounds["max_y"] - bounds["min_y"]
    wall = 0.25
    floor_thickness = 1.0
    tall = cloud_top - bounds["floor_z"] + 0.4
    mid_z = bounds["floor_z"] + tall * 0.5
    passive_box(
        "collision-floor",
        (bounds["center"].x, bounds["center"].y, bounds["floor_z"] - floor_thickness * 0.5),
        (width + wall * 2, length + wall * 2, floor_thickness),
    )
    passive_box(
        "collision-x-pos",
        (bounds["max_x"] + wall * 0.5, bounds["center"].y, mid_z),
        (wall, length + wall * 2, tall),
    )
    passive_box(
        "collision-x-neg",
        (bounds["min_x"] - wall * 0.5, bounds["center"].y, mid_z),
        (wall, length + wall * 2, tall),
    )
    passive_box(
        "collision-y-pos",
        (bounds["center"].x, bounds["max_y"] + wall * 0.5, mid_z),
        (width, wall, tall),
    )
    passive_box(
        "collision-y-neg",
        (bounds["center"].x, bounds["min_y"] - wall * 0.5, mid_z),
        (width, wall, tall),
    )


def free_spot(rng, bounds, radius, occupied, low_z, high_z):
    gap = 0.006
    low_x = bounds["min_x"] + radius + gap
    high_x = bounds["max_x"] - radius - gap
    low_y = bounds["min_y"] + radius + gap
    high_y = bounds["max_y"] - radius - gap
    low_z = low_z + radius
    high_z = high_z - radius * 0.2
    if high_x <= low_x or high_y <= low_y or high_z <= low_z:
        return None
    for _ in range(60):
        spot = (
            rng.uniform(low_x, high_x),
            rng.uniform(low_y, high_y),
            rng.uniform(low_z, high_z),
        )
        need_clear = True
        for other, other_radius in occupied:
            need = radius + other_radius + gap
            dx = spot[0] - other[0]
            dy = spot[1] - other[1]
            dz = spot[2] - other[2]
            if dx * dx + dy * dy + dz * dz < need * need:
                need_clear = False
                break
        if need_clear:
            return spot
    return None


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.rigidbody.object_add()
    body = obj.rigid_body
    body.collision_shape = "CONVEX_HULL"
    body.mass = 0.15
    body.friction = 0.7
    body.restitution = 0.02
    body.linear_damping = 0.25
    body.angular_damping = 0.35
    body.collision_margin = 0.002
    obj.select_set(False)


def build_fruits(variants, source):
    fruits = []
    for seed in range(1, TARGET + 1):
        fruits.append(make_fruit(variants, source, seed, (0.0, 0.0, -2.0)))
        if seed % 40 == 0:
            print(f"BUILT {seed}", flush=True)
    return fruits


def pile_top(fruits, floor_z):
    top = floor_z
    for obj in fruits:
        if obj.rigid_body is None:
            continue
        top = max(top, obj.matrix_world.translation.z)
    return top


def step_to(scene, frame):
    while scene.frame_current < frame:
        scene.frame_set(scene.frame_current + 1)


def pour(scene, fruits, bounds):
    """Release small random groups just above the pile so the fall stays short."""
    if scene.rigidbody_world is None:
        bpy.ops.rigidbody.world_add()
    world = scene.rigidbody_world
    world.substeps_per_frame = 12
    world.solver_iterations = 12
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 800
    world.point_cache.frame_start = 1
    world.point_cache.frame_end = 800
    build_container(bounds, bounds["rim_z"] + 0.45)
    scene.frame_set(1)
    rng = random.Random(4100)
    pending = list(fruits)
    frame = 1
    band = 0
    released = []
    while pending:
        top = pile_top(released, bounds["floor_z"])
        if band > 0 and top > bounds["rim_z"] + 0.02:
            break
        batch = pending[:24]
        pending = pending[24:]
        occupied = []
        low_z = top + 0.04
        high_z = low_z + 0.14
        for obj in batch:
            radius = bounding_radius(obj)
            spot = free_spot(rng, bounds, radius, occupied, low_z, high_z)
            if spot is None:
                spot = (
                    rng.uniform(bounds["min_x"] + 0.04, bounds["max_x"] - 0.04),
                    rng.uniform(bounds["min_y"] + 0.04, bounds["max_y"] - 0.04),
                    high_z + 0.03,
                )
            pose = random.Random(band * 1000 + len(occupied))
            obj.rotation_euler = (
                pose.uniform(0.0, math.tau),
                pose.uniform(0.0, math.tau),
                pose.uniform(0.0, math.tau),
            )
            obj.location = spot
            activate(obj)
            occupied.append((spot, radius))
            released.append(obj)
        frame += 32
        print(f"POUR band={band} n={len(released)} top_cm={top * 100:.1f} frame={frame}", flush=True)
        step_to(scene, frame)
        band += 1
    step_to(scene, scene.frame_current + 40)
    for obj in pending:
        obj.hide_render = True
    print(f"POURED {len(released)} held_back={len(pending)}", flush=True)
    return released


def keep_inside(fruits, bounds):
    crown = bounds["rim_z"] + 0.07
    kept = []
    heights = []
    for obj in fruits:
        point = obj.matrix_world.translation
        heights.append(point.z)
        inside = (
            bounds["min_x"] - 0.01 < point.x < bounds["max_x"] + 0.01
            and bounds["min_y"] - 0.01 < point.y < bounds["max_y"] + 0.01
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


def render_views(scene, bounds, fruits):
    world = bpy.data.worlds.new("crate-world")
    world.color = (0.74, 0.73, 0.70)
    scene.world = world
    sun_data = bpy.data.lights.new("crate-sun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = 0.18
    sun = bpy.data.objects.new("crate-sun", sun_data)
    sun.rotation_euler = (0.65, 0.12, 0.45)
    bpy.context.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(bounds["center"].x, bounds["center"].y, -0.002))
    plane = bpy.context.object
    floor = bpy.data.materials.new("crate-floor")
    floor.use_nodes = True
    floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.61, 0.58, 1.0)
    floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    plane.data.materials.append(floor)

    target = bpy.data.objects.new("crate-target", None)
    bpy.context.collection.objects.link(target)
    camera_data = bpy.data.cameras.new("crate-camera")
    camera_data.lens = 35
    camera_data.sensor_fit = "HORIZONTAL"
    camera = bpy.data.objects.new("crate-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    track = camera.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = camera

    center = bounds["center"]
    views = (
        (TOP, (center.x, center.y - 0.16, bounds["rim_z"] + 0.52), (center.x, center.y, bounds["rim_z"] - 0.04)),
        (SIDE, (bounds["min_x"] - 0.70, center.y - 0.02, center.z + 0.04), (center.x, center.y, center.z + 0.02)),
    )
    for output, location, aim in views:
        camera.location = location
        target.location = aim
        output.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        print(f"WROTE {output} fruits={len(fruits)}")


def write_truth(bounds, count):
    width = (bounds["max_x"] - bounds["min_x"]) * 100
    length = (bounds["max_y"] - bounds["min_y"]) * 100
    height = (bounds["rim_z"] - bounds["floor_z"]) * 100
    TRUTH.write_text(
        "\n".join(
            (
                "crate: plastic-crate-01",
                f"fruit: {LABEL}",
                f"count: {count}",
                "photos: top, side",
                f"opening_cm: {width:.1f} x {length:.1f} x {height:.1f}",
                "note: count is the fruit still inside after a drop from random positions",
                "",
            )
        )
    )
    print(f"WROTE {TRUTH}")


def main():
    variants = load_variants()
    bpy.ops.wm.open_mainfile(filepath=str(CRATE))
    scene = bpy.context.scene
    crate = bpy.data.objects["plastic_crate_01"]
    bounds = opening(crate)
    source = variants.load_source(FRUIT, SOURCE_NAME)
    source.location = (0.0, 0.0, -2.0)
    fruits = build_fruits(variants, source)
    fruits = pour(scene, fruits, bounds)
    fruits = keep_inside(fruits, bounds)
    if len(fruits) < 100:
        print(f"SETTLE_FAILED kept={len(fruits)}", flush=True)
        return
    use_gpu(scene)
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    render_views(scene, bounds, fruits)
    write_truth(bounds, len(fruits))


if __name__ == "__main__":
    main()
