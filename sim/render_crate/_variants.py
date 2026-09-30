"""Load the fruit-variation script. Its filename has a hyphen, so it is not a package."""

from __future__ import annotations

import importlib.util
from pathlib import Path


def load_variants(script: Path):
    spec = importlib.util.spec_from_file_location("render_variants", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
