import type { PixelBuffer, Point } from "./frame-quality";
import { openingScale } from "./homography";

export type ProduceItem = "tangerine" | "tomato";

export type Mark = {
  x: number;
  y: number;
  /** Radius as a fraction of the image width. */
  radius: number;
  diameterCm: number;
};

export type TopLayer = {
  marks: Mark[];
  count: number;
  medianDiameterCm: number | null;
  matchesItem: boolean;
  elapsedMs: number;
};

const MIN_PIXELS = 40;

/**
 * Provisional marks from peel color. A YOLO nano model replaces this later.
 * Orange counts as tangerine. Red counts as tomato. Pieces outside the opening are ignored.
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
  const blobs = components(buffer, corners, item);
  const marks = blobs.map((pixels) => toMark(buffer, pixels, toPlane));
  marks.sort((a, b) => a.x - b.x);
  const diameters = marks.map((mark) => mark.diameterCm).sort((a, b) => a - b);
  const medianDiameterCm = median(diameters);
  return {
    marks,
    count: marks.length,
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

function toMark(buffer: PixelBuffer, pixels: number[], toPlane: (point: Point) => Point): Mark {
  let sumX = 0;
  let sumY = 0;
  let minPlaneX = Infinity;
  let maxPlaneX = -Infinity;
  let minPlaneY = Infinity;
  let maxPlaneY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pixel of pixels) {
    const x = pixel % buffer.width;
    const y = Math.floor(pixel / buffer.width);
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const near = toPlane({ x: x / buffer.width, y: y / buffer.height });
    const far = toPlane({ x: (x + 1) / buffer.width, y: (y + 1) / buffer.height });
    minPlaneX = Math.min(minPlaneX, near.x, far.x);
    maxPlaneX = Math.max(maxPlaneX, near.x, far.x);
    minPlaneY = Math.min(minPlaneY, near.y, far.y);
    maxPlaneY = Math.max(maxPlaneY, near.y, far.y);
  }
  const count = pixels.length;
  return {
    x: (sumX / count + 0.5) / buffer.width,
    y: (sumY / count + 0.5) / buffer.height,
    radius: Math.max(maxX - minX, maxY - minY) / 2 / buffer.width,
    diameterCm: ((maxPlaneX - minPlaneX) + (maxPlaneY - minPlaneY)) / 2,
  };
}

function components(buffer: PixelBuffer, corners: Point[], item: ProduceItem): number[][] {
  const { data, width, height } = buffer;
  const seen = new Uint8Array(width * height);
  const blobs: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start]) continue;
      if (!matchesItem(data, start * 4, item)) continue;
      if (!insideQuad({ x: (x + 0.5) / width, y: (y + 0.5) / height }, corners)) {
        seen[start] = 1;
        continue;
      }
      const pixels: number[] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const current = stack.pop() as number;
        pixels.push(current);
        const cx = current % width;
        const cy = Math.floor(current / width);
        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (const next of neighbors) {
          if (next < 0 || next >= width * height || seen[next]) continue;
          const nx = next % width;
          const ny = Math.floor(next / width);
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          seen[next] = 1;
          if (!matchesItem(data, next * 4, item)) continue;
          if (!insideQuad({ x: (nx + 0.5) / width, y: (ny + 0.5) / height }, corners)) continue;
          stack.push(next);
        }
      }
      if (pixels.length >= MIN_PIXELS) blobs.push(pixels);
    }
  }
  return blobs;
}

function matchesItem(data: Uint8ClampedArray, offset: number, item: ProduceItem): boolean {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  if (item === "tangerine") {
    return red > 170 && green >= 70 && green < 170 && blue < 120 && red > green + 70;
  }
  return red > 150 && green < 70 && blue < 70 && red > green + 50;
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
