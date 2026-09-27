"""Download the Blendkit meshes chosen for the simulation preview.

Royalty-free files land in filled-crate and stay out of git. CC0 files are kept.
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "assets"
API = "https://www.blenderkit.com/api/v1"
OPENER = urllib.request.build_opener()
OPENER.addheaders = [("User-Agent", "olho-na-caixa-asset-fetch")]
urllib.request.install_opener(OPENER)

ASSETS = [
    {
        "folder": "tomato",
        "asset_base_id": "f72869bb-c2a7-4f84-bd46-8801b6535e9d",
        "file_type": "resolution_2K",
    },
    {
        "folder": "tangerine",
        "asset_base_id": "edf86788-78bb-47a6-96d6-023a69188bda",
        "file_type": "resolution_2K",
    },
    {
        "folder": "crates/plastic-crate-01",
        "asset_base_id": "46258139-9f60-495b-9682-e08ea4e65712",
        "file_type": "resolution_1K",
    },
    {
        "folder": "crates/plastic-crate-02",
        "asset_base_id": "e58013cc-d93f-44fe-b775-636dc90500c1",
        "file_type": "resolution_1K",
    },
    {
        "folder": "crates/plastic-crate-03",
        "asset_base_id": "3e9d2618-d907-4a15-a46e-cfbf620cd2d9",
        "file_type": "resolution_1K",
    },
    {
        "folder": "filled-crate",
        "asset_base_id": "7dcbdf43-125f-4ca1-98a0-2e48b633a58a",
        "file_type": "gltf",
    },
]


def search(asset_base_id: str) -> dict:
    query = urllib.parse.urlencode(
        {"query": f"asset_base_id:{asset_base_id}", "asset_type": "model"}
    )
    with urllib.request.urlopen(f"{API}/search/?{query}", timeout=60) as response:
        payload = json.load(response)
    return payload["results"][0]


def file_url(download_url: str) -> str:
    scene = "795146fe-f72f-4e2c-9cc6-f9cf1ec5a135"
    separator = "&" if "?" in download_url else "?"
    with urllib.request.urlopen(f"{download_url}{separator}scene_uuid={scene}", timeout=60) as response:
        payload = json.load(response)
    return payload["filePath"]


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return
    urllib.request.urlretrieve(url, destination)


def main() -> None:
    for spec in ASSETS:
        asset = search(spec["asset_base_id"])
        folder = ROOT / spec["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        chosen = next(item for item in asset["files"] if item["fileType"] == spec["file_type"])
        thumbnail = next(item for item in asset["files"] if item["fileType"] == "thumbnail")
        suffix = Path(chosen["filename"]).suffix
        mesh_name = f"{asset['name'].lower().replace(' ', '-')}{suffix}"
        download(file_url(chosen["downloadUrl"]), folder / mesh_name)
        download(file_url(thumbnail["downloadUrl"]), folder / "thumbnail.png")
        source = f"https://www.blenderkit.com/asset-gallery-detail/{spec['asset_base_id']}/"
        author = asset.get("author") or {}
        author_name = author.get("fullName") or author.get("name") or "unknown"
        (folder / "LICENSE").write_text(
            "\n".join(
                [
                    asset["name"],
                    f"License: {asset['license']}",
                    f"Author: {author_name}",
                    f"Source: {source}",
                    f"File: {mesh_name}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        print(f"{spec['folder']}: {asset['name']} ({asset['license']}) -> {mesh_name}")


if __name__ == "__main__":
    main()
