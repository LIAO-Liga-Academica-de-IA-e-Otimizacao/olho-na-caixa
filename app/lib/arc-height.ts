/**
 * Lid height from the protocol arc, in the browser.
 *
 * The cameras in `arc-cameras.json` are the calibrated arc rig, not the
 * Blender poses that rendered the stills. Each rig pose is the median over
 * the train stills of that arc position, after removing the lip-detector
 * bias measured on the train medians. A still has to be 640×480, the size
 * the rig was calibrated at. Tangerine units use the held-out line.
 * Tomato kilograms use the plastic-crate mouth, 28.2 cm by 39.2 cm, times
 * the typed kilograms per liter. The layer formula in `packing.ts` is a
 * different account and is not called from here.
 */

import camerasJson from "./arc-cameras.json";
import type { Estimate } from "./packing";

const PROTOCOL_WIDTH = 640;
const PROTOCOL_HEIGHT = 480;
const RADIUS_M = 0.0255;
const TANGERINE_OFFSET_CM = -2.002;
const TANGERINE_SLOPE = 0.932;
const TOMATO_OFFSET_CM = 0.793;
const TOMATO_SLOPE = 0.9307;
const NEAR_M = 0.03;
const SPIKE_CM = 6;
const COUNT_SLOPE = 8.859;
const COUNT_INTERCEPT = 15.57;
const SWITCH_CM = 5.5;
const PHI = Math.PI / (3 * Math.sqrt(3));
const MOUTH_CM2 = 28.2 * 39.2;

type Vec3 = [number, number, number];
type Camera = {
  origin: Vec3;
  rotation: number[][];
  lens: number;
  sensor_width: number;
};

type Bounds = {
  floor_z: number;
  rim_z: number;
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  cameras: Camera[];
  tomatoCameras: Camera[];
};

type Fruit = { column: number; row: number; color: Vec3 };
type Ray = { origin: Vec3; direction: Vec3 };

export type RgbImage = {
  width: number;
  height: number;
  /** Interleaved red, green, blue, each channel from 0 to 1. */
  rgb: Float32Array;
};

export type ArcLid = {
  heightCm: number;
  matched: number;
};

const BOUNDS = camerasJson as Bounds;
const SENSOR_MM = 36;

export type Quad = Array<[number, number]>;

/** Rig poses with the phone lens. Positions come from the rig, rays from the phone. */
export function rigCameras(item: "tangerine" | "tomato", focal35Mm: number): Camera[] {
  const rig = item === "tomato" ? BOUNDS.tomatoCameras : BOUNDS.cameras;
  return rig.map((camera) => ({ ...camera, lens: focal35Mm, sensor_width: SENSOR_MM }));
}

/**
 * Pixel mouth of one arc slot, in 640×480 still space, for the framing guide.
 * Slot 0 is A, 1 is B, 2 is C. Order is near-left, near-right, far-right, far-left.
 */
export function mouthQuad(item: "tangerine" | "tomato", slot: 0 | 1 | 2, focal35Mm: number): Quad | null {
  const camera = rigCameras(item, focal35Mm)[slot];
  if (!camera) return null;
  const corners: Quad = [];
  for (const x of [BOUNDS.min_x, BOUNDS.max_x]) {
    for (const y of [BOUNDS.max_y, BOUNDS.min_y]) {
      const pixel = project(camera, [x, y, BOUNDS.rim_z]);
      if (!pixel) return null;
      corners.push(pixel);
    }
  }
  return corners;
}

const CLOSE_OFFSETS = ellipseOffsets(7);
const OPEN_OFFSETS = ellipseOffsets(5);
const PEAK_OFFSETS = ellipseOffsets(29);

/** Squared distance of a known point, projected and triangulated, back to itself. */
export function cameraRoundtripMeters(): number {
  const point: Vec3 = [0, 0.02, 0.16];
  const rays = BOUNDS.cameras.map((camera) => {
    const pixel = project(camera, point);
    if (!pixel) throw new Error("protocol camera missed the check point");
    return pixelRay(camera, pixel[0], pixel[1]);
  });
  let worst = 0;
  for (let index = 0; index < rays.length; index += 1) {
    for (let other = index + 1; other < rays.length; other += 1) {
      const mid = closestPoint(rays[index], rays[other], 0.01);
      if (!mid) throw new Error("protocol rays missed");
      worst = Math.max(worst, Math.hypot(mid[0] - point[0], mid[1] - point[1], mid[2] - point[2]));
    }
  }
  return worst;
}

/**
 * Lid height, in centimeters, from the protocol stills.
 *
 * Tangerine needs frames A, B, and C. Tomato needs A and B. The images are
 * the rendered arc, not a frame grabbed from an arbitrary video.
 */
export function readArcLid(item: "tangerine" | "tomato", frames: RgbImage[], focal35Mm = 35): ArcLid {
  if (frames.length < 2) throw new Error("Faltam os quadros A e B do arco.");
  for (const frame of frames) {
    if (frame.width !== PROTOCOL_WIDTH || frame.height !== PROTOCOL_HEIGHT) {
      throw new Error("Os quadros do arco precisam ter 640 por 480 pixels.");
    }
  }
  const cameras = rigCameras(item, focal35Mm);
  if (item === "tomato") {
    const points = matchedPoints(frames[0], frames[1], "tomato", cameras);
    const heightCm = tomatoLidCm(points);
    if (heightCm <= 0) throw new Error("Nenhuma fruta cruzou nos quadros A e B.");
    return { heightCm, matched: points.length };
  }
  if (!frames[2]) throw new Error("A tangerina precisa dos quadros A, B e C.");
  const two = matchedTops(frames[0], frames[1], "tangerine", cameras);
  const three = matchedTopsThree(frames[0], frames[1], frames[2], "tangerine", cameras);
  if (two.length === 0 || three.length === 0) {
    throw new Error("Nenhuma fruta apareceu nos três quadros.");
  }
  const twoCm = (mean(two) * 100);
  const threeCm = (mean(three) * 100);
  const reading = threeCm > twoCm ? twoCm : threeCm;
  return { heightCm: TANGERINE_OFFSET_CM + TANGERINE_SLOPE * reading, matched: three.length };
}

/**
 * Units or kilograms from a lid height already read by `readArcLid`.
 *
 * `mouthCm2` is the typed crate mouth. The count line was fit on the 28.2 by
 * 39.2 mouth, so another mouth rescales the line by the area ratio: same
 * fruit, same height, count follows the floor area. That rescale is first
 * order, so a mouth more than 2% off the calibration raises a flag and the
 * screen asks for the scale.
 */
export function estimateFromLid(
  item: "tangerine" | "tomato",
  heightCm: number,
  diameterCm: number,
  densityKgPerLiter: number,
  mouthCm2 = MOUTH_CM2,
): Estimate {
  const flags: string[] = [];
  if (Math.abs(mouthCm2 / MOUTH_CM2 - 1) > 0.02) flags.push("uncalibrated_crate");
  if (item === "tangerine") {
    return {
      value: countFromHeight(heightCm, diameterCm, mouthCm2),
      unit: "un",
      relativeSigma: Math.hypot(0.03, 0.04, 0.03, 0.04),
      flags,
    };
  }
  if (densityKgPerLiter <= 0) throw new Error("bulk density must be positive");
  return {
    value: ((mouthCm2 * heightCm) / 1000) * densityKgPerLiter,
    unit: "kg",
    relativeSigma: Math.hypot(0.02, 0.05, 0.06),
    flags,
  };
}

export function countFromHeight(heightCm: number, diameterCm: number, mouthCm2 = MOUTH_CM2): number {
  const ratio = mouthCm2 / MOUTH_CM2;
  if (heightCm < SWITCH_CM) {
    const radius = 0.5 * diameterCm;
    const volume = (4 / 3) * Math.PI * radius ** 3;
    return (mouthCm2 * (heightCm + diameterCm / 6) * PHI) / volume;
  }
  return ratio * (COUNT_INTERCEPT + COUNT_SLOPE * heightCm);
}

function tomatoLidCm(points: Vec3[]): number {
  const near = BOUNDS.min_x + NEAR_M;
  const heights = points.filter((point) => point[0] >= near).map((point) => (point[2] - BOUNDS.floor_z) * 100);
  if (heights.length === 0) return 0;
  const middle = median(heights);
  const kept = heights.filter((height) => height <= middle + SPIKE_CM);
  const reading = median(kept.length > 0 ? kept : heights);
  return TOMATO_OFFSET_CM + TOMATO_SLOPE * reading;
}

function matchedTops(
  imageA: RgbImage,
  imageB: RgbImage,
  kind: "tangerine" | "tomato",
  cameras: Camera[],
): number[] {
  return matchedPoints(imageA, imageB, kind, cameras).map(
    (point) => point[2] + RADIUS_M - BOUNDS.floor_z,
  );
}

function matchedPoints(
  imageA: RgbImage,
  imageB: RgbImage,
  kind: "tangerine" | "tomato",
  cameras: Camera[],
): Vec3[] {
  const fruitsA = fruitCenters(imageA, cameras[0], kind);
  const fruitsB = fruitCenters(imageB, cameras[1], kind);
  const raysA = fruitsA.map((fruit) => pixelRay(cameras[0], fruit.column, fruit.row));
  const raysB = fruitsB.map((fruit) => pixelRay(cameras[1], fruit.column, fruit.row));
  const pairs: { color: number; indexA: number; indexB: number; mid: Vec3 }[] = [];
  for (let indexA = 0; indexA < fruitsA.length; indexA += 1) {
    for (let indexB = 0; indexB < fruitsB.length; indexB += 1) {
      const color = colorDistance(fruitsA[indexA].color, fruitsB[indexB].color);
      if (color > 0.18) continue;
      const mid = closestPoint(raysA[indexA], raysB[indexB], 0.02);
      if (!mid || !inCrate(mid)) continue;
      pairs.push({ color, indexA, indexB, mid });
    }
  }
  pairs.sort((left, right) => left.color - right.color);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const points: Vec3[] = [];
  for (const pair of pairs) {
    if (usedA.has(pair.indexA) || usedB.has(pair.indexB)) continue;
    usedA.add(pair.indexA);
    usedB.add(pair.indexB);
    points.push(pair.mid);
  }
  return points;
}

function matchedTopsThree(
  imageA: RgbImage,
  imageB: RgbImage,
  imageC: RgbImage,
  kind: "tangerine" | "tomato",
  cameras: Camera[],
): number[] {
  const images = [imageA, imageB, imageC];
  const groups = images.map((image, index) => fruitCenters(image, cameras[index], kind));
  const rays = groups.map((fruits, index) =>
    fruits.map((fruit) => pixelRay(cameras[index], fruit.column, fruit.row)),
  );
  const triples: { spread: number; indexA: number; indexB: number; indexC: number; mean: Vec3 }[] = [];
  for (let indexA = 0; indexA < groups[0].length; indexA += 1) {
    for (let indexB = 0; indexB < groups[1].length; indexB += 1) {
      if (colorDistance(groups[0][indexA].color, groups[1][indexB].color) > 0.18) continue;
      const midAB = closestPoint(rays[0][indexA], rays[1][indexB], 0.02);
      if (!midAB || !inCrate(midAB)) continue;
      for (let indexC = 0; indexC < groups[2].length; indexC += 1) {
        if (colorDistance(groups[0][indexA].color, groups[2][indexC].color) > 0.18) continue;
        if (colorDistance(groups[1][indexB].color, groups[2][indexC].color) > 0.18) continue;
        const midAC = closestPoint(rays[0][indexA], rays[2][indexC], 0.02);
        const midBC = closestPoint(rays[1][indexB], rays[2][indexC], 0.02);
        if (!midAC || !midBC || !inCrate(midAC) || !inCrate(midBC)) continue;
        const mean = meanPoint([midAB, midAC, midBC]);
        const spread = Math.max(
          distance(mean, midAB),
          distance(mean, midAC),
          distance(mean, midBC),
        );
        if (spread > 0.015) continue;
        triples.push({ spread, indexA, indexB, indexC, mean });
      }
    }
  }
  triples.sort((left, right) => left.spread - right.spread);
  const used = [new Set<number>(), new Set<number>(), new Set<number>()];
  const tops: number[] = [];
  for (const triple of triples) {
    if (used[0].has(triple.indexA) || used[1].has(triple.indexB) || used[2].has(triple.indexC)) continue;
    used[0].add(triple.indexA);
    used[1].add(triple.indexB);
    used[2].add(triple.indexC);
    tops.push(triple.mean[2] + RADIUS_M - BOUNDS.floor_z);
  }
  return tops;
}

function fruitCenters(image: RgbImage, camera: Camera, kind: "tangerine" | "tomato"): Fruit[] {
  const count = image.width * image.height;
  const peel = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    const red = image.rgb[index * 3];
    const green = image.rgb[index * 3 + 1];
    const blue = image.rgb[index * 3 + 2];
    peel[index] = kind === "tomato" ? tomatoPeel(red, green, blue) : tangerinePeel(red, green, blue);
  }
  const closed = morphology(
    morphology(peel, image.width, image.height, CLOSE_OFFSETS, "dilate"),
    image.width,
    image.height,
    CLOSE_OFFSETS,
    "erode",
  );
  const opened = morphology(
    morphology(closed, image.width, image.height, OPEN_OFFSETS, "erode"),
    image.width,
    image.height,
    OPEN_OFFSETS,
    "dilate",
  );
  const distance = distanceTransform(opened, image.width, image.height);
  const opening = openingPolygon(camera);
  if (!opening) return [];
  const peaks: Array<[number, number]> = [];
  for (let row = 0; row < image.height; row += 1) {
    for (let column = 0; column < image.width; column += 1) {
      const value = distance[row * image.width + column];
      if (value < 9 || !isPeak(distance, image.width, image.height, column, row, value)) continue;
      if (!insidePolygon(column, row, opening)) continue;
      peaks.push([column, row]);
    }
  }
  return collapsePeaks(peaks).map(([column, row]) => ({
    column,
    row,
    color: diskColor(image, Math.round(column), Math.round(row)),
  }));
}

/** One center per plateau. An exact distance transform ties several pixels; OpenCV's mask does not. */
function collapsePeaks(peaks: Array<[number, number]>): Array<[number, number]> {
  const unused = new Set(peaks.map(([column, row]) => `${column},${row}`));
  const centers: Array<[number, number]> = [];
  for (const [column, row] of peaks) {
    const start = `${column},${row}`;
    if (!unused.has(start)) continue;
    const queue: Array<[number, number]> = [[column, row]];
    unused.delete(start);
    let sumColumn = 0;
    let sumRow = 0;
    let count = 0;
    while (queue.length > 0) {
      const [currentColumn, currentRow] = queue.pop() as [number, number];
      sumColumn += currentColumn;
      sumRow += currentRow;
      count += 1;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const key = `${currentColumn + dx},${currentRow + dy}`;
          if (!unused.has(key)) continue;
          unused.delete(key);
          queue.push([currentColumn + dx, currentRow + dy]);
        }
      }
    }
    centers.push([sumColumn / count, sumRow / count]);
  }
  return centers;
}

function tangerinePeel(red: number, green: number, blue: number): number {
  const peak = Math.max(red, green, blue);
  const grey = Math.abs(red - green) < 0.05 && Math.abs(green - blue) < 0.05;
  if (peak < 0.28 || grey || red + green <= blue + 0.15) return 0;
  if (green < 0.18 && blue < 0.15) return 0;
  return 1;
}

function tomatoPeel(red: number, green: number, blue: number): number {
  const peak = Math.max(red, green, blue);
  const grey = Math.abs(red - green) < 0.05 && Math.abs(green - blue) < 0.05;
  if (peak < 0.22 || grey || red + green <= blue + 0.1) return 0;
  return 1;
}

function isPeak(
  distance: Float32Array,
  width: number,
  height: number,
  column: number,
  row: number,
  value: number,
): boolean {
  for (const [dx, dy] of PEAK_OFFSETS) {
    const x = column + dx;
    const y = row + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    if (distance[y * width + x] > value) return false;
  }
  return true;
}

function diskColor(image: RgbImage, column: number, row: number): Vec3 {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const x = column + dx;
      const y = row + dy;
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const index = (y * image.width + x) * 3;
      red += image.rgb[index];
      green += image.rgb[index + 1];
      blue += image.rgb[index + 2];
      count += 1;
    }
  }
  return [red / count, green / count, blue / count];
}

function openingPolygon(camera: Camera): Array<[number, number]> | null {
  const corners: Array<[number, number]> = [];
  for (const x of [BOUNDS.min_x, BOUNDS.max_x]) {
    for (const y of [BOUNDS.min_y, BOUNDS.max_y]) {
      const pixel = project(camera, [x, y, BOUNDS.rim_z]);
      if (!pixel) return null;
      corners.push(pixel);
    }
  }
  const centerX = corners.reduce((sum, point) => sum + point[0], 0) / corners.length;
  const centerY = corners.reduce((sum, point) => sum + point[1], 0) / corners.length;
  corners.sort(
    (left, right) =>
      Math.atan2(left[1] - centerY, left[0] - centerX) - Math.atan2(right[1] - centerY, right[0] - centerX),
  );
  return corners.map(([x, y]) => [centerX + (x - centerX) * 0.92, centerY + (y - centerY) * 0.92]);
}

function insidePolygon(column: number, row: number, polygon: Array<[number, number]>): boolean {
  const crosses: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    crosses.push((bx - ax) * (row - ay) - (by - ay) * (column - ax));
  }
  return crosses.every((value) => value >= 0) || crosses.every((value) => value <= 0);
}

function project(camera: Camera, point: Vec3): [number, number] | null {
  const relative: Vec3 = [
    point[0] - camera.origin[0],
    point[1] - camera.origin[1],
    point[2] - camera.origin[2],
  ];
  const cameraPoint = multiplyRow(relative, camera.rotation);
  if (cameraPoint[2] >= -1e-8) return null;
  const depth = -cameraPoint[2];
  const sensorHeight = (camera.sensor_width * PROTOCOL_HEIGHT) / PROTOCOL_WIDTH;
  const column = (0.5 + ((cameraPoint[0] / depth) * camera.lens) / camera.sensor_width) * PROTOCOL_WIDTH - 0.5;
  const row = (0.5 - ((cameraPoint[1] / depth) * camera.lens) / sensorHeight) * PROTOCOL_HEIGHT - 0.5;
  return [column, row];
}

function pixelRay(camera: Camera, column: number, row: number): Ray {
  const sensorHeight = (camera.sensor_width * PROTOCOL_HEIGHT) / PROTOCOL_WIDTH;
  const camX = ((column + 0.5) / PROTOCOL_WIDTH - 0.5) * (camera.sensor_width / camera.lens);
  const camY = (0.5 - (row + 0.5) / PROTOCOL_HEIGHT) * (sensorHeight / camera.lens);
  return {
    origin: [...camera.origin],
    direction: multiplyColumn(camera.rotation, [camX, camY, -1]),
  };
}

function closestPoint(rayA: Ray, rayB: Ray, gapM: number): Vec3 | null {
  const directionA = unit(rayA.direction);
  const directionB = unit(rayB.direction);
  const across: Vec3 = [
    rayA.origin[0] - rayB.origin[0],
    rayA.origin[1] - rayB.origin[1],
    rayA.origin[2] - rayB.origin[2],
  ];
  const cross = dot(directionA, directionB);
  const denom = 1 - cross * cross;
  if (denom < 1e-6) return null;
  const alongA = dot(directionA, across);
  const alongB = dot(directionB, across);
  const ta = (cross * alongB - alongA) / denom;
  const tb = (alongB - cross * alongA) / denom;
  if (ta <= 0 || tb <= 0) return null;
  const pointA = addScaled(rayA.origin, directionA, ta);
  const pointB = addScaled(rayB.origin, directionB, tb);
  if (distance(pointA, pointB) > gapM) return null;
  return [(pointA[0] + pointB[0]) / 2, (pointA[1] + pointB[1]) / 2, (pointA[2] + pointB[2]) / 2];
}

function inCrate(point: Vec3): boolean {
  return (
    point[0] > BOUNDS.min_x &&
    point[0] < BOUNDS.max_x &&
    point[1] > BOUNDS.min_y &&
    point[1] < BOUNDS.max_y &&
    point[2] > BOUNDS.floor_z &&
    point[2] < BOUNDS.rim_z + 0.08
  );
}

function morphology(
  binary: Uint8Array,
  width: number,
  height: number,
  offsets: Array<[number, number]>,
  mode: "dilate" | "erode",
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mode === "dilate") {
        let on = 0;
        for (const [dx, dy] of offsets) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height && binary[yy * width + xx]) {
            on = 1;
            break;
          }
        }
        out[y * width + x] = on;
      } else {
        let on = 1;
        for (const [dx, dy] of offsets) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height || !binary[yy * width + xx]) {
            on = 0;
            break;
          }
        }
        out[y * width + x] = on;
      }
    }
  }
  return out;
}

function distanceTransform(foreground: Uint8Array, width: number, height: number): Float32Array {
  const inf = 1e8;
  const grid = new Float32Array(width * height);
  for (let index = 0; index < grid.length; index += 1) grid[index] = foreground[index] ? inf : 0;
  const tmp = new Float32Array(width * height);
  const column = new Float32Array(height);
  const row = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) column[y] = grid[y * width + x];
    const transformed = distance1d(column);
    for (let y = 0; y < height; y += 1) tmp[y * width + x] = transformed[y];
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) row[x] = tmp[y * width + x];
    const transformed = distance1d(row);
    for (let x = 0; x < width; x += 1) out[y * width + x] = Math.sqrt(transformed[x]);
  }
  return out;
}

function distance1d(values: Float32Array): Float32Array {
  const n = values.length;
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q += 1) {
    let s = parabola(values, q, v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = parabola(values, q, v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const dx = q - v[k];
    d[q] = dx * dx + values[v[k]];
  }
  return d;
}

function parabola(values: Float32Array, q: number, vk: number): number {
  return (values[q] + q * q - (values[vk] + vk * vk)) / (2 * q - 2 * vk);
}

function ellipseOffsets(size: number): Array<[number, number]> {
  const radius = Math.floor(size / 2);
  const offsets: Array<[number, number]> = [];
  for (let i = 0; i < size; i += 1) {
    const dy = i - radius;
    const inside = radius * radius - dy * dy;
    if (inside < 0) continue;
    const dx = Math.round(radius * Math.sqrt(inside / (radius * radius)));
    for (let j = radius - dx; j <= radius + dx; j += 1) offsets.push([j - radius, i - radius]);
  }
  return offsets;
}

function multiplyRow(vector: Vec3, matrix: number[][]): Vec3 {
  return [
    vector[0] * matrix[0][0] + vector[1] * matrix[1][0] + vector[2] * matrix[2][0],
    vector[0] * matrix[0][1] + vector[1] * matrix[1][1] + vector[2] * matrix[2][1],
    vector[0] * matrix[0][2] + vector[1] * matrix[1][2] + vector[2] * matrix[2][2],
  ];
}

function multiplyColumn(matrix: number[][], vector: Vec3): Vec3 {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function unit(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function addScaled(origin: Vec3, direction: Vec3, scale: number): Vec3 {
  return [origin[0] + scale * direction[0], origin[1] + scale * direction[1], origin[2] + scale * direction[2]];
}

function distance(left: Vec3, right: Vec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanPoint(points: Vec3[]): Vec3 {
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
    points.reduce((sum, point) => sum + point[2], 0) / points.length,
  ];
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function colorDistance(left: Vec3, right: Vec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
