"""Crate stills: sphere settle, then two Cycles views."""

__all__ = ["Renderer"]


def __getattr__(name: str):
    if name == "Renderer":
        from .renderer import Renderer

        return Renderer
    raise AttributeError(f"module 'render_crate' has no attribute {name!r}")
