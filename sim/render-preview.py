"""One still of CC0 tangerines sitting in plastic crate 01. Not a simulation."""

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path("/home/dante/Code/projects/olho-na-caixa/sim/assets")
CRATE = ROOT / "crates/plastic-crate-01/plastic-crate-01.blend"
FRUIT = ROOT / "tangerine/tangerine-01.blend"
OUTPUT = ROOT / "preview/crate-01-tangerines.png"

bpy.ops.wm.open_mainfile(filepath=str(CRATE))
crate = bpy.data.objects["plastic_crate_01"]
corners = [crate.matrix_world @ Vector(corner) for corner in crate.bound_box]
min_x = min(corner.x for corner in corners)
max_x = max(corner.x for corner in corners)
min_y = min(corner.y for corner in corners)
max_y = max(corner.y for corner in corners)
min_z = min(corner.z for corner in corners)
max_z = max(corner.z for corner in corners)
center_x = (min_x + max_x) * 0.5
center_y = (min_y + max_y) * 0.5
depsgraph = bpy.context.evaluated_depsgraph_get()
hit, location, _normal, _index, _object, _matrix = bpy.context.scene.ray_cast(
    depsgraph,
    Vector((center_x, center_y, max_z + 0.2)),
    Vector((0.0, 0.0, -1.0)),
)
floor_z = location.z if hit else min_z + 0.1

with bpy.data.libraries.load(str(FRUIT), link=False) as (data_from, data_to):
    data_to.objects = [name for name in data_from.objects if name == "Tangerine01"]

source = data_to.objects[0]
bpy.context.collection.objects.link(source)
fruit_z = source.dimensions.z
pitch = max(source.dimensions.x, source.dimensions.y) * 1.05
inset = 0.035
floor = floor_z + fruit_z * 0.5
xs = []
x = min_x + inset + pitch * 0.5
while x < max_x - inset:
    xs.append(x)
    x += pitch
ys = []
y = min_y + inset + pitch * 0.5
while y < max_y - inset:
    ys.append(y)
    y += pitch

source.location = (xs[0], ys[0], floor)
index = 0
for y in ys:
    for x in xs:
        index += 1
        if index == 1:
            continue
        copy = source.copy()
        copy.data = source.data
        copy.location = (x, y, floor)
        copy.rotation_euler[2] = (index * 0.7) % math.tau
        bpy.context.collection.objects.link(copy)

center = Vector(((min_x + max_x) * 0.5, (min_y + max_y) * 0.5, min_z + 0.08))
target = bpy.data.objects.new("preview-target", None)
target.location = center
bpy.context.collection.objects.link(target)
camera_data = bpy.data.cameras.new("preview-camera")
camera_data.lens = 35
camera = bpy.data.objects.new("preview-camera", camera_data)
camera.location = center + Vector((0.28, -0.42, 0.38))
bpy.context.collection.objects.link(camera)
track = camera.constraints.new("TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
bpy.context.scene.camera = camera

sun_data = bpy.data.lights.new("preview-sun", "SUN")
sun_data.energy = 4
sun = bpy.data.objects.new("preview-sun", sun_data)
sun.rotation_euler = (0.9, 0.2, 0.6)
bpy.context.collection.objects.link(sun)
world = bpy.data.worlds.new("preview-world")
world.color = (0.62, 0.64, 0.66)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.film_transparent = False
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)
print(f"WROTE {OUTPUT} fruits={index}")
