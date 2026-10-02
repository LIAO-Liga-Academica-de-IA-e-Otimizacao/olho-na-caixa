"""Five-fold cross-validation of the calibrated arc, no Blender needed.

Fold f holds out the seeds with seed % 5 == f (fold 0 is the published
val split). Per fold the rig poses and the reading line are redone on the
other four folds only; the held-out scenes are scored frozen. The lip
bias in pixels stays the published constant: it was measured once on the
full train medians, so a fold reuses it. That leak is sub-pixel against a
2-3% error and is stated, not hidden. Only the original 80 tangerine and 40
tomato scenes take part: the later proof scenes (seeds past 80 / 1040) stay
out, since they are all fold 0 and would leak into the other folds' fits.
They get their own frozen-line scoring in ``score_new``.

Usage, from the repo root::

    PYTHONPATH=sim sim/.venv/bin/python -m detect.crossval
"""

from __future__ import annotations

import csv
from pathlib import Path

from detect import rim_pose
from detect.fruit_height import ROOT, matched_points, matched_tops, matched_tops_three
from detect.profile import count_from_height
from detect.tomato_volume import liters, reading_cm

TANGERINE_DYS = (8.8, 5.8, 7.4)
TOMATO_DYS = (7.6, 6.2, 7.4)


def _disk(item: str, seed: int, stem: str, suffix: str) -> Path:
    split = "val" if seed % 5 == 0 else "train"
    if item == "tomato":
        return ROOT / "sides" / "tomato" / split / f"{stem}{suffix}.png"
    return ROOT / "sides" / split / f"{stem}{suffix}.png"


def _fold_rig(item: str, train_seeds: list[int], stems: dict[int, str], dys: tuple) -> list[dict]:
    suffixes = ("", "-b", "-c") if item == "tangerine" else ("", "-b")
    rig = []
    for suffix, dy_px in zip(suffixes, dys):
        images = [_disk(item, seed, stems[seed], suffix) for seed in train_seeds]
        rig.append(rim_pose.pooled_rig(images, dy_px))
    return rig


def _summarize(name: str, rels: list[tuple[int, float]]) -> None:
    mae = sum(abs(rel) for _seed, rel in rels) / len(rels)
    outside = [f"s{seed} {rel:+.0%}" for seed, rel in rels if abs(rel) > 0.10]
    worst = max(rels, key=lambda entry: abs(entry[1]))
    print(f"{name}: n={len(rels)} mae {mae:.1%} outside {len(outside)} {', '.join(outside)}", flush=True)
    print(f"  worst s{worst[0]} {worst[1]:+.1%}", flush=True)


def crossval_tangerine(rows: list[dict]) -> list[tuple[int, float]]:
    stems = {int(float(row["seed"])): f"tangerine-s{int(float(row['seed']))}" for row in rows}
    pooled: list[tuple[int, float]] = []
    for fold in range(5):
        held = [seed for seed in stems if seed % 5 == fold]
        train = [seed for seed in stems if seed % 5 != fold]
        rig = _fold_rig("tangerine", train, stems, TANGERINE_DYS)
        readings: dict[int, float] = {}
        for seed in stems:
            image = _disk("tangerine", seed, stems[seed], "")
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
                float(next(row["h_area_cm"] for row in rows if int(float(row["seed"])) == seed))
                for seed in train
                if readings[seed]
            ],
        )
        print(f"tangerine fold {fold}: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
        truth = {int(float(row["seed"])): row for row in rows}
        fold_rels = []
        for seed in held:
            if not readings[seed]:
                print(f"  s{seed} no reading", flush=True)
                continue
            row = truth[seed]
            height = line[1] + line[0] * readings[seed]
            estimate = count_from_height(height, float(row["d_cm"]))
            fold_rels.append((seed, (estimate - float(row["inside"])) / float(row["inside"])))
        _summarize(f"tangerine fold {fold} held out", fold_rels)
        pooled.extend(fold_rels)
    return pooled


def crossval_tomato(rows: list[dict]) -> list[tuple[int, float]]:
    stems = {int(float(row["seed"])): f"tomato-s{int(float(row['seed']))}" for row in rows}
    pooled: list[tuple[int, float]] = []
    for fold in range(5):
        held = [seed for seed in stems if seed % 5 == fold]
        train = [seed for seed in stems if seed % 5 != fold]
        rig = _fold_rig("tomato", train, stems, TOMATO_DYS)
        readings: dict[int, float] = {}
        for seed in stems:
            image = _disk("tomato", seed, stems[seed], "")
            second = image.with_name(image.stem + "-b.png")
            points = matched_points(image, second, "tomato", rig)
            readings[seed] = reading_cm(points) if points else 0.0
        line = rim_pose._fit_line(
            [readings[seed] for seed in train if readings[seed]],
            [
                float(next(row["h_area_cm"] for row in rows if int(float(row["seed"])) == seed))
                for seed in train
                if readings[seed]
            ],
        )
        print(f"tomato fold {fold}: area_cm = {line[1]:.3f} + {line[0]:.4f} * reading", flush=True)
        truth = {int(float(row["seed"])): row for row in rows}
        fold_rels = []
        for seed in held:
            if not readings[seed]:
                print(f"  s{seed} no reading", flush=True)
                continue
            row = truth[seed]
            height = line[1] + line[0] * readings[seed]
            value = float(row["h_area_cm"])
            fold_rels.append((seed, (liters(height) - liters(value)) / liters(value)))
        _summarize(f"tomato fold {fold} held out", fold_rels)
        pooled.extend(fold_rels)
    return pooled


def main() -> None:
    print("tangerine", flush=True)
    rows = list(csv.DictReader((ROOT / "height-sheet.csv").open()))
    rows = [row for row in rows if int(float(row["seed"])) <= 80]
    pooled = crossval_tangerine(rows)
    _summarize("tangerine pooled held out", pooled)
    print("tomato", flush=True)
    rows = list(csv.DictReader((ROOT / "tomato-height-sheet.csv").open()))
    rows = [row for row in rows if int(float(row["seed"])) <= 1040]
    pooled = crossval_tomato(rows)
    _summarize("tomato pooled held out", pooled)


if __name__ == "__main__":
    main()
