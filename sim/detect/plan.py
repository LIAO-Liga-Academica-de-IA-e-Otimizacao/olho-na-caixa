"""Train and val stills for the top-layer detector. No side photo, simplified Cycles."""

from detect.produce import ITEMS, detector_classes

POUR_SALT = 9100
LIGHT_SALT = 9200
CLASSES = detector_classes()


def jobs() -> list[dict]:
    """Scenes for items that already have a seed range. A seed divisible by 5 is validation."""
    rows = []
    for found in ITEMS.values():
        if found.seeds is None:
            continue
        for seed in found.seeds:
            rows.append(_row(found.label, seed))
    return rows


def _row(label: str, seed: int) -> dict:
    return {"label": label, "seed": seed, "split": "val" if seed % 5 == 0 else "train"}
