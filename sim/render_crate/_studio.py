"""Grey studio, one sun, and the two still cameras."""

from __future__ import annotations

import bpy

from ._config import Config


class StillStudio:
    """Sets the simplified Cycles look and renders one camera at a time."""

    def __init__(self, cfg: Config):
        self.cfg = cfg

    def apply_cycles(self, scene) -> None:
        cycles = self.cfg.CYCLES
        scene.cycles.samples = cycles.SAMPLES
        scene.cycles.use_denoising = cycles.USE_DENOISING
        scene.cycles.denoiser = cycles.DENOISER
        # OIDN on the CPU was about three seconds a frame. The path trace itself is a fraction of that.
        if hasattr(scene.cycles, "denoising_use_gpu"):
            scene.cycles.denoising_use_gpu = True
        scene.cycles.max_bounces = 3
        scene.cycles.diffuse_bounces = 1
        scene.cycles.glossy_bounces = 1
        scene.cycles.transmission_bounces = 2
        scene.cycles.volume_bounces = 0
        scene.cycles.use_adaptive_sampling = False
        scene.render.use_persistent_data = True
        scene.render.resolution_x = cycles.WIDTH
        scene.render.resolution_y = cycles.HEIGHT
        scene.view_settings.view_transform = cycles.VIEW_TRANSFORM
        scene.view_settings.look = cycles.LOOK

    def render(self, scene, bounds: dict, top, side, fruit_count: int) -> None:
        self.render_views(scene, bounds, self._shots(bounds, top, side), fruit_count)

    def render_views(self, scene, bounds: dict, shots, fruit_count: int, light: dict | None = None):
        """Grey studio and the given shots. ``light`` overrides the sun for a dataset frame."""
        self._clear_rig(scene)
        studio = self.cfg.STUDIO
        world = bpy.data.worlds.new("crate-world")
        world.color = tuple(light["world"]) if light and "world" in light else tuple(studio.WORLD_COLOR)
        scene.world = world
        sun_data = bpy.data.lights.new("crate-sun", "SUN")
        sun_data.energy = light["energy"] if light else studio.SUN_ENERGY
        sun_data.angle = studio.SUN_ANGLE
        sun = bpy.data.objects.new("crate-sun", sun_data)
        sun.rotation_euler = tuple(light["rotation"]) if light else tuple(studio.SUN_ROTATION)
        bpy.context.collection.objects.link(sun)
        center = bounds["center"]
        bpy.ops.mesh.primitive_plane_add(
            size=studio.FLOOR_SIZE_M,
            location=(center.x, center.y, studio.FLOOR_Z_M),
        )
        plane = bpy.context.object
        floor = bpy.data.materials.new("crate-floor")
        floor.use_nodes = True
        tint = light["floor"] if light and "floor" in light else (1.0, 1.0, 1.0)
        base = tuple(studio.FLOOR_COLOR)
        floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = tuple(
            channel * shade for channel, shade in zip(base, (*tint, 1.0))
        )
        floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = studio.FLOOR_ROUGHNESS
        plane.data.materials.append(floor)

        target = bpy.data.objects.new("crate-target", None)
        bpy.context.collection.objects.link(target)
        camera_data = bpy.data.cameras.new("crate-camera")
        camera_data.lens = studio.LENS_MM
        camera_data.sensor_fit = studio.SENSOR_FIT
        camera = bpy.data.objects.new("crate-camera", camera_data)
        bpy.context.collection.objects.link(camera)
        track = camera.constraints.new("TRACK_TO")
        track.target = target
        track.track_axis = "TRACK_NEGATIVE_Z"
        track.up_axis = "UP_Y"
        scene.camera = camera

        for output, location, aim in shots:
            camera.location = location
            target.location = aim
            output.parent.mkdir(parents=True, exist_ok=True)
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            print(f"WROTE {output} fruits={fruit_count}")
        self._rig = [sun, plane, target, camera]
        return camera, target

    def _clear_rig(self, scene) -> None:
        for obj in getattr(self, "_rig", []):
            bpy.data.objects.remove(obj, do_unlink=True)
        self._rig = []
        world = scene.world
        if world is not None and world.name.startswith("crate-world"):
            scene.world = None
            bpy.data.worlds.remove(world)

    def _shots(self, bounds: dict, top, side):
        center = bounds["center"]
        above = self.cfg.VIEWS.TOP
        beside = self.cfg.VIEWS.SIDE
        return (
            (
                top,
                (center.x, center.y + above.OFFSET_Y_M, bounds["rim_z"] + above.HEIGHT_ABOVE_RIM_M),
                (center.x, center.y, bounds["rim_z"] - above.AIM_BELOW_RIM_M),
            ),
            (
                side,
                (bounds["min_x"] - beside.PAST_MIN_X_M, center.y + beside.OFFSET_Y_M, center.z + beside.OFFSET_Z_M),
                (center.x, center.y, center.z + beside.AIM_Z_M),
            ),
        )
