"""Height of the lid from the same fruits seen in two arc frames.

The center of a round fruit projects to the center of its disk. Two such rays
meet at the fruit, unlike the silhouette rays, which meet in the air outside it.
The lid height is the mean of those centers plus one radius.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import cv2
import numpy as np

from detect.profile import count_from_height

ROOT = Path(__file__).resolve().parents[1] / "assets" / "detect"
CAMERAS = json.loads((Path(__file__).resolve().parent / "pair_cameras.json").read_text())
RADIUS_M = 0.0255
WIDTH = 640
HEIGHT = 480


def project(camera: dict, point: np.ndarray) -> np.ndarray | None:
    """Pixel of a world point. Row 0 is the top of the image."""
    relative = np.asarray(point, dtype=np.float64) - np.asarray(camera["origin"])
    camera_point = relative @ np.asarray(camera["rotation"])
    if camera_point[2] >= -1e-8:
        return None
    depth = -camera_point[2]
    lens = camera["lens"]
    sensor_width = camera["sensor_width"]
    sensor_height = sensor_width * HEIGHT / WIDTH
    column = (0.5 + camera_point[0] / depth * lens / sensor_width) * WIDTH - 0.5
    row = (0.5 - camera_point[1] / depth * lens / sensor_height) * HEIGHT - 0.5
    return np.array((column, row))


def pixel_ray(camera: dict, column: float, row: float) -> tuple[np.ndarray, np.ndarray]:
    """Ray from the lens through a pixel. Row 0 is the top of the image."""
    sensor_width = camera["sensor_width"]
    sensor_height = sensor_width * HEIGHT / WIDTH
    lens = camera["lens"]
    cam_x = ((column + 0.5) / WIDTH - 0.5) * sensor_width / lens
    cam_y = (0.5 - (row + 0.5) / HEIGHT) * sensor_height / lens
    direction = np.array((cam_x, cam_y, -1.0)) @ np.asarray(camera["rotation"]).T
    return np.asarray(camera["origin"], dtype=np.float64), direction


def closest_point(origin_a, direction_a, origin_b, direction_b, gap_m: float = 0.02):
    """Midpoint where the two rays pass within gap_m. None when they miss."""
    direction_a = direction_a / np.linalg.norm(direction_a)
    direction_b = direction_b / np.linalg.norm(direction_b)
    across = origin_a - origin_b
    cross = float(np.dot(direction_a, direction_b))
    denom = 1.0 - cross * cross
    if denom < 1e-6:
        return None
    along_a = float(np.dot(direction_a, across))
    along_b = float(np.dot(direction_b, across))
    ta = (cross * along_b - along_a) / denom
    tb = (along_b - cross * along_a) / denom
    if ta <= 0.0 or tb <= 0.0:
        return None
    point_a = origin_a + ta * direction_a
    point_b = origin_b + tb * direction_b
    if np.linalg.norm(point_a - point_b) > gap_m:
        return None
    return (point_a + point_b) / 2.0


def _inside_opening(column: float, row: float, camera: dict) -> bool:
    """True when the pixel looks through the rim, not at the plastic outside it."""
    corners = []
    for x in (CAMERAS["min_x"], CAMERAS["max_x"]):
        for y in (CAMERAS["min_y"], CAMERAS["max_y"]):
            pixel = project(camera, np.array((x, y, CAMERAS["rim_z"])))
            if pixel is None:
                return False
            corners.append(pixel)
    polygon = np.array(corners)
    center = polygon.mean(axis=0)
    order = np.argsort(np.arctan2(polygon[:, 1] - center[1], polygon[:, 0] - center[0]))
    polygon = polygon[order]
    # Shrink so a highlight on the lip is not a fruit.
    polygon = center + (polygon - center) * 0.92
    crosses = []
    for index in range(len(polygon)):
        ax, ay = polygon[index]
        bx, by = polygon[(index + 1) % len(polygon)]
        crosses.append((bx - ax) * (row - ay) - (by - ay) * (column - ax))
    return all(value >= 0 for value in crosses) or all(value <= 0 for value in crosses)


def fruit_centers(image: Path, camera: dict, kind: str = "tangerine") -> list[dict]:
    """One center per visible fruit: a peak of the peel's distance transform."""
    bgr = cv2.imread(str(image))
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    peak = np.maximum(np.maximum(red, green), blue)
    grey = (np.abs(red - green) < 0.05) & (np.abs(green - blue) < 0.05)
    if kind == "tomato":
        # Ripe tomato is red with little green, like the crate, but brighter.
        mask = (peak >= 0.22) & ~grey & (red + green > blue + 0.10)
    else:
        mask = (peak >= 0.28) & ~((green < 0.18) & (blue < 0.15))
        mask &= ((np.abs(red - green) >= 0.05) | (np.abs(green - blue) >= 0.05)) & (red + green > blue + 0.15)
    binary = mask.astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    distance = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    spread = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (29, 29))
    peaks = (distance == cv2.dilate(distance, spread)) & (distance >= 9)
    centers = []
    rows, columns = np.nonzero(peaks)
    for row, column in zip(rows, columns):
        if not _inside_opening(float(column), float(row), camera):
            continue
        radius = int(distance[row, column])
        disk = rgb[max(0, row - 3) : row + 4, max(0, column - 3) : column + 4]
        centers.append({"column": float(column), "row": float(row), "radius": radius, "color": disk.mean(axis=(0, 1))})
    return centers


def _in_crate(point: np.ndarray) -> bool:
    return (
        CAMERAS["min_x"] < point[0] < CAMERAS["max_x"]
        and CAMERAS["min_y"] < point[1] < CAMERAS["max_y"]
        and CAMERAS["floor_z"] < point[2] < CAMERAS["rim_z"] + 0.08
    )


def matched_points(image_a: Path, image_b: Path, kind: str = "tangerine") -> list[np.ndarray]:
    """Where the same fruit is seen in both frames, in meters."""
    cameras = CAMERAS["cameras"]
    fruits_a = fruit_centers(image_a, cameras[0], kind)
    fruits_b = fruit_centers(image_b, cameras[1], kind)
    pairs = []
    for index_a, fruit_a in enumerate(fruits_a):
        origin_a, direction_a = pixel_ray(cameras[0], fruit_a["column"], fruit_a["row"])
        for index_b, fruit_b in enumerate(fruits_b):
            color = float(np.linalg.norm(fruit_a["color"] - fruit_b["color"]))
            if color > 0.18:
                continue
            origin_b, direction_b = pixel_ray(cameras[1], fruit_b["column"], fruit_b["row"])
            mid = closest_point(origin_a, direction_a, origin_b, direction_b)
            if mid is None or not _in_crate(mid):
                continue
            pairs.append((color, index_a, index_b, mid))
    pairs.sort(key=lambda item: item[0])
    used_a: set[int] = set()
    used_b: set[int] = set()
    points = []
    for _score, index_a, index_b, mid in pairs:
        if index_a in used_a or index_b in used_b:
            continue
        used_a.add(index_a)
        used_b.add(index_b)
        points.append(mid)
    return points


def matched_tops(image_a: Path, image_b: Path, kind: str = "tangerine") -> list[float]:
    """Lid height of each fruit found in both frames, in meters above the floor."""
    return [float(point[2] + RADIUS_M - CAMERAS["floor_z"]) for point in matched_points(image_a, image_b, kind)]


def lid_height_m(image_a: Path, image_b: Path) -> float:
    """Mean top of the matched fruits. No match reads as an empty floor."""
    tops = matched_tops(image_a, image_b)
    if not tops:
        return 0.0
    return sum(tops) / len(tops)


def matched_tops_three(image_a: Path, image_b: Path, image_c: Path, kind: str = "tangerine") -> list[float]:
    """Lid height of each fruit seen in all three frames, in meters above the floor."""
    cameras = CAMERAS["cameras"]
    groups = [
        fruit_centers(image_a, cameras[0], kind),
        fruit_centers(image_b, cameras[1], kind),
        fruit_centers(image_c, cameras[2], kind),
    ]
    rays = [
        [pixel_ray(camera, fruit["column"], fruit["row"]) for fruit in fruits]
        for camera, fruits in zip(cameras, groups)
    ]
    triples = []
    for index_a, fruit_a in enumerate(groups[0]):
        for index_b, fruit_b in enumerate(groups[1]):
            if float(np.linalg.norm(fruit_a["color"] - fruit_b["color"])) > 0.18:
                continue
            mid_ab = closest_point(*rays[0][index_a], *rays[1][index_b])
            if mid_ab is None or not _in_crate(mid_ab):
                continue
            for index_c, fruit_c in enumerate(groups[2]):
                if float(np.linalg.norm(fruit_a["color"] - fruit_c["color"])) > 0.18:
                    continue
                if float(np.linalg.norm(fruit_b["color"] - fruit_c["color"])) > 0.18:
                    continue
                mid_ac = closest_point(*rays[0][index_a], *rays[2][index_c])
                mid_bc = closest_point(*rays[1][index_b], *rays[2][index_c])
                if mid_ac is None or mid_bc is None or not _in_crate(mid_ac) or not _in_crate(mid_bc):
                    continue
                mean = (mid_ab + mid_ac + mid_bc) / 3.0
                spread = max(float(np.linalg.norm(mean - point)) for point in (mid_ab, mid_ac, mid_bc))
                if spread > 0.015:
                    continue
                triples.append((spread, index_a, index_b, index_c, mean))
    triples.sort(key=lambda item: item[0])
    used = [set(), set(), set()]
    tops = []
    for _spread, index_a, index_b, index_c, mean in triples:
        if index_a in used[0] or index_b in used[1] or index_c in used[2]:
            continue
        used[0].add(index_a)
        used[1].add(index_b)
        used[2].add(index_c)
        tops.append(float(mean[2] + RADIUS_M - CAMERAS["floor_z"]))
    return tops


def _roundtrip_error() -> float:
    """A known point, projected into every pair of frames, must triangulate back to itself."""
    point = np.array((0.0, 0.02, 0.16))
    cameras = CAMERAS["cameras"]
    worst = 0.0
    pixels = [project(camera, point) for camera in cameras]
    rays = [pixel_ray(camera, pixel[0], pixel[1]) for camera, pixel in zip(cameras, pixels)]
    for index in range(len(cameras)):
        for other in range(index + 1, len(cameras)):
            mid = closest_point(*rays[index], *rays[other], gap_m=0.01)
            worst = max(worst, float(np.linalg.norm(mid - point)))
    return worst


def main() -> None:
    error = _roundtrip_error()
    if error > 1e-3:
        raise SystemExit(f"camera roundtrip failed: {error:.4f} m")
    sheet = ROOT / "height-sheet.csv"
    rows = list(csv.DictReader(sheet.open()))
    for row in rows:
        for key in ("inside", "d_cm", "h_area_cm", "h_photo_cm"):
            row[key] = float(row[key])
        image = ROOT / "sides" / row["split"] / f"tangerine-s{int(row['seed'])}.png"
        tops = matched_tops_three(
            image,
            image.with_name(image.stem + "-b" + image.suffix),
            image.with_name(image.stem + "-c" + image.suffix),
        )
        row["h_tri_cm"] = round((sum(tops) / len(tops) if tops else 0.0) * 100, 2)
        row["tri_n"] = len(tops)
        print(
            f"TRI s{int(row['seed'])} n={len(tops)} tri={row['h_tri_cm']} area={row['h_area_cm']}",
            flush=True,
        )
    _score(rows, "h_tri_cm")
    with sheet.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _score(rows: list[dict], key: str) -> None:
    train = [row for row in rows if row["split"] == "train"]
    val = [row for row in rows if row["split"] == "val"]
    slope, intercept = _fit([row[key] for row in train], [row["h_area_cm"] for row in train])
    print(f"area_cm = {intercept:.2f} + {slope:.3f} * {key}")

    def corrected(row):
        return count_from_height(intercept + slope * row[key], row["d_cm"])

    def raw(row):
        return count_from_height(row[key], row["d_cm"])

    _report("three", val, raw)
    _report("three corrected", val, corrected)
    outside = []
    for row in val:
        truth = row["inside"]
        rel = (corrected(row) - truth) / truth
        if abs(rel) > 0.10:
            outside.append(f"s{int(row['seed'])} {rel:+.0%}")
    print(f"outside 10%: {len(outside)} {', '.join(outside)}")


def _report(name: str, rows: list[dict], estimate) -> None:
    rels = [(estimate(row) - row["inside"]) / row["inside"] for row in rows]
    mean = sum(rels) / len(rels)
    mae = sum(abs(value) for value in rels) / len(rels)
    print(f"{name}: bias {mean:+.1%} mae {mae:.1%} min {min(rels):+.1%} max {max(rels):+.1%}")


def _fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    count = len(xs)
    sx, sy = sum(xs), sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, ys))
    slope = (count * sxy - sx * sy) / (count * sxx - sx * sx)
    intercept = (sy - slope * sx) / count
    return slope, intercept


if __name__ == "__main__":
    main()
