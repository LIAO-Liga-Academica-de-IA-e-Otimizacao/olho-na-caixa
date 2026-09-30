"""Train and val stills for the top-layer detector. No side photo, simplified Cycles."""

TANGERINES = 80
TOMATOES = 40
POUR_SALT = 9100
LIGHT_SALT = 9200
CLASSES = {"tangerine": 0, "tomato": 1}


def jobs() -> list[dict]:
    """Fixed scenes. A seed divisible by 5 is validation and never trains."""
    rows = []
    for seed in range(1, TANGERINES + 1):
        rows.append(_row("tangerine", seed))
    for offset in range(1, TOMATOES + 1):
        rows.append(_row("tomato", 1000 + offset))
    return rows


def _row(label: str, seed: int) -> dict:
    return {"label": label, "seed": seed, "split": "val" if seed % 5 == 0 else "train"}
