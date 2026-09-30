"""Blender entry for the top-layer dataset.

Example::

    blender --background --python sim/render-dataset.py -- --limit 2
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render_crate.dataset import DatasetWriter

if __name__ == "__main__":
    DatasetWriter().run()
