"""Crate stills configuration (TOML + UPPER_SNAKE attribute access)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib  # type: ignore


class Config:
    """Settings from ``crate.toml``. Nested tables are ``Config`` objects too."""

    def __init__(self, config_source: str | Path | dict[str, Any] | None = None):
        if config_source is None:
            config_source = Path(__file__).resolve().parent / "crate.toml"
        if isinstance(config_source, (str, Path)):
            self._config_path: Path | None = Path(config_source)
            self._data = self._load_config()
            # crate.toml lives in sim/render_crate/, so the sim root is two levels up.
            object.__setattr__(self, "SIM_ROOT", self._config_path.resolve().parents[1])
        elif isinstance(config_source, dict):
            self._config_path = None
            self._data = config_source
        else:
            raise TypeError("config_source must be a path, dictionary, or None.")

    def _load_config(self) -> dict:
        with open(self._config_path, "rb") as handle:
            return tomllib.load(handle)

    def path(self, relative: str) -> Path:
        return self.SIM_ROOT / relative

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        key = name.lower()
        if key in self._data:
            value = self._data[key]
            if isinstance(value, dict):
                return Config(value)
            return value
        raise AttributeError(
            f"Configuration '{self._config_path or 'nested config'}' has no setting '{key}'"
        )

    def get(self, key: str, default: Any = None) -> Any:
        if key not in self._data:
            return default
        value = self._data[key]
        if isinstance(value, dict):
            return Config(value)
        return value

    def as_dict(self) -> dict[str, Any]:
        return dict(self._data)
