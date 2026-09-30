"""Blender entry for one crate, two stills.

The generator lives in ``sim/render_crate``. Example::

    blender --background --python sim/render-crate.py -- tomato --seed 5
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render_crate import Renderer

if __name__ == "__main__":
    renderer = Renderer()
    renderer.run()
