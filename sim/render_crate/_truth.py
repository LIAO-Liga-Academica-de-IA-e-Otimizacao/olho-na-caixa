"""Text file next to the stills: drawn count, kept count, peak and mean height."""

from __future__ import annotations

from ._cli import SceneRequest
from ._config import Config
from ._settle import profile_meters


class TruthWriter:
    def __init__(self, cfg: Config):
        self.cfg = cfg

    def write(self, request: SceneRequest, bounds: dict, count: int, fruits, bodies) -> None:
        del fruits
        peak_m, mean_m = profile_meters(bodies, bounds)
        width = (bounds["max_x"] - bounds["min_x"]) * 100
        length = (bounds["max_y"] - bounds["min_y"]) * 100
        height = (bounds["rim_z"] - bounds["floor_z"]) * 100
        fraction = "fixed" if request.fraction is None else f"{request.fraction:.3f}"
        request.truth.write_text(
            "\n".join(
                (
                    f"crate: {self.cfg.CRATE_ID}",
                    f"fruit: {request.label}",
                    f"seed: {request.seed}",
                    f"drawn: {request.count}",
                    f"count: {count}",
                    f"fraction: {fraction}",
                    f"mean_cm: {mean_m * 100:.1f}",
                    f"top_cm: {peak_m * 100:.1f}",
                    "photos: top, side",
                    f"opening_cm: {width:.1f} x {length:.1f} x {height:.1f}",
                    "note: mean_cm is the side profile of the posed mesh and the height the count uses; top_cm is the highest point",
                    "",
                )
            )
        )
        print(f"WROTE {request.truth}")
