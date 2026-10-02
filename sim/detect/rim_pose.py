"""Camera pose from the crate mouth, without the stored Blender origin.

The mouth is the catalog rectangle, 28.2 cm by 39.2 cm, at the rim height.
The lens is the studio lens that rendered every still: 35 mm across a 36 mm
sensor, image 640 by 480. That lens is shared by the generator. It is not
estimated from the photo. The origin and the rotation are: four corners of
the mouth go through IPPE, and the solution that sits outside the near wall
is the camera.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from detect.fruit_height import CAMERAS, HEIGHT, WIDTH

LENS_MM = 35.0
SENSOR_MM = 36.0
# fx = fy = lens / sensor_width * width. The principal point is the pixel center.
FOCAL_PX = LENS_MM / SENSOR_MM * WIDTH


def _masks(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    peak = np.maximum(np.maximum(red, green), blue)
    grey = (np.abs(red - green) < 0.07) & (np.abs(green - blue) < 0.07)
    wall = (peak < 0.5) & (red + 0.02 > green) & (blue < 0.32) & ~grey
    background = grey & (peak > 0.4)
    return wall, ~background


# Column centers where the near lip is sampled. The rail is solid plastic, so
# the Canny density drops on it and jumps on the lattice below. Side strips
# see that step sharply. Middle strips see it through more fruit, so they only
# back up the fit and RANSAC is free to reject them.
_STEP_CENTERS = (27, 60, 92, 140, 180, 320, 400, 440, 470, 500, 548, 582, 616)
_STEP_HALF = 18


def _canny_edges(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return (cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 50, 150) > 0).astype(float)


def _strip_step(density: np.ndarray, low: int = 200, high: int = 460) -> float | None:
    """Last row where the edge density jumps and stays up: rail into lattice."""
    smooth = np.convolve(density, np.ones(9) / 9.0, mode="same")
    for row in range(high, low, -2):
        if smooth[row] >= 0.08 and smooth[row - 2] < 0.08 and smooth[row : row + 40].mean() > 0.10:
            return float(row)
    return None


def _near_steps(edges: np.ndarray) -> np.ndarray:
    points = []
    for center in _STEP_CENTERS:
        density = edges[:, max(0, center - _STEP_HALF) : center + _STEP_HALF + 1].mean(axis=1)
        row = _strip_step(density)
        if row is not None:
            points.append((float(center), row))
    if len(points) < 3:
        raise ValueError("the near lip has too few steps")
    return np.array(points)


def _continuous_line(points: np.ndarray, slope_max: float, span: float) -> tuple[float, float, np.ndarray]:
    """Line through the longest run of points that already sit on one edge."""
    points = np.asarray(points, dtype=np.float64)
    rng = np.random.default_rng(0)
    best: tuple[int, np.ndarray] | None = None
    count = len(points)
    for _ in range(600):
        first = int(rng.integers(count))
        distance = np.abs(points[:, 0] - points[first, 0])
        pool = np.where((distance > 30.0) & (distance < span))[0]
        if len(pool) == 0:
            continue
        second = int(rng.choice(pool))
        run = points[second, 0] - points[first, 0]
        slope = (points[second, 1] - points[first, 1]) / run
        if abs(slope) > slope_max:
            continue
        intercept = points[first, 1] - slope * points[first, 0]
        inliers = np.abs(points[:, 1] - (slope * points[:, 0] + intercept)) < 8.0
        columns = np.sort(points[inliers, 0])
        if len(columns) < 12:
            continue
        score = int((np.diff(columns) < 18.0).sum())
        if best is None or score > best[0]:
            best = (score, inliers)
    if best is None:
        raise ValueError("no rim line")
    kept = points[best[1]]
    slope, intercept = np.polyfit(kept[:, 0], kept[:, 1], 1)
    return float(slope), float(intercept), kept


def _sparse_line(points: np.ndarray, slope_max: float = 0.6, tol: float = 12.0) -> tuple[float, float, np.ndarray]:
    """Line through sparse step points. Best inlier count wins, then spread."""
    points = np.asarray(points, dtype=np.float64)
    count = len(points)
    best: tuple[int, float, np.ndarray] | None = None
    for first in range(count):
        for second in range(first + 1, count):
            run = points[second, 0] - points[first, 0]
            if abs(run) < 60.0:
                continue
            slope = (points[second, 1] - points[first, 1]) / run
            if abs(slope) > slope_max:
                continue
            intercept = points[first, 1] - slope * points[first, 0]
            inliers = np.abs(points[:, 1] - (slope * points[:, 0] + intercept)) < tol
            if int(inliers.sum()) < 3:
                continue
            spread = float(points[inliers, 0].max() - points[inliers, 0].min())
            key = (int(inliers.sum()), spread)
            if best is None or key > (best[0], best[1]):
                best = (key[0], key[1], inliers)
    if best is None:
        raise ValueError("no sparse rim line")
    kept = points[best[2]]
    if float(kept[:, 0].max() - kept[:, 0].min()) < 200.0:
        raise ValueError("the near lip is too short")
    slope, intercept = np.polyfit(kept[:, 0], kept[:, 1], 1)
    return float(slope), float(intercept), kept


def _endpoint(slope: float, intercept: float, kept: np.ndarray, edge: np.ndarray, side: int) -> np.ndarray:
    """Where the lip meets the crate silhouette, staying near the fitted run."""
    anchor = kept[np.argmin(kept[:, 0])] if side < 0 else kept[np.argmax(kept[:, 0])]
    low = max(0, int(min(kept[:, 1].min(), anchor[1])) - 50)
    high = min(len(edge) - 1, int(max(kept[:, 1].max(), anchor[1])) + 50)
    best: tuple[float, np.ndarray] | None = None
    for row in range(low, high):
        column = int(edge[row])
        if column < 0:
            continue
        residual = abs(row - (slope * column + intercept))
        if residual > 12.0:
            continue
        if side < 0 and column > anchor[0] + 20:
            continue
        if side > 0 and column < anchor[0] - 20:
            continue
        if abs(column - anchor[0]) > 160:
            continue
        if best is None or residual < best[0]:
            best = (residual, np.array((float(column), float(row))))
    if best is None:
        return anchor.astype(np.float64)
    return best[1]


def mouth_corners(image: Path, dy_px: float = 0.0) -> np.ndarray:
    """Pixel corners of the inner mouth: near-left, near-right, far-right, far-left.

    Near is the lip closest to the camera, the long front face of the crate.
    dy_px shifts the near line up. The step detector sits below the lip on the
    lattice, by a fixed amount per arc position. Mark the lip once per arc
    position to measure it; the train median says about 6 to 9 px here.
    """
    bgr = cv2.imread(str(image))
    if bgr is None:
        raise FileNotFoundError(image)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    wall, crate = _masks(rgb)
    closed = cv2.morphologyEx(wall.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 1), np.uint8)).astype(bool)
    height, width = closed.shape
    left = np.full(height, -1)
    right = np.full(height, -1)
    for row in range(height):
        columns = np.where(crate[row])[0]
        if len(columns) > 20:
            left[row] = int(columns[0])
            right[row] = int(columns[-1])

    far_points = []
    for column in range(2, width - 2, 2):
        rows = np.where(closed[:, column])[0]
        if len(rows) == 0:
            continue
        row = int(rows[0])
        if 8 < row < height * 0.42:
            far_points.append((column, row))
    far_slope, far_intercept, far_kept = _continuous_line(np.array(far_points), 0.6, 100.0)

    near_slope, near_intercept, near_kept = _sparse_line(_near_steps(_canny_edges(bgr)))
    near_intercept -= dy_px
    return np.stack(
        (
            _endpoint(near_slope, near_intercept, near_kept, left, -1),
            _endpoint(near_slope, near_intercept, near_kept, right, +1),
            _endpoint(far_slope, far_intercept, far_kept, right, +1),
            _endpoint(far_slope, far_intercept, far_kept, left, -1),
        )
    )


def _mouth_model() -> np.ndarray:
    """Inner mouth corners, in the same order as mouth_corners."""
    rim = CAMERAS["rim_z"]
    return np.array(
        (
            (CAMERAS["min_x"], CAMERAS["max_y"], rim),
            (CAMERAS["min_x"], CAMERAS["min_y"], rim),
            (CAMERAS["max_x"], CAMERAS["min_y"], rim),
            (CAMERAS["max_x"], CAMERAS["max_y"], rim),
        ),
        dtype=np.float64,
    )


def _intrinsics() -> np.ndarray:
    return np.array(
        ((FOCAL_PX, 0.0, (WIDTH - 1) / 2.0), (0.0, FOCAL_PX, (HEIGHT - 1) / 2.0), (0.0, 0.0, 1.0)),
        dtype=np.float64,
    )


def camera_from_corners(pixels: np.ndarray) -> dict:
    """Origin and rotation in the same frame fruit_height.project uses.

    IPPE returns two poses. The one kept has the lens outside the near wall
    and the smaller reprojection of the four corners.
    """
    ok, rvecs, tvecs, errors = cv2.solvePnPGeneric(
        _mouth_model(),
        np.asarray(pixels, dtype=np.float64),
        _intrinsics(),
        None,
        flags=cv2.SOLVEPNP_IPPE,
    )
    if not ok:
        raise ValueError("the mouth corners do not determine a pose")
    chosen: tuple[float, np.ndarray, np.ndarray] | None = None
    for rvec, tvec, error in zip(rvecs, tvecs, errors):
        opencv_rotation, _ = cv2.Rodrigues(rvec)
        translation = np.asarray(tvec, dtype=np.float64).reshape(3)
        origin = -opencv_rotation.T @ translation
        if origin[0] >= CAMERAS["min_x"]:
            continue
        reprojection = float(np.asarray(error).ravel()[0])
        if chosen is None or reprojection < chosen[0]:
            # OpenCV looks along +z with +y down. This project looks along -z with +y up.
            rotation = np.column_stack((opencv_rotation[0], -opencv_rotation[1], -opencv_rotation[2]))
            chosen = (reprojection, origin, rotation)
    if chosen is None:
        raise ValueError("both poses sit inside the crate")
    _reprojection, origin, rotation = chosen
    return {
        "origin": origin.tolist(),
        "rotation": rotation.tolist(),
        "lens": LENS_MM,
        "sensor_width": SENSOR_MM,
    }


def camera_from_image(image: Path) -> dict:
    """Pose of one still, from the mouth it shows."""
    return camera_from_corners(mouth_corners(image))


def pooled_rig(images: list[Path], dy_px: float = 0.0) -> dict:
    """One rig pose from the mouth corners of many stills of the same camera.

    RANSAC rejects the scenes where the lip detector locked onto the lattice.
    dy_px removes the detector bias first, so the consensus lands on the lip.
    No stored pose enters here.
    """
    from detect.fruit_height import project as _project

    model = _mouth_model()
    poses = []
    for image in images:
        try:
            corners = mouth_corners(image, dy_px)
            pose = camera_from_corners(corners)
        except (ValueError, FileNotFoundError):
            continue
        reprojection = float(
            np.median(
                [np.linalg.norm(_project(pose, point) - pixel) for point, pixel in zip(model, corners)]
            )
        )
        if reprojection < 12.0:
            poses.append(pose)
    if len(poses) < 8:
        raise ValueError("too few agreeing scenes for a rig pose")
    origins = np.median([pose["origin"] for pose in poses], axis=0)
    mean_rotation = np.array([pose["rotation"] for pose in poses]).mean(axis=0)
    unit, _, transpose = np.linalg.svd(mean_rotation)
    rotation = unit @ transpose
    # Refine once on the pooled corners, from the median pose.
    objects, pixels = [], []
    for image in images:
        try:
            corners = mouth_corners(image, dy_px)
        except (ValueError, FileNotFoundError):
            continue
        for point3d, pixel in zip(model, corners):
            objects.append(point3d)
            pixels.append(pixel)
    guess = _to_opencv(np.asarray(origins), np.asarray(rotation))
    _, rvec, tvec = cv2.solvePnP(
        np.asarray(objects),
        np.asarray(pixels, dtype=np.float64),
        _intrinsics(),
        np.zeros(4),
        guess[0],
        guess[1],
        useExtrinsicGuess=True,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if bool(np.isfinite(np.asarray(tvec)).all()) and bool(np.isfinite(np.asarray(rvec)).all()):
        rotation_cv, _ = cv2.Rodrigues(rvec)
        origins = -rotation_cv.T @ np.asarray(tvec, dtype=np.float64).reshape(3)
        rotation = np.column_stack((rotation_cv[0], -rotation_cv[1], -rotation_cv[2]))
    return {
        "origin": np.asarray(origins).tolist(),
        "rotation": np.asarray(rotation).tolist(),
        "lens": LENS_MM,
        "sensor_width": SENSOR_MM,
    }


def _to_opencv(origin: np.ndarray, rotation: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Our frame (x right, y up, z back) into the rvec/tvec OpenCV looks along +z."""
    opencv_rotation = np.column_stack((rotation[:, 0], -rotation[:, 1], -rotation[:, 2]))
    rvec, _ = cv2.Rodrigues(opencv_rotation)
    tvec = -opencv_rotation @ np.asarray(origin, dtype=np.float64).reshape(3)
    return rvec, tvec.reshape(3, 1)


def _fit_line(readings: list[float], heights: list[float]) -> tuple[float, float]:
    count = len(readings)
    sx, sy = sum(readings), sum(heights)
    sxx = sum(value * value for value in readings)
    sxy = sum(reading * height for reading, height in zip(readings, heights))
    slope = (count * sxy - sx * sy) / (count * sxx - sx * sx)
    intercept = (sy - slope * sx) / count
    return slope, intercept


def _rig_from_train(stems: list[str], folder: Path, dys: tuple[float, float, float]) -> list[dict]:
    """One frozen pose per arc camera, from the train stills only."""
    rig = []
    for suffix, dy_px in zip(("", "-b", "-c"), dys):
        rig.append(pooled_rig([folder / f"{stem}{suffix}.png" for stem in stems], dy_px))
    return rig


def main() -> None:
    """Score the mouth pose on the existing sheets. Does not rewrite them.

    The rig poses come from the train stills only, then freeze. The val
    stills are scored with those frozen poses. The reading line is also fit
    on the train readings, so the detector bias lands in the line.
    """
    import csv

    from detect.fruit_height import ROOT, matched_points, matched_tops, matched_tops_three
    from detect.profile import count_from_height
    from detect.tomato_volume import liters, reading_cm

    print("tangerine", flush=True)
    rows = list(csv.DictReader((ROOT / "height-sheet.csv").open()))
    train_stems = [f"tangerine-s{int(float(row['seed']))}" for row in rows if row["split"] == "train"]
    # Step bias measured on the train medians: +8.8, +5.8, +7.4 px per camera.
    rig = _rig_from_train(train_stems, ROOT / "sides" / "train", (8.8, 5.8, 7.4))
    for index, camera in enumerate(rig):
        print(f"  rig{index} origin {np.round(camera['origin'], 4).tolist()}", flush=True)
    scored: list[tuple[dict, float | None]] = []
    for row in rows:
        seed = int(float(row["seed"]))
        image = ROOT / "sides" / row["split"] / f"tangerine-s{seed}.png"
        second = image.with_name(image.stem + "-b.png")
        third = image.with_name(image.stem + "-c.png")
        two = matched_tops(image, second, cameras=rig[:2])
        three = matched_tops_three(image, second, third, cameras=rig)
        two_cm = sum(two) / len(two) * 100.0 if two else 0.0
        three_cm = sum(three) / len(three) * 100.0 if three else 0.0
        reading = two_cm if three_cm > two_cm else three_cm
        scored.append((row, reading))
        print(f"s{seed} {row['split']} read {reading:.2f} area {float(row['h_area_cm']):.2f}", flush=True)
    train = [(float(row["h_area_cm"]), reading) for row, reading in scored if row["split"] == "train" and reading]
    slope, intercept = _fit_line([item[1] for item in train], [item[0] for item in train])
    print(f"area_cm = {intercept:.3f} + {slope:.4f} * reading")
    for split in ("train", "val"):
        rels = []
        for row, reading in scored:
            if row["split"] != split or not reading:
                continue
            height = intercept + slope * reading
            estimate = count_from_height(height, float(row["d_cm"]))
            rels.append((int(float(row["seed"])), (estimate - float(row["inside"])) / float(row["inside"])))
        mae = sum(abs(rel) for _seed, rel in rels) / len(rels)
        outside = [f"s{seed} {rel:+.0%}" for seed, rel in rels if abs(rel) > 0.10]
        print(f"{split}: n={len(rels)} count mae {mae:.1%} outside {len(outside)} {', '.join(outside)}")

    print("tomato", flush=True)
    rows = list(csv.DictReader((ROOT / "tomato-height-sheet.csv").open()))
    train_stems = [f"tomato-s{int(float(row['seed']))}" for row in rows if row["split"] == "train"]
    # Step bias measured on the tomato train medians: +7.6, +6.2, +7.4 px.
    trig = _rig_from_train(train_stems, ROOT / "sides" / "tomato" / "train", (7.6, 6.2, 7.4))[:2]
    for index, camera in enumerate(trig):
        print(f"  rig{index} origin {np.round(camera['origin'], 4).tolist()}", flush=True)
    scored = []
    for row in rows:
        seed = int(float(row["seed"]))
        image = ROOT / "sides" / "tomato" / row["split"] / f"tomato-s{seed}.png"
        second = image.with_name(image.stem + "-b.png")
        reading = reading_cm(matched_points(image, second, "tomato", trig))
        scored.append((row, reading))
        print(f"s{seed} {row['split']} read {reading:.2f} area {float(row['h_area_cm']):.2f}", flush=True)
    train = [(float(row["h_area_cm"]), reading) for row, reading in scored if row["split"] == "train" and reading]
    slope, intercept = _fit_line([item[1] for item in train], [item[0] for item in train])
    print(f"area_cm = {intercept:.3f} + {slope:.4f} * reading")
    for split in ("train", "val"):
        rels = []
        for row, reading in scored:
            if row["split"] != split or not reading:
                continue
            height = intercept + slope * reading
            truth = float(row["h_area_cm"])
            rels.append((int(float(row["seed"])), (liters(height) - liters(truth)) / liters(truth)))
        mae = sum(abs(rel) for _seed, rel in rels) / len(rels)
        outside = [f"s{seed} {rel:+.0%}" for seed, rel in rels if abs(rel) > 0.10]
        print(f"{split}: n={len(rels)} liter mae {mae:.1%} outside {len(outside)} {', '.join(outside)}")


if __name__ == "__main__":
    main()
