"""One crate, two stills: sphere settle, then top and side."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cycles_gpu import use_gpu

from ._cli import SceneRequest, request_from_argv
from ._config import Config
from ._fruit import FruitBuilder, apply_visual_profile, sphere_record
from ._opening import OpeningProbe
from ._settle import SphereSettler
from ._studio import StillStudio
from ._truth import TruthWriter
from ._variants import load_variants


# The four preview crates. One Blender process renders all of them.
BATCH = (("tangerine", 5), ("tangerine", 1), ("tomato", 5), ("tomato", 1))


class Renderer:
    """Draw a fill, instance the mesh onto settled spheres, write two stills."""

    def __init__(self, cfg: Config | None = None, argv: list[str] | None = None):
        self.cfg = cfg or Config()
        self.argv = list(sys.argv if argv is None else argv)
        self.batch = "--batch" in self.argv
        self.request: SceneRequest | None = None if self.batch else request_from_argv(self.cfg, self.argv)
        self.probe = OpeningProbe(self.cfg)
        self.settler = SphereSettler(self.cfg)
        self.studio = StillStudio(self.cfg)
        self.truth = TruthWriter(self.cfg)

    def run(self) -> None:
        if self.batch:
            self.run_batch()
            return
        self._scene(self.request)

    def run_batch(self) -> None:
        started = time.perf_counter()
        for label, seed in BATCH:
            request = request_from_argv(self.cfg, ["--", label, "--seed", str(seed)])
            self._scene(request)
        print(f"BATCH_S {time.perf_counter() - started:.2f}", flush=True)

    def _scene(self, request: SceneRequest) -> None:
        print(
            f"SCENE {request.label} seed={request.seed} drawn={request.count} fraction={request.fraction}",
            flush=True,
        )
        variants = load_variants(self.cfg.path(self.cfg.VARIANTS_SCRIPT))
        bpy.ops.wm.open_mainfile(filepath=str(self.cfg.path(self.cfg.CRATE_BLEND)))
        scene = bpy.context.scene
        crate = bpy.data.objects[self.cfg.CRATE_OBJECT]
        bounds = self.probe.measure(crate)
        source = variants.load_source(request.blend, request.source_name)
        source.location = (0.0, 0.0, self.cfg.MESH.PARK_Z_M)
        started = time.perf_counter()
        builder = FruitBuilder(self.cfg, variants, source, request.label)
        fruits = builder.build(request.count)
        build_s = time.perf_counter() - started
        bodies = [[0.0, 0.0, 0.0, *sphere_record(obj, builder.axes)] for obj in fruits]
        self.settler.settle(bodies, bounds, request.seed)
        for obj, body in zip(fruits, bodies):
            apply_visual_profile(obj, body, builder.axes)
            obj.location = (body[0] - body[6], body[1] - body[7], body[2] - body[8])
        pack_s = time.perf_counter() - started - build_s
        bpy.context.view_layer.update()
        placed = list(zip(fruits, bodies))
        fruits = self.settler.keep_inside(fruits, bounds)
        minimum = max(1, int(round(request.count * self.cfg.FILL.KEEP_FRACTION)))
        if len(fruits) < minimum:
            print(f"SETTLE_FAILED kept={len(fruits)} drawn={request.count}", flush=True)
            return
        use_gpu(scene)
        self.studio.apply_cycles(scene)
        render_started = time.perf_counter()
        self.studio.render(scene, bounds, request.top, request.side, len(fruits))
        render_s = time.perf_counter() - render_started
        kept_bodies = [body for obj, body in placed if not obj.hide_render]
        self.truth.write(request, bounds, len(fruits), fruits, kept_bodies)
        print(
            f"TIMING build_s={build_s:.2f} pack_s={pack_s:.2f} render_s={render_s:.2f} "
            f"total_s={build_s + pack_s + render_s:.2f}",
            flush=True,
        )
