"""Grid of one CC0 fruit deformed by a seed. Not a crate scene.

Seed 0 is the mesh as published. Later seeds scatter inside one commercial
class, not across cultivars. The same seed draws the same shared numbers for
both fruits; the vertical scale and the hue width then follow the species.

Size, relative to the scan, for one class already packed in a crate:
uniform scale 0.92–1.08 (about 10 mm of tomato class, or 12 mm of Ponkan
class, on these meshes). Extra scale on x and y is 0.98–1.02. Tangerine z is
1.04–1.12 so height/diameter moves from about 0.78 toward the Ponkan means
0.82–0.88 (Guarçoni et al. 2018; Oliveira, Brunini and Nunes 2014). Tomato z
is 0.96–1.04. The scan itself stays below a mid Ponkan (about 5.3 cm versus
70–82 mm); a 1.45–1.55 caliber is a separate mean shift, not this scatter.

Color of an orange peel stays near the scan, about ±3° (Silva et al. 2014,
CIELAB hue 67.8°). A market crate also carries yellow peel and fruit whose
peel is still green. In northern Minas Gerais, Ponkan is harvested fully
green while the juice ratio is already about 10 (dos Santos da Costa et al.
2017). On the reference photos that green is olive, with red and green
almost equal. The rendered scan sits near HSV 38°, so the orange copies
turn back about 9° to 15° toward the reference orange, the yellow copies
stay near the scan, and about 7% of the copies are a darker olive over the
whole peel. The remaining copies keep the deeper orange and add one soft
blush toward yellow-green. That mix stays partial and the noise ramp is
wide, so the edge fades. A table-ripe tomato stays near hue 42° (López
Camelo and Gómez 2004). The rendered tomato scan sits near HSV 21°. About
10% of the copies are yellow-green over the whole fruit, and about 28%
keep a red region and a green region on the same fruit. The tomato skin
gets a clearcoat: the published roughness is 0.45 and the coat weight was
0, so the wax highlight was missing.

The published scan is a round, lightly pebbled fruit. Ponkan is described
with a depressed apex, a neck, and an irregular peel (morpho-agronomic
germplasm notes). At the IAC collection, Cascalho, Campeona and
Mexerica-do-Pará are rough and Natsu Mikan is very rough, while Clementina
runs from smooth to rough (Pio et al., Scientia Agricola). The apex depth
in millimetres is a descriptor in that protocol; the printed accession
text does not give the depths, so 3–7 mm is the visible depressive class,
not a copied measurement. Rough oil-gland relief is 1.2–2.2 mm on that
same qualitative scale.

Each block is 8 columns by 6 rows, rendered in its own pass. Seed 0 is the
back-left fruit. Reading order is left to right, then toward the camera.
Displacement stays a bump so Cycles does not tessellate.
"""

import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cycles_gpu import use_gpu

ROOT = Path("/home/dante/Code/projects/olho-na-caixa/sim/assets")
OUTPUTS = {
    "tangerine": ROOT / "preview/fruit-variants-tangerine.png",
    "tomato": ROOT / "preview/fruit-variants-tomato.png",
}
SHEET = ROOT / "preview/fruit-variants.png"
COLUMNS = 8
ROWS = 6
COUNT = COLUMNS * ROWS
SPACING_X = 0.115
SPACING_Y = 0.13
BLOCK_GAP = 0.22

FRUITS = (
    {
        "label": "tangerine",
        "path": ROOT / "tangerine/tangerine-01.blend",
        "object": "Tangerine01",
        "side": 1.0,
    },
    {
        "label": "tomato",
        "path": ROOT / "tomato/tomato-01.blend",
        "object": "Tomato_01",
        "side": -1.0,
    },
)


def parameters(seed: int, label: str) -> dict | None:
    if seed == 0:
        return None
    rng = random.Random(seed)
    uniform = rng.uniform(0.92, 1.08)
    sx = uniform * rng.uniform(0.98, 1.02)
    sy = uniform * rng.uniform(0.98, 1.02)
    if label == "tangerine":
        sz = uniform * rng.uniform(1.04, 1.12)
        hue = rng.uniform(-0.008, 0.008)
    else:
        sz = uniform * rng.uniform(0.96, 1.04)
        hue = rng.uniform(-0.006, 0.006)
    spec = {
        "scale": (sx, sy, sz),
        "amplitude": rng.uniform(0.0004, 0.0012),
        "frequency": rng.uniform(22.0, 40.0),
        "phase": Vector((rng.random(), rng.random(), rng.random())) * 8.0,
        "hue": hue,
        "saturation": rng.uniform(1.00, 1.08),
        "value": rng.uniform(0.97, 1.02),
        "roughness": 1.0,
        "green": 0.0,
        "cast": 0.0,
        "shade": 1.0,
        "spot": 0.5,
        "band": 0.50,
        "coat": 0.0,
        "frequency_scale": 12.0,
        "pit_depth": 0.0,
        "pit_radius": 0.012,
        "peel_amp": 0.0,
        "peel_freq": 120.0,
    }
    if label == "tangerine":
        # Separate stream so the shared draws above stay aligned with the tomato.
        extra = random.Random(seed + 9011)
        roll = extra.random()
        if roll < 0.42:
            # The scan renders near HSV 38°. The reference orange is nearer 23°.
            spec["hue"] = extra.uniform(-0.042, -0.026)
            spec["green"] = 0.0
        elif roll < 0.70:
            # Yellow stays near the scan, which already matches that peel.
            spec["hue"] = extra.uniform(0.006, 0.020)
            spec["value"] = extra.uniform(1.00, 1.06)
            spec["green"] = 0.0
        elif roll < 0.93:
            # Deep orange with one soft blush toward yellow-green. The mix
            # stays partial, so the patch does not become a second fruit.
            spec["hue"] = extra.uniform(-0.042, -0.026)
            spec["green"] = extra.uniform(0.62, 0.82)
            spec["cast"] = extra.uniform(0.10, 0.13)
            spec["shade"] = extra.uniform(0.82, 0.94)
            spec["spot"] = extra.uniform(0.02, 0.16)
            spec["band"] = extra.uniform(0.70, 0.95)
        else:
            # A few whole fruits. Olive: red close to green, darker than the orange.
            # The value cut is strong because AgX lifts a mild darkening back toward yellow.
            spec["hue"] = extra.uniform(0.10, 0.13)
            spec["value"] = extra.uniform(0.28, 0.38)
            spec["saturation"] = extra.uniform(0.78, 0.90)
            spec["green"] = 0.0
        if extra.random() < 0.42:
            spec["peel_amp"] = extra.uniform(0.0003, 0.0007)
        else:
            spec["pit_depth"] = extra.uniform(0.003, 0.007)
            spec["pit_radius"] = extra.uniform(0.009, 0.014)
            spec["peel_amp"] = extra.uniform(0.0012, 0.0022)
            spec["peel_freq"] = extra.uniform(100.0, 160.0)
    else:
        # Wax, not a second peel color. The scan roughness is 0.45 and the coat was off.
        extra = random.Random(seed + 12017)
        spec["roughness"] = extra.uniform(0.42, 0.62)
        spec["coat"] = extra.uniform(0.72, 1.0)
        roll = extra.random()
        if roll < 0.62:
            spec["green"] = 0.0
        elif roll < 0.80:
            # Red fruit with one soft green region. The wavelength has to
            # cross a 6 cm fruit, or the mix becomes one pale color.
            spec["green"] = extra.uniform(0.88, 1.0)
            spec["cast"] = extra.uniform(0.16, 0.22)
            spec["shade"] = extra.uniform(1.00, 1.10)
            spec["spot"] = extra.uniform(0.15, 0.40)
            spec["band"] = extra.uniform(0.28, 0.48)
            spec["frequency_scale"] = extra.uniform(26.0, 36.0)
        elif roll < 0.90:
            # Green fruit that still shows a red region.
            spec["hue"] = extra.uniform(0.16, 0.22)
            spec["value"] = extra.uniform(1.02, 1.14)
            spec["saturation"] = extra.uniform(0.84, 0.98)
            spec["green"] = extra.uniform(0.82, 1.0)
            spec["cast"] = extra.uniform(-0.20, -0.14)
            spec["shade"] = extra.uniform(0.95, 1.05)
            spec["spot"] = extra.uniform(0.15, 0.40)
            spec["band"] = extra.uniform(0.28, 0.48)
            spec["frequency_scale"] = extra.uniform(26.0, 36.0)
        else:
            spec["hue"] = extra.uniform(0.15, 0.22)
            spec["value"] = extra.uniform(1.06, 1.18)
            spec["saturation"] = extra.uniform(0.78, 0.95)
            spec["green"] = 0.0
    return spec


def deform(mesh, spec: dict) -> None:
    sx, sy, sz = spec["scale"]
    for vertex in mesh.vertices:
        vertex.co.x *= sx
        vertex.co.y *= sy
        vertex.co.z *= sz
    mesh.update()
    amplitude = spec["amplitude"]
    frequency = spec["frequency"]
    phase = spec["phase"]
    for vertex in mesh.vertices:
        sample = noise.noise(vertex.co * frequency + phase)
        vertex.co += vertex.normal * (sample * amplitude)
    mesh.update()
    deepen_apex(mesh, spec.get("pit_depth", 0.0), spec.get("pit_radius", 0.012))
    peel = spec.get("peel_amp", 0.0)
    if peel > 0.0:
        peel_frequency = spec["peel_freq"]
        for vertex in mesh.vertices:
            sample = abs(noise.noise(vertex.co * peel_frequency + phase + Vector((3.0, 1.0, 0.0))))
            vertex.co += vertex.normal * (sample * peel)
        mesh.update()


def deepen_apex(mesh, depth: float, radius: float) -> None:
    """Push the +Z pole inward. On this scan that pole is the top cap."""
    if depth <= 0.0:
        return
    z_max = max(vertex.co.z for vertex in mesh.vertices)
    for vertex in mesh.vertices:
        radial = (vertex.co.x * vertex.co.x + vertex.co.y * vertex.co.y) ** 0.5
        if radial >= radius:
            continue
        cap = 1.0 - (z_max - vertex.co.z) / (radius * 0.9)
        if cap <= 0.0:
            continue
        falloff = (1.0 - radial / radius) ** 2
        vertex.co.z -= depth * falloff * cap
    mesh.update()


def object_attribute(tree, name: str):
    node = tree.nodes.new("ShaderNodeAttribute")
    node.attribute_type = "OBJECT"
    node.attribute_name = name
    return node


def prepare_material(material) -> None:
    """One shared material. Per-fruit numbers are raw object attributes, not colors."""
    use_bump(material)
    tree = material.node_tree
    output = next(node for node in tree.nodes if node.type == "OUTPUT_MATERIAL")
    for link in list(tree.links):
        if link.to_node == output and link.to_socket.name == "Displacement":
            tree.links.remove(link)
    for node in list(tree.nodes):
        if node.type == "DISPLACEMENT":
            tree.nodes.remove(node)
    for node in list(tree.nodes):
        if node.type == "TEX_IMAGE" and not any(link.from_node == node for link in tree.links):
            tree.nodes.remove(node)
    bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    color_link = next(
        link
        for link in tree.links
        if link.to_node == bsdf and link.to_socket.name == "Base Color"
    )
    color_socket = color_link.from_socket
    tree.links.remove(color_link)
    hue = tree.nodes.new("ShaderNodeHueSaturation")
    hue_attr = object_attribute(tree, "fruit_hue")
    sat_attr = object_attribute(tree, "fruit_sat")
    val_attr = object_attribute(tree, "fruit_val")
    tree.links.new(hue_attr.outputs["Fac"], hue.inputs["Hue"])
    tree.links.new(sat_attr.outputs["Fac"], hue.inputs["Saturation"])
    tree.links.new(val_attr.outputs["Fac"], hue.inputs["Value"])
    tree.links.new(color_socket, hue.inputs["Color"])
    green_shift = tree.nodes.new("ShaderNodeHueSaturation")
    cast_attr = object_attribute(tree, "fruit_cast")
    shade_attr = object_attribute(tree, "fruit_shade")
    tree.links.new(cast_attr.outputs["Fac"], green_shift.inputs["Hue"])
    tree.links.new(shade_attr.outputs["Fac"], green_shift.inputs["Value"])
    green_shift.inputs["Saturation"].default_value = 0.95
    tree.links.new(hue.outputs["Color"], green_shift.inputs["Color"])
    coordinates = tree.nodes.new("ShaderNodeTexCoord")
    mottling = tree.nodes.new("ShaderNodeTexNoise")
    mottling.noise_dimensions = "3D"
    mottling.inputs["Detail"].default_value = 0.0
    mottling.inputs["Roughness"].default_value = 0.25
    tree.links.new(coordinates.outputs["Object"], mottling.inputs["Vector"])
    freq_attr = object_attribute(tree, "fruit_freq")
    tree.links.new(freq_attr.outputs["Fac"], mottling.inputs["Scale"])
    spot_attr = object_attribute(tree, "fruit_spot")
    band_attr = object_attribute(tree, "fruit_band")
    spot_end = tree.nodes.new("ShaderNodeMath")
    spot_end.operation = "ADD"
    tree.links.new(band_attr.outputs["Fac"], spot_end.inputs[1])
    tree.links.new(spot_attr.outputs["Fac"], spot_end.inputs[0])
    spread = tree.nodes.new("ShaderNodeMapRange")
    spread.interpolation_type = "SMOOTHERSTEP"
    spread.clamp = True
    spread.inputs["To Min"].default_value = 0.0
    spread.inputs["To Max"].default_value = 1.0
    tree.links.new(mottling.outputs["Fac"], spread.inputs["Value"])
    tree.links.new(spot_attr.outputs["Fac"], spread.inputs["From Min"])
    tree.links.new(spot_end.outputs["Value"], spread.inputs["From Max"])
    coverage = tree.nodes.new("ShaderNodeMath")
    coverage.operation = "MULTIPLY"
    green_attr = object_attribute(tree, "fruit_green")
    tree.links.new(spread.outputs["Result"], coverage.inputs[0])
    tree.links.new(green_attr.outputs["Fac"], coverage.inputs[1])
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    tree.links.new(coverage.outputs["Value"], mix.inputs["Fac"])
    tree.links.new(hue.outputs["Color"], mix.inputs["Color1"])
    tree.links.new(green_shift.outputs["Color"], mix.inputs["Color2"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    roughness = bsdf.inputs["Roughness"]
    if not roughness.is_linked:
        scale = tree.nodes.new("ShaderNodeMath")
        scale.operation = "MULTIPLY"
        scale.inputs[0].default_value = roughness.default_value
        rough_attr = object_attribute(tree, "fruit_rough")
        tree.links.new(rough_attr.outputs["Fac"], scale.inputs[1])
        tree.links.new(scale.outputs["Value"], roughness)
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None and not coat.is_linked:
        coat_attr = object_attribute(tree, "fruit_coat")
        tree.links.new(coat_attr.outputs["Fac"], coat)
    coat_rough = bsdf.inputs.get("Coat Roughness")
    if coat_rough is not None and not coat_rough.is_linked:
        coat_rough.default_value = 0.05
    linked = [
        link.to_socket.name
        for link in tree.links
        if link.to_node == output
    ]
    cycles = getattr(material, "cycles", None)
    cycles_method = getattr(cycles, "displacement_method", None)
    print(
        f"DISPLACEMENT_METHOD material={getattr(material, 'displacement_method', None)} "
        f"cycles={cycles_method} output={linked}"
    )


def use_bump(material) -> None:
    cycles = getattr(material, "cycles", None)
    if cycles is not None and hasattr(cycles, "displacement_method"):
        cycles.displacement_method = "BUMP"
    if hasattr(material, "displacement_method"):
        material.displacement_method = "BUMP"


def load_source(path: Path, name: str):
    with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
        data_to.objects = [object_name for object_name in data_from.objects if object_name == name]
    source = data_to.objects[0]
    bpy.context.collection.objects.link(source)
    source.hide_render = True
    for material in source.data.materials:
        if material is not None:
            prepare_material(material)
    return source


def grid_position(index: int) -> tuple[float, float]:
    column = index % COLUMNS
    row = index // COLUMNS
    x = (column - (COLUMNS - 1) / 2) * SPACING_X
    y = ((ROWS - 1) / 2 - row) * SPACING_Y
    return x, y


def place(obj, x: float, y: float) -> None:
    bpy.context.view_layer.update()
    corners = [Vector(corner) for corner in obj.bound_box]
    center_x = sum(corner.x for corner in corners) / 8
    center_y = sum(corner.y for corner in corners) / 8
    bottom = min(corner.z for corner in corners)
    obj.location = (x - center_x, y - center_y, -bottom)


def variant(source, seed: int, x: float, y: float, label: str):
    obj = source.copy()
    obj.data = source.data.copy()
    obj.hide_render = False
    for modifier in obj.modifiers:
        if modifier.type == "SUBSURF":
            modifier.levels = 1
            modifier.render_levels = 2
    bpy.context.collection.objects.link(obj)
    spec = parameters(seed, label)
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
    else:
        deform(obj.data, spec)
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
    obj.rotation_euler = (0.55, 0.0, 0.4)
    place(obj, x, y)
    bpy.context.view_layer.update()
    size = tuple(round(axis * 100, 1) for axis in obj.dimensions)
    if spec is None:
        print(f"VARIANT {label} seed={seed} cm={size} original")
        return obj
    scale = tuple(round(axis, 3) for axis in spec["scale"])
    print(
        f"VARIANT {label} seed={seed} cm={size} scale={scale} "
        f"bump_mm={spec['amplitude'] * 1000:.2f} hue={spec['hue']:+.3f} "
        f"sat={spec['saturation']:.2f} value={spec['value']:.2f} "
        f"green={spec['green']:.2f} cast={spec['cast']:+.3f} pit_mm={spec['pit_depth'] * 1000:.1f} "
        f"peel_mm={spec['peel_amp'] * 1000:.2f}"
    )
    return obj


def frame(camera, target, objects, scene) -> None:
    bpy.context.view_layer.update()
    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    center = sum(points, Vector()) / len(points)
    target.location = (center.x, center.y, center.z)
    camera.location = center + Vector((0.0, -1.35, 1.05))
    bpy.context.view_layer.update()
    axes = camera.matrix_world.to_3x3()
    right = axes @ Vector((1.0, 0.0, 0.0))
    up = axes @ Vector((0.0, 1.0, 0.0))
    horizontal = [(point - center).dot(right) for point in points]
    vertical = [(point - center).dot(up) for point in points]
    width = max(horizontal) - min(horizontal)
    height = max(vertical) - min(vertical)
    aspect = scene.render.resolution_x / scene.render.resolution_y
    camera.data.ortho_scale = max(width, height * aspect) * 1.08
    print(f"FRAME width={width:.3f} height={height:.3f} ortho={camera.data.ortho_scale:.3f}")


def render_block(fruit: dict) -> str:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    device = use_gpu(scene)
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1900
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"

    source = load_source(fruit["path"], fruit["object"])
    placed = []
    for seed in range(COUNT):
        x, y = grid_position(seed)
        placed.append(variant(source, seed, x, y, fruit["label"]))

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0.0, 0.0, 0.0))
    plane = bpy.context.object
    floor = bpy.data.materials.new("preview-floor")
    floor.use_nodes = True
    floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (
        0.72,
        0.72,
        0.70,
        1.0,
    )
    floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    plane.data.materials.append(floor)

    world = bpy.data.worlds.new("preview-world")
    world.color = (0.78, 0.78, 0.76)
    scene.world = world

    sun_data = bpy.data.lights.new("preview-sun", "SUN")
    sun_data.energy = 3.5
    sun_data.angle = 0.15
    sun = bpy.data.objects.new("preview-sun", sun_data)
    sun.rotation_euler = (0.7, 0.15, 0.8)
    bpy.context.collection.objects.link(sun)

    target = bpy.data.objects.new("preview-target", None)
    bpy.context.collection.objects.link(target)
    camera_data = bpy.data.cameras.new("preview-camera")
    camera_data.type = "ORTHO"
    camera_data.sensor_fit = "HORIZONTAL"
    camera = bpy.data.objects.new("preview-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    track = camera.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = camera
    frame(camera, target, placed, scene)

    output = OUTPUTS[fruit["label"]]
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"WROTE {output} fruits={len(placed)} device={device}")
    return device


def stack_sheets() -> None:
    top = bpy.data.images.load(str(OUTPUTS["tangerine"]))
    bottom = bpy.data.images.load(str(OUTPUTS["tomato"]))
    width, height = top.size
    if tuple(bottom.size) != (width, height):
        raise RuntimeError(f"sheet size mismatch {top.size} vs {bottom.size}")
    gap = 36
    sheet = bpy.data.images.new("fruit-variants-sheet", width, height * 2 + gap, alpha=False)
    gray = [0.78, 0.78, 0.76, 1.0] * (width * gap)
    sheet.pixels.foreach_set(list(bottom.pixels) + gray + list(top.pixels))
    sheet.filepath_raw = str(SHEET)
    sheet.file_format = "PNG"
    sheet.save()
    print(f"WROTE {SHEET} fruits={COUNT * 2}")


def main() -> None:
    wanted = None
    if "--" in sys.argv:
        tail = sys.argv[sys.argv.index("--") + 1 :]
        if tail:
            wanted = tail[0]
    fruits = [fruit for fruit in FRUITS if wanted is None or fruit["label"] == wanted]
    if not fruits:
        raise SystemExit(f"unknown fruit {wanted}")
    for fruit in fruits:
        render_block(fruit)
    if wanted is None:
        stack_sheets()


if __name__ == "__main__":
    main()
