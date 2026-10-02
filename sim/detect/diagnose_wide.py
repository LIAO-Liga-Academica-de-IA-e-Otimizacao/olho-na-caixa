"""Which wide-light knob breaks the frozen rig. No Blender needed.

The wide proof scenes (tangerine past seed 120, tomato past 1080) fail the
frozen rig far more often than the narrow ones. The light per scene is
deterministic in its seed, so this script regenerates it with
``render_crate.dataset._light`` and correlates each knob (sun energy, sun
angle swing, floor tint, world tint, top-camera jitter) with the frozen-line
error from ``score_new``. The top-camera jitter is a control: the arc
frames never see it, so its correlation should sit near zero.

    Usage, from the repo root::

        PYTHONPATH=sim sim/.venv/bin/python -m detect.diagnose_wide
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np

sys.modules.setdefault("bpy", MagicMock())
sys.modules.setdefault("bpy_extras", MagicMock())
sys.modules.setdefault("bpy_extras.object_utils", MagicMock())
sys.modules.setdefault("mathutils", MagicMock())

from detect.fruit_height import (  # noqa: E402
    ROOT,
    matched_points,
    matched_tops,
    matched_tops_three,
)
from detect.profile import count_from_height  # noqa: E402
from detect.tomato_volume import liters, reading_cm  # noqa: E402
from detect import rim_pose  # noqa: E402
from detect.crossval import (  # noqa: E402
    TANGERINE_DYS,
    TOMATO_DYS,
    _disk,
    _fold_rig,
)
from detect.score_new import (  # noqa: E402
    TOMATO_WIDE,
    TANGERINE_WIDE,
    score_new_tangerine,
    score_new_tomato,
)
from render_crate.dataset import _light  # noqa: E402

BASE_ROTATION = (0.65, 0.12, 0.45)
BASE_WORLD = (0.74, 0.73, 0.70)


def _knobs(seed: int, label: str) -> dict[str, float]:
    light = _light(seed, label)
    return {
        "energy": light["energy"],
        "swing": sum(abs(a - b) for a, b in zip(light["rotation"], BASE_ROTATION)),
        "floor": sum(abs(c - 1.0) for c in light["floor"]),
        "world": sum(abs(w / b - 1.0) for w, b in zip(light["world"], BASE_WORLD)),
        "cam_jitter": abs(light["dx"]) + abs(light["dy"]),
        "height_scale": abs(light["height_scale"] - 1.0),
    }


def _tri_n(sheet: str, seeds: list[int]) -> dict[int, int]:
    counts: dict[int, int] = {}
    with (ROOT / sheet).open() as handle:
        for row in csv.DictReader(handle):
            seed = int(float(row["seed"]))
            if seed in seeds and row.get("tri_n"):
                counts[seed] = int(float(row["tri_n"]))
    return counts


def diagnose(label: str, rels: list[tuple[int, float]], wide_cut: int, sheet: str) -> None:
    wide = [(seed, rel) for seed, rel in rels if seed > wide_cut]
    seeds = [seed for seed, _rel in wide]
    errors = np.array([abs(rel) for _seed, rel in wide])
    knobs = {name: np.array([_knobs(seed, label)[name] for seed in seeds]) for name in _knobs(seeds[0], label)}
    counts = _tri_n(sheet, seeds)
    knobs["tri_n"] = np.array([counts.get(seed, 0) for seed in seeds])
    print(f"{label}: {len(wide)} wide scenes, mean abs err {errors.mean():.1%}", flush=True)
    for name, values in knobs.items():
        if values.std() == 0:
            continue
        corr = float(np.corrcoef(values, errors)[0, 1])
        order = np.argsort(values)
        low = errors[order[: len(order) // 4]].mean()
        high = errors[order[3 * len(order) // 4 :]].mean()
        print(f"  {name}: corr {corr:+.2f} low-quart {low:.1%} high-quart {high:.1%}", flush=True)
    worst = sorted(wide, key=lambda entry: abs(entry[1]), reverse=True)[:8]
    for seed, rel in worst:
        print(f"  worst s{seed} {rel:+.0%} knobs={_knobs(seed, label)} tri_n={counts.get(seed)}", flush=True)


def main() -> None:
    rows = list(csv.DictReader((ROOT / "height-sheet.csv").open()))
    diagnose("tangerine", score_new_tangerine(rows), TANGERINE_WIDE, "height-sheet.csv")
    wide_self_test_tangerine(rows)
    rows = list(csv.DictReader((ROOT / "tomato-height-sheet.csv").open()))
    diagnose("tomato", score_new_tomato(rows), TOMATO_WIDE, "tomato-height-sheet.csv")
    wide_self_test_tomato(rows)


def wide_self_test_tangerine(rows: list[dict]) -> None:
    """Fit the rig and the line on half the wide scenes, score the other half.

    If the wide errors collapse, the matcher is fine and the narrow rig is
    what the hard light breaks. If they persist, the matching itself fails.
    """
    wide = [int(float(row["seed"])) for row in rows if int(float(row["seed"])) > TANGERINE_WIDE]
    fit, held = wide[::2], wide[1::2]
    stems = {seed: f"tangerine-s{seed}" for seed in wide}
    rig = _fold_rig("tangerine", fit, stems, TANGERINE_DYS)
    readings: dict[int, float] = {}
    for seed in wide:
        image = _disk("tangerine", seed, stems[seed], "")
        second = image.with_name(image.stem + "-b.png")
        third = image.with_name(image.stem + "-c.png")
        two = matched_tops(image, second, cameras=rig[:2])
        three = matched_tops_three(image, second, third, cameras=rig)
        two_cm = sum(two) / len(two) * 100.0 if two else 0.0
        three_cm = sum(three) / len(three) * 100.0 if three else 0.0
        readings[seed] = two_cm if three_cm > two_cm else three_cm
    truth = {int(float(row["seed"])): row for row in rows}
    line = rim_pose._fit_line(
        [readings[seed] for seed in fit if readings[seed]],
        [float(truth[seed]["h_area_cm"]) for seed in fit if readings[seed]],
    )
    print(f"tangerine wide-fit line: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
    rels = []
    for seed in held:
        if not readings[seed]:
            continue
        row = truth[seed]
        estimate = count_from_height(line[1] + line[0] * readings[seed], float(row["d_cm"]))
        rels.append((seed, (estimate - float(row["inside"])) / float(row["inside"])))
    outside = [f"s{seed} {rel:+.0%}" for seed, rel in rels if abs(rel) > 0.10]
    mae = sum(abs(rel) for _seed, rel in rels) / len(rels)
    print(f"tangerine wide self-test: n={len(rels)} mae {mae:.1%} outside {len(outside)} {', '.join(outside)}", flush=True)


def wide_self_test_tomato(rows: list[dict]) -> None:
    """Same split-half test for the tomato volume line."""
    wide = [int(float(row["seed"])) for row in rows if int(float(row["seed"])) > TOMATO_WIDE]
    fit, held = wide[::2], wide[1::2]
    stems = {seed: f"tomato-s{seed}" for seed in wide}
    rig = _fold_rig("tomato", fit, stems, TOMATO_DYS)
    readings: dict[int, float] = {}
    for seed in wide:
        image = _disk("tomato", seed, stems[seed], "")
        second = image.with_name(image.stem + "-b.png")
        points = matched_points(image, second, "tomato", rig)
        readings[seed] = reading_cm(points) if points else 0.0
    truth = {int(float(row["seed"])): row for row in rows}
    line = rim_pose._fit_line(
        [readings[seed] for seed in fit if readings[seed]],
        [float(truth[seed]["h_area_cm"]) for seed in fit if readings[seed]],
    )
    print(f"tomato wide-fit line: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
    rels = []
    for seed in held:
        if not readings[seed]:
            continue
        value = float(truth[seed]["h_area_cm"])
        height = line[1] + line[0] * readings[seed]
        rels.append((seed, (liters(height) - liters(value)) / liters(value)))
    outside = [f"s{seed} {rel:+.0%}" for seed, rel in rels if abs(rel) > 0.10]
    mae = sum(abs(rel) for _seed, rel in rels) / len(rels)
    print(f"tomato wide self-test: n={len(rels)} mae {mae:.1%} outside {len(outside)} {', '.join(outside)}", flush=True)


if __name__ == "__main__":
    main()
