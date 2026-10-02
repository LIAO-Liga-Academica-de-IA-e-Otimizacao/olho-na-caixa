import type { PixelBuffer, Point } from "./frame-quality";
import { openingScale } from "./homography";

export type ProduceItem = "tangerine" | "tomato";

export type Mark = {
  x: number;
  y: number;
  /** Radius as a fraction of the image width. */
  radius: number;
  /** Box width as a fraction of the image width. */
  width: number;
  /** Box height as a fraction of the image height. */
  height: number;
  diameterCm: number;
};

export type TopLayer = {
  marks: Mark[];
  count: number;
  /** Boxes inside the opening whose label is the other fruit. A high share means the wrong item. */
  otherCount: number;
  medianDiameterCm: number | null;
  matchesItem: boolean;
  elapsedMs: number;
};

/**
 * Provisional marks from peel color. A YOLO nano model replaces this later.
 *
 * Tangerine is the orange band. Tomato, in a tomato crate, is red, red-orange,
 * or green: a ripe shoulder is not deep red, and an unripe fruit is green.
 * Each mark is one distance-transform peak, so a pale highlight does not
 * shrink the fruit and two fruits that touch do not become one blob.
 * Pieces outside the opening are ignored.
 */
export function markTopLayer(
  buffer: PixelBuffer,
  corners: Point[],
  lengthCm: number,
  widthCm: number,
  item: ProduceItem,
): TopLayer {
  const started = performance.now();
  const toPlane = openingScale(corners, lengthCm, widthCm);
  const mask = peelMask(buffer, corners, item);
  fillHoles(mask, buffer.width, buffer.height);
  const distance = distanceTransform(mask, buffer.width, buffer.height);
  const marks = peaks(distance, buffer.width, buffer.height).map((peak) =>
    toMark(buffer.width, buffer.height, peak, toPlane),
  );
  marks.sort((left, right) => left.x - right.x);
  const diameters = marks.map((mark) => mark.diameterCm).sort((left, right) => left - right);
  const medianDiameterCm = median(diameters);
  return {
    marks,
    count: marks.length,
    otherCount: 0,
    medianDiameterCm,
    matchesItem: marks.length > 0,
    elapsedMs: performance.now() - started,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

function toMark(
  width: number,
  height: number,
  peak: { column: number; row: number; radiusPx: number },
  toPlane: (point: Point) => Point,
): Mark {
  const cx = (peak.column + 0.5) / width;
  const cy = (peak.row + 0.5) / height;
  const center = toPlane({ x: cx, y: cy });
  const right = toPlane({ x: Math.min(0.999, cx + peak.radiusPx / width), y: cy });
  const down = toPlane({ x: cx, y: Math.min(0.999, cy + peak.radiusPx / height) });
  const radiusCm =
    (Math.hypot(right.x - center.x, right.y - center.y) + Math.hypot(down.x - center.x, down.y - center.y)) / 2;
  return {
    x: cx,
    y: cy,
    radius: peak.radiusPx / width,
    width: (peak.radiusPx * 2) / width,
    height: (peak.radiusPx * 2) / height,
    diameterCm: radiusCm * 2,
  };
}

function peelMask(buffer: PixelBuffer, corners: Point[], item: ProduceItem): Uint8Array {
  const { data, width, height } = buffer;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!matchesItem(data, index * 4, item)) continue;
      if (!insideQuad({ x: (x + 0.5) / width, y: (y + 0.5) / height }, corners)) continue;
      mask[index] = 1;
    }
  }
  return mask;
}

/** Background trapped inside a fruit becomes peel, so a highlight is not a hole. */
function fillHoles(mask: Uint8Array, width: number, height: number): void {
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x += 1) {
    if (!mask[x]) stack.push(x);
    const bottom = (height - 1) * width + x;
    if (!mask[bottom]) stack.push(bottom);
  }
  for (let y = 0; y < height; y += 1) {
    const left = y * width;
    const right = left + width - 1;
    if (!mask[left]) stack.push(left);
    if (!mask[right]) stack.push(right);
  }
  while (stack.length > 0) {
    const current = stack.pop() as number;
    if (outside[current] || mask[current]) continue;
    outside[current] = 1;
    const x = current % width;
    if (x > 0) stack.push(current - 1);
    if (x + 1 < width) stack.push(current + 1);
    if (current >= width) stack.push(current - width);
    if (current + width < width * height) stack.push(current + width);
  }
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] && !outside[index]) mask[index] = 1;
  }
}

function peaks(
  distance: Float32Array,
  width: number,
  height: number,
): Array<{ column: number; row: number; radiusPx: number }> {
  const minRadius = Math.max(3, Math.round(0.006 * Math.min(width, height)));
  const apart = Math.max(5, Math.round(0.012 * Math.min(width, height)));
  const candidates: Array<{ column: number; row: number; radiusPx: number }> = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const value = distance[row * width + column];
      if (value < minRadius) continue;
      let higher = false;
      for (let dy = -1; dy <= 1 && !higher; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = column + dx;
          const y = row + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (distance[y * width + x] > value) {
            higher = true;
            break;
          }
        }
      }
      if (!higher) candidates.push({ column, row, radiusPx: value });
    }
  }
  candidates.sort((left, right) => right.radiusPx - left.radiusPx);
  const kept: Array<{ column: number; row: number; radiusPx: number }> = [];
  for (const candidate of candidates) {
    const crowded = kept.some(
      (other) => Math.hypot(other.column - candidate.column, other.row - candidate.row) < apart,
    );
    if (!crowded) kept.push(candidate);
  }
  return kept;
}

function matchesItem(data: Uint8ClampedArray, offset: number, item: ProduceItem): boolean {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  if (item === "tangerine") {
    return red > 170 && green >= 70 && green < 170 && blue < 120 && red > green + 70;
  }
  const peak = Math.max(red, green, blue);
  if (peak < 70) return false;
  if (Math.abs(red - green) < 15 && Math.abs(green - blue) < 15) return false;
  if (green > 80 && green >= red - 10 && green > blue + 15) return true;
  return red > 110 && red > blue + 25 && red + 15 > green;
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
  const count = values.length;
  const result = new Float32Array(count);
  const v = new Int32Array(count);
  const z = new Float64Array(count + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < count; q += 1) {
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
  for (let q = 0; q < count; q += 1) {
    while (z[k + 1] < q) k += 1;
    const dx = q - v[k];
    result[q] = dx * dx + values[v[k]];
  }
  return result;
}

function parabola(values: Float32Array, q: number, vk: number): number {
  return (values[q] + q * q - (values[vk] + vk * vk)) / (2 * q - 2 * vk);
}

function insideQuad(point: Point, corners: Point[]): boolean {
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = corners[index];
    const b = corners[(index + 1) % 4];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    const next = Math.sign(cross);
    if (sign === 0) sign = next;
    else if (next !== sign) return false;
  }
  return true;
}
