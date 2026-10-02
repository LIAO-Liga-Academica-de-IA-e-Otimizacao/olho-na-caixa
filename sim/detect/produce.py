"""One record per item. A later item is a row here, not a copy of the tangerine path.

The crate, the arc cameras, the train/val split, and the two accounts are shared.
Liters are the mouth area times the lid height. Mass is liters times the lot's
kilograms per liter, which is how the tomato works and how the carrot will work.
Bunches are visible hands times fingers per hand times hand layers, which is the
banana. The peel color and the height reader are not shared: a stick or a hand
is not a round fruit, and those two stay empty until that item is in scope.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    """What is already known about one produce item, and what is still missing."""

    label: str
    account: str
    class_id: int | None
    peel: str | None
    seeds: tuple[int, ...] | None
    note: str


ITEMS: dict[str, Item] = {
    "tangerine": Item(
        "tangerine",
        "layers",
        0,
        "tangerine",
        tuple(range(1, 81)) + tuple(range(85, 121, 5)) + tuple(range(125, 1281, 5)),
        "Units from the lid height and the count line.",
    ),
    "tomato": Item(
        "tomato",
        "liters",
        1,
        "tomato",
        tuple(range(1001, 1041)) + tuple(range(1045, 1081, 5)) + tuple(range(1085, 2281, 5)),
        "Liters from the lid height. Kilograms per liter come from the lot, not the photo.",
    ),
    "carrot": Item(
        "carrot",
        "liters",
        None,
        None,
        None,
        "Same liters account as the tomato. Still needs a mesh, a peel mask, and a height "
        "reader: a carrot is not a round fruit, so the tomato median does not transfer. "
        "Thin and thick carrots do not share kilograms per liter.",
    ),
    "banana": Item(
        "banana",
        "bunches",
        None,
        None,
        None,
        "Fingers are visible hands times fingers per hand times hand layers. "
        "The hand thickness is measured on the lot. Still needs a mesh, a peel mask, "
        "and a reader for hands, which are not round fruits.",
    ),
}


def item(label: str) -> Item:
    """The record for ``label``, or an error that names the catalog."""
    found = ITEMS.get(label)
    if found is None:
        known = ", ".join(ITEMS)
        raise KeyError(f"unknown item {label!r}; the catalog is {known}")
    return found


def require_peel(label: str) -> str:
    """Peel-mask name. An item without one is not ready to be matched across frames."""
    found = item(label)
    if found.peel is None:
        raise ValueError(found.note)
    return found.peel


def detector_classes() -> dict[str, int]:
    """Labels that already have a YOLO class. Later items stay out until they are trained."""
    return {found.label: found.class_id for found in ITEMS.values() if found.class_id is not None}
