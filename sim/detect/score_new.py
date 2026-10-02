"""Score the proof-crate scenes with the frozen published rig and line.

The rig poses and the reading line are fit on the ORIGINAL train scenes
only (seed % 5 != 0, seeds up to 80 / 1040). The new proof scenes
(up to 120 / 1080) are scored without refitting anything, so they test
the published constants, not a new fit.

    Usage, from the repo root::

        PYTHONPATH=sim sim/.venv/bin/python -m detect.score_new
"""

from __future__ import annotations

import csv

from detect import rim_pose
from detect.crossval import (
    TANGERINE_DYS,
    TOMATO_DYS,
    _disk,
    _fold_rig,
    _summarize,
)
from detect.fruit_height import ROOT, matched_points, matched_tops, matched_tops_three
from detect.profile import count_from_height
from detect.tomato_volume import liters, reading_cm

TANGERINE_CUTOFF = 80
TOMATO_CUTOFF = 1040
TANGERINE_WIDE = 120
TOMATO_WIDE = 1080


def _split(rows: list[dict], cutoff: int) -> tuple[list[dict], list[int]]:
    old = [row for row in rows if int(float(row["seed"])) <= cutoff]
    new = [int(float(row["seed"])) for row in rows if int(float(row["seed"])) > cutoff]
    assert new and all(seed % 5 == 0 for seed in new), new
    return old, new


def score_new_tangerine(rows: list[dict]) -> list[tuple[int, float]]:
    old, new = _split(rows, TANGERINE_CUTOFF)
    stems = {int(float(row["seed"])): f"tangerine-s{int(float(row['seed']))}" for row in old}
    train = [seed for seed in stems if seed % 5 != 0]
    rig = _fold_rig("tangerine", train, stems, TANGERINE_DYS)
    new_stems = {seed: f"tangerine-s{seed}" for seed in new}
    readings: dict[int, float] = {}
    for seed in list(stems) + new:
        stem = stems[seed] if seed in stems else new_stems[seed]
        image = _disk("tangerine", seed, stem, "")
        second = image.with_name(image.stem + "-b.png")
        third = image.with_name(image.stem + "-c.png")
        two = matched_tops(image, second, cameras=rig[:2])
        three = matched_tops_three(image, second, third, cameras=rig)
        two_cm = sum(two) / len(two) * 100.0 if two else 0.0
        three_cm = sum(three) / len(three) * 100.0 if three else 0.0
        readings[seed] = two_cm if three_cm > two_cm else three_cm
    line = rim_pose._fit_line(
        [readings[seed] for seed in train if readings[seed]],
        [
            float(next(row["h_area_cm"] for row in old if int(float(row["seed"])) == seed))
            for seed in train
            if readings[seed]
        ],
    )
    print(f"tangerine frozen line: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
    truth = {int(float(row["seed"])): row for row in rows}
    rels = []
    for seed in new:
        if not readings[seed]:
            print(f"  s{seed} no reading", flush=True)
            continue
        row = truth[seed]
        height = line[1] + line[0] * readings[seed]
        estimate = count_from_height(height, float(row["d_cm"]))
        rels.append((seed, (estimate - float(row["inside"])) / float(row["inside"])))
    _summarize("tangerine new proof scenes", rels)
    narrow = [(seed, rel) for seed, rel in rels if seed <= TANGERINE_WIDE]
    wide = [(seed, rel) for seed, rel in rels if seed > TANGERINE_WIDE]
    _summarize("tangerine narrow proof scenes", narrow)
    _summarize("tangerine wide proof scenes", wide)
    for seed, rel in wide:
        print(f"WIDE-TANGERINE s{seed} {rel:+.1%}", flush=True)
    old_val = []
    for seed in stems:
        if seed % 5 != 0 or not readings[seed]:
            continue
        row = truth[seed]
        height = line[1] + line[0] * readings[seed]
        estimate = count_from_height(height, float(row["d_cm"]))
        old_val.append((seed, (estimate - float(row["inside"])) / float(row["inside"])))
    _summarize("tangerine combined val (old + new)", old_val + rels)
    return rels


def score_new_tomato(rows: list[dict]) -> list[tuple[int, float]]:
    old, new = _split(rows, TOMATO_CUTOFF)
    stems = {int(float(row["seed"])): f"tomato-s{int(float(row['seed']))}" for row in old}
    train = [seed for seed in stems if seed % 5 != 0]
    rig = _fold_rig("tomato", train, stems, TOMATO_DYS)
    readings: dict[int, float] = {}
    for seed in list(stems) + new:
        stem = stems.get(seed, f"tomato-s{seed}")
        image = _disk("tomato", seed, stem, "")
        second = image.with_name(image.stem + "-b.png")
        points = matched_points(image, second, "tomato", rig)
        readings[seed] = reading_cm(points) if points else 0.0
    line = rim_pose._fit_line(
        [readings[seed] for seed in train if readings[seed]],
        [
            float(next(row["h_area_cm"] for row in old if int(float(row["seed"])) == seed))
            for seed in train
            if readings[seed]
        ],
    )
    print(f"tomato frozen line: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
    truth = {int(float(row["seed"])): row for row in rows}
    rels = []
    for seed in new:
        if not readings[seed]:
            print(f"  s{seed} no reading", flush=True)
            continue
        row = truth[seed]
        height = line[1] + line[0] * readings[seed]
        value = float(row["h_area_cm"])
        rels.append((seed, (liters(height) - liters(value)) / liters(value)))
    _summarize("tomato new proof scenes", rels)
    narrow = [(seed, rel) for seed, rel in rels if seed <= TOMATO_WIDE]
    wide = [(seed, rel) for seed, rel in rels if seed > TOMATO_WIDE]
    _summarize("tomato narrow proof scenes", narrow)
    _summarize("tomato wide proof scenes", wide)
    for seed, rel in wide:
        print(f"WIDE-TOMATO s{seed} {rel:+.1%}", flush=True)
    old_val = []
    for seed in stems:
        if seed % 5 != 0 or not readings[seed]:
            continue
        row = truth[seed]
        height = line[1] + line[0] * readings[seed]
        value = float(row["h_area_cm"])
        old_val.append((seed, (liters(height) - liters(value)) / liters(value)))
    _summarize("tomato combined val (old + new)", old_val + rels)
    return rels


def main() -> None:
    print("tangerine", flush=True)
    rows = list(csv.DictReader((ROOT / "height-sheet.csv").open()))
    score_new_tangerine(rows)
    print("tomato", flush=True)
    rows = list(csv.DictReader((ROOT / "tomato-height-sheet.csv").open()))
    score_new_tomato(rows)


if __name__ == "__main__":
    main()
