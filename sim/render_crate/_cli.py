"""Command tail after Blender's ``--`` and the drawn fill."""

from __future__ import annotations

import random
import sys
from dataclasses import dataclass
from pathlib import Path

from ._config import Config


@dataclass(frozen=True)
class SceneRequest:
    label: str
    seed: int
    count: int
    fraction: float | None
    blend: Path
    source_name: str
    top: Path
    side: Path
    truth: Path


def request_from_argv(cfg: Config, argv: list[str] | None = None) -> SceneRequest:
    label, seed, requested = _parse(cfg, argv if argv is not None else sys.argv)
    fruit = cfg.FRUITS.get(label)
    if fruit is None:
        raise SystemExit(f"unknown fruit {label}")
    if requested is not None:
        count, fraction = requested, None
    else:
        fraction = random.Random(seed + cfg.FILL.FRACTION_SALT).uniform(
            cfg.FILL.MIN_FRACTION, cfg.FILL.MAX_FRACTION
        )
        count = max(1, round(fraction * fruit.CROWNED))
    stem = cfg.FILE_PATTERN.format(label=label, seed=seed, count=count)
    preview = cfg.path(cfg.PREVIEW_DIR)
    return SceneRequest(
        label=label,
        seed=seed,
        count=count,
        fraction=fraction,
        blend=cfg.path(fruit.BLEND),
        source_name=fruit.SOURCE,
        top=preview / f"{stem}-{cfg.VIEWS.TOP.SUFFIX}.png",
        side=preview / f"{stem}-{cfg.VIEWS.SIDE.SUFFIX}.png",
        truth=preview / f"{stem}.txt",
    )


def _parse(cfg: Config, argv: list[str]) -> tuple[str, int, int | None]:
    tail: list[str] = []
    if "--" in argv:
        tail = argv[argv.index("--") + 1 :]
    label = tail[0] if tail else cfg.DEFAULT_FRUIT
    seed = cfg.DEFAULT_SEED
    count = None
    index = 1
    while index < len(tail):
        if tail[index] == "--seed" and index + 1 < len(tail):
            seed = int(tail[index + 1])
            index += 2
        elif tail[index] == "--count" and index + 1 < len(tail):
            count = int(tail[index + 1])
            index += 2
        else:
            raise SystemExit(f"unknown argument {tail[index]}")
    if cfg.FRUITS.get(label) is None:
        raise SystemExit(f"unknown fruit {label}")
    if count is not None and count < 1:
        raise SystemExit("count must be positive")
    return label, seed, count
