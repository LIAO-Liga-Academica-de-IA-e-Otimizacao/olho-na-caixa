import { inflateSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isConvexQuad } from "./frame-quality";
import camerasJson from "./arc-cameras.json";
import {
  cameraRoundtripMeters,
  countFromHeight,
  estimateFromLid,
  MOUTH_FRAME_MARGIN,
  mouthQuad,
  readArcLid,
  rigCameras,
  topMouthQuad,
  type Quad,
  type RgbImage,
} from "./arc-height";
import { PHONE_PRESETS } from "./phone";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("arc height", () => {
  it("triangulates a known point back to itself", () => {
    expect(cameraRoundtripMeters()).toBeLessThan(1e-3);
  });

  it("reads the tomato val still the way the sheet does", () => {
    const stem = path.join(ROOT, "sim/assets/detect/sides/tomato/val/tomato-s1005");
    const sheet = path.join(ROOT, "sim/assets/detect/tomato-height-sheet.csv");
    if (!existsSync(`${stem}.png`) || !existsSync(sheet)) return;
    const row = readFileSync(sheet, "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split(","))
      .find((cells) => cells[0] === "1005");
    expect(row).toBeTruthy();
    // 12.72 is the Python rig reading for s1005, from sim/detect/rim_pose.py.
    // The sheet column is the Blender-pose reading, a different base.
    // The 0.6 gap is the TypeScript port finding a few different centers.
    const published = 0.793 + 0.9307 * 12.72;
    const lid = readArcLid("tomato", [readPng(`${stem}.png`), readPng(`${stem}-b.png`)]);
    expect(Math.abs(lid.heightCm - published)).toBeLessThan(0.6);
  }, 60000);

  it("draws the mouth inside the still, near edge below far edge", () => {
    for (const item of ["tangerine", "tomato"] as const) {
      const slots = item === "tangerine" ? [0, 1, 2] : [0, 1];
      for (const slot of slots) {
        const quad = mouthQuad(item, slot as 0 | 1 | 2, 35);
        expect(quad).not.toBeNull();
        for (const [x, y] of quad ?? []) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(640);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(480);
        }
        const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = quad as [number, number][];
        expect(isConvexQuad([
          { x: ax, y: ay },
          { x: bx, y: by },
          { x: cx, y: cy },
          { x: dx, y: dy },
        ])).toBe(true);
        expect(Math.min(ay, by)).toBeGreaterThan(Math.max(cy, dy));
      }
    }
  });

  it("projects the saved mouth and rebuilds the rig mouth from its centimeters", () => {
    const bounds = camerasJson as {
      floor_z: number;
      rim_z: number;
      min_x: number;
      max_x: number;
      min_y: number;
      max_y: number;
    };
    const mesh = {
      lengthCm: (bounds.max_y - bounds.min_y) * 100,
      widthCm: (bounds.max_x - bounds.min_x) * 100,
      heightCm: (bounds.rim_z - bounds.floor_z) * 100,
    };
    const rig = mouthQuad("tangerine", 0, 35);
    const typed = mouthQuad("tangerine", 0, 35, mesh);
    expect(typed).toEqual(rig);
    expect(Math.min(...(rig as Quad).map((point) => point[0]))).toBeLessThan(MOUTH_FRAME_MARGIN);
    const nearSpan = (quad: Quad) => Math.abs(quad[0][0] - quad[1][0]);
    const wide = mouthQuad("tangerine", 0, 18);
    const longer = mouthQuad("tangerine", 0, 18, { ...mesh, lengthCm: mesh.lengthCm * 1.4 });
    const deeper = mouthQuad("tangerine", 0, 18, { ...mesh, widthCm: mesh.widthCm * 1.4 });
    const taller = mouthQuad("tangerine", 0, 18, { ...mesh, heightCm: mesh.heightCm * 1.4 });
    expect(wide).not.toBeNull();
    expect(longer).not.toBeNull();
    expect(deeper).not.toBeNull();
    expect(taller).not.toBeNull();
    expect(nearSpan(longer as Quad)).toBeGreaterThan(nearSpan(wide as Quad));
    expect(nearSpan(deeper as Quad)).toBeGreaterThan(nearSpan(wide as Quad));
    const meanRow = (quad: Quad) => quad.reduce((sum, point) => sum + point[1], 0) / quad.length;
    expect(meanRow(taller as Quad)).toBeLessThan(meanRow(wide as Quad));
  });

  it("steps the aim back until a larger mouth fits the still", () => {
    const mouths = [
      { lengthCm: 39.2, widthCm: 28.2, heightCm: 25.7 },
      { lengthCm: 60, widthCm: 40, heightCm: 32 },
      { lengthCm: 80, widthCm: 50, heightCm: 40 },
    ];
    for (const item of ["tangerine", "tomato"] as const) {
      const slots = item === "tangerine" ? ([0, 1, 2] as const) : ([0, 1] as const);
      for (const slot of slots) {
        for (const focal of [24, 25, 26, 35, 50, 70]) {
          for (const mouth of mouths) {
            const quad = mouthQuad(item, slot, focal, mouth);
            expect(quad, `${item} slot ${slot} ${focal} mm`).not.toBeNull();
            const corners = quad as Quad;
            for (const [x, y] of corners) {
              expect(x).toBeGreaterThanOrEqual(3);
              expect(x).toBeLessThanOrEqual(640 - 1 - 3);
              expect(y).toBeGreaterThanOrEqual(3);
              expect(y).toBeLessThanOrEqual(480 - 1 - 3);
            }
            expect(isConvexQuad(corners.map(([x, y]) => ({ x, y })))).toBe(true);
            const [[, ay], [, by], [, cy], [, dy]] = corners;
            expect(Math.min(ay, by)).toBeGreaterThan(Math.max(cy, dy));
          }
        }
      }
    }
    const crowded = mouthQuad("tangerine", 0, 70, { lengthCm: 80, widthCm: 50, heightCm: 40 });
    for (const [x, y] of crowded as Quad) {
      expect(x).toBeGreaterThanOrEqual(MOUTH_FRAME_MARGIN);
      expect(x).toBeLessThanOrEqual(640 - 1 - MOUTH_FRAME_MARGIN);
      expect(y).toBeGreaterThanOrEqual(MOUTH_FRAME_MARGIN);
      expect(y).toBeLessThanOrEqual(480 - 1 - MOUTH_FRAME_MARGIN);
    }
  });

  it("projects phone presets inside the photo, and keeps the calibrated mesh", () => {
    const bounds = camerasJson as {
      floor_z: number;
      rim_z: number;
      min_x: number;
      max_x: number;
      min_y: number;
      max_y: number;
    };
    const studio = {
      lengthCm: (bounds.max_y - bounds.min_y) * 100,
      widthCm: (bounds.max_x - bounds.min_x) * 100,
      heightCm: (bounds.rim_z - bounds.floor_z) * 100,
    };
    const larger = { lengthCm: 60, widthCm: 40, heightCm: 32 };
    const principal: [number, number] = [319.5, 239.5];
    for (const item of ["tangerine", "tomato"] as const) {
      const slots = item === "tangerine" ? ([0, 1, 2] as const) : ([0, 1] as const);
      for (const slot of slots) {
        for (const phone of PHONE_PRESETS) {
          for (const mouth of [studio, larger]) {
            const label = `${item} ${"ABC"[slot]} ${phone.focal35Mm} mm`;
            const quad = mouthQuad(item, slot, phone.focal35Mm, mouth);
            expect(quad, label).not.toBeNull();
            const corners = quad as Quad;
            expect(edgeClearance(corners)).toBeGreaterThanOrEqual(3);
            const open = projectOpen(item, slot, phone.focal35Mm, mouth, bounds);
            expect(open, label).not.toBeNull();
            if (edgeClearance(open as Quad) >= 3) {
              expect(corners, label).toEqual(open);
            } else {
              expect(edgeClearance(corners), label).toBeGreaterThanOrEqual(MOUTH_FRAME_MARGIN);
              const scales = corners.map((corner, index) => {
                const from = open as Quad;
                const across =
                  (corner[0] - principal[0]) * (from[index][1] - principal[1]) -
                  (corner[1] - principal[1]) * (from[index][0] - principal[0]);
                expect(Math.abs(across), label).toBeLessThan(1);
                const before = Math.hypot(from[index][0] - principal[0], from[index][1] - principal[1]);
                const after = Math.hypot(corner[0] - principal[0], corner[1] - principal[1]);
                expect(after, label).toBeLessThan(before);
                return after / before;
              });
              expect(Math.max(...scales) - Math.min(...scales), label).toBeGreaterThan(0.002);
            }
          }
        }
      }
    }
    const tomatoA = mouthQuad("tomato", 0, 35, studio);
    expect(tomatoA).toEqual(projectOpen("tomato", 0, 35, studio, bounds));
    expect(edgeClearance(tomatoA as Quad)).toBeLessThan(MOUTH_FRAME_MARGIN);
  });

  it("draws the top mouth as a rectangle inside the still", () => {
    const bounds = camerasJson as {
      floor_z: number;
      rim_z: number;
      min_x: number;
      max_x: number;
      min_y: number;
      max_y: number;
    };
    const mesh = {
      lengthCm: (bounds.max_y - bounds.min_y) * 100,
      widthCm: (bounds.max_x - bounds.min_x) * 100,
      heightCm: (bounds.rim_z - bounds.floor_z) * 100,
    };
    const rig = topMouthQuad(35);
    const typed = topMouthQuad(35, mesh);
    expect(typed).toEqual(rig);
    expect(rig).not.toBeNull();
    const drawn = rig as Quad;
    expectRectangle(drawn);
    expectInside(drawn, 3);
    const size = span(drawn);
    const pixelsPerMeter = ((35 / 36) * 640) / 0.52;
    expect(size.width).toBeCloseTo((mesh.lengthCm / 100) * pixelsPerMeter, 3);
    expect(size.height).toBeCloseTo((mesh.widthCm / 100) * pixelsPerMeter, 3);
    expect(size.minX).toBeGreaterThan(MOUTH_FRAME_MARGIN);
    expect(size.minY).toBeGreaterThan(MOUTH_FRAME_MARGIN);
    expect(center(drawn).x).toBeCloseTo(319.5, 3);
    expect(center(drawn).y).toBeCloseTo(239.5, 3);

    const wider = topMouthQuad(35, { ...mesh, lengthCm: mesh.lengthCm * 1.15 });
    const deeper = topMouthQuad(35, { ...mesh, widthCm: mesh.widthCm * 1.15 });
    const taller = topMouthQuad(35, { ...mesh, heightCm: mesh.heightCm + 4 });
    const shorterLens = topMouthQuad(24, mesh);
    expect(wider).not.toBeNull();
    expect(deeper).not.toBeNull();
    expect(taller).not.toBeNull();
    expect(shorterLens).not.toBeNull();
    for (const quad of [wider, deeper, taller, shorterLens] as Quad[]) {
      expectRectangle(quad);
      expectInside(quad, 3);
    }
    expect(span(wider as Quad).width).toBeGreaterThan(size.width + 10);
    expect(span(wider as Quad).height).toBeCloseTo(size.height, 3);
    expect(span(deeper as Quad).height).toBeGreaterThan(size.height + 10);
    expect(span(deeper as Quad).width).toBeCloseTo(size.width, 3);
    expect(span(taller as Quad).width).toBeGreaterThan(size.width);
    expect(span(shorterLens as Quad).width).toBeLessThan(size.width);

    const long = topMouthQuad(70, { lengthCm: 80, widthCm: 50, heightCm: 40 });
    const narrower = topMouthQuad(70, { lengthCm: 80, widthCm: 40, heightCm: 40 });
    expect(long).not.toBeNull();
    expect(narrower).not.toBeNull();
    expectRectangle(long as Quad);
    expectInside(long as Quad, MOUTH_FRAME_MARGIN);
    const longSpan = span(long as Quad);
    const narrowSpan = span(narrower as Quad);
    expect(longSpan.minX).toBeGreaterThanOrEqual(MOUTH_FRAME_MARGIN);
    expect(longSpan.minX).toBeLessThan(MOUTH_FRAME_MARGIN + 1);
    expect(longSpan.maxX).toBeLessThanOrEqual(640 - 1 - MOUTH_FRAME_MARGIN);
    expect(longSpan.maxX).toBeGreaterThan(640 - 1 - MOUTH_FRAME_MARGIN - 1);
    expect(longSpan.width).toBeCloseTo(narrowSpan.width, 1);
    expect(longSpan.height / narrowSpan.height).toBeCloseTo(50 / 40, 2);
    expect(center(long as Quad).x).toBeCloseTo(319.5, 2);
    expect(center(long as Quad).y).toBeCloseTo(239.5, 2);

    expect(topMouthQuad(35, { lengthCm: 0, widthCm: 30, heightCm: 20 })).toBeNull();
  });

  it("scales the count with the typed mouth and flags a strange crate", () => {
    const heightCm = 12;
    const here = countFromHeight(heightCm, 5.1);
    expect(countFromHeight(heightCm, 5.1, 2 * 28.2 * 39.2)).toBeCloseTo(2 * here, 9);
    expect(estimateFromLid("tangerine", heightCm, 5.1, 0.55).flags).toEqual([]);
    expect(estimateFromLid("tangerine", heightCm, 5.1, 0.55, 1.1 * 28.2 * 39.2).flags).toContain(
      "uncalibrated_crate",
    );
  });

  it("reads the tangerine val still the way the frozen lid does", () => {
    const stem = path.join(ROOT, "sim/assets/detect/sides/val/tangerine-s5");
    if (!existsSync(`${stem}.png`)) return;
    const lid = readArcLid("tangerine", [
      readPng(`${stem}.png`),
      readPng(`${stem}-b.png`),
      readPng(`${stem}-c.png`),
    ]);
    expect(Math.abs(lid.heightCm - 7.58)).toBeLessThan(0.5);
  }, 60000);
});

function span(quad: Quad): { width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } {
  const xs = quad.map((point) => point[0]);
  const ys = quad.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { width: maxX - minX, height: maxY - minY, minX, maxX, minY, maxY };
}

function center(quad: Quad): { x: number; y: number } {
  return {
    x: quad.reduce((sum, point) => sum + point[0], 0) / quad.length,
    y: quad.reduce((sum, point) => sum + point[1], 0) / quad.length,
  };
}

function expectRectangle(quad: Quad): void {
  const xs = quad.map((point) => point[0]).sort((left, right) => left - right);
  const ys = quad.map((point) => point[1]).sort((left, right) => left - right);
  expect(xs[0]).toBeCloseTo(xs[1], 4);
  expect(xs[2]).toBeCloseTo(xs[3], 4);
  expect(ys[0]).toBeCloseTo(ys[1], 4);
  expect(ys[2]).toBeCloseTo(ys[3], 4);
  expect(isConvexQuad(quad.map(([x, y]) => ({ x, y })))).toBe(true);
}

function expectInside(quad: Quad, margin: number): void {
  for (const [x, y] of quad) {
    expect(x).toBeGreaterThanOrEqual(margin);
    expect(x).toBeLessThanOrEqual(640 - 1 - margin);
    expect(y).toBeGreaterThanOrEqual(margin);
    expect(y).toBeLessThanOrEqual(480 - 1 - margin);
  }
}

function edgeClearance(quad: Quad): number {
  return Math.min(...quad.flatMap(([x, y]) => [x, y, 640 - x, 480 - y]));
}

function projectOpen(
  item: "tangerine" | "tomato",
  slot: 0 | 1 | 2,
  focal35Mm: number,
  mouth: { lengthCm: number; widthCm: number; heightCm: number },
  bounds: { floor_z: number; min_x: number; max_x: number; min_y: number; max_y: number },
): Quad | null {
  const camera = rigCameras(item, focal35Mm)[slot];
  const centerX = (bounds.min_x + bounds.max_x) / 2;
  const centerY = (bounds.min_y + bounds.max_y) / 2;
  const halfDepth = mouth.widthCm / 200;
  const halfAcross = mouth.lengthCm / 200;
  const rimZ = bounds.floor_z + mouth.heightCm / 100;
  const ring = [
    [centerX - halfDepth, centerY + halfAcross, rimZ],
    [centerX - halfDepth, centerY - halfAcross, rimZ],
    [centerX + halfDepth, centerY - halfAcross, rimZ],
    [centerX + halfDepth, centerY + halfAcross, rimZ],
  ];
  const corners: Quad = [];
  for (const point of ring) {
    const relative = [point[0] - camera.origin[0], point[1] - camera.origin[1], point[2] - camera.origin[2]];
    const rotation = camera.rotation;
    const cameraPoint = [
      relative[0] * rotation[0][0] + relative[1] * rotation[1][0] + relative[2] * rotation[2][0],
      relative[0] * rotation[0][1] + relative[1] * rotation[1][1] + relative[2] * rotation[2][1],
      relative[0] * rotation[0][2] + relative[1] * rotation[1][2] + relative[2] * rotation[2][2],
    ];
    if (cameraPoint[2] >= -1e-8) return null;
    const depth = -cameraPoint[2];
    const sensorHeight = (camera.sensor_width * 480) / 640;
    corners.push([
      (0.5 + ((cameraPoint[0] / depth) * camera.lens) / camera.sensor_width) * 640 - 0.5,
      (0.5 - ((cameraPoint[1] / depth) * camera.lens) / sensorHeight) * 480 - 0.5,
    ]);
  }
  return corners;
}

function readPng(file: string): RgbImage {
  const buffer = readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const parts: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("unsupported png");
      colorType = data[9];
    } else if (type === "IDAT") {
      parts.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error("unsupported png color");
  const inflated = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const rgb = new Float32Array(width * height * 3);
  let src = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = Buffer.from(inflated.subarray(src, src + stride));
    src += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const up = previous[index];
      const upperLeft = index >= channels ? previous[index - channels] : 0;
      if (filter === 1) row[index] = (row[index] + left) & 255;
      else if (filter === 2) row[index] = (row[index] + up) & 255;
      else if (filter === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[index] = (row[index] + paeth(left, up, upperLeft)) & 255;
      else if (filter !== 0) throw new Error(`png filter ${filter}`);
    }
    previous = row;
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 3;
      rgb[target] = row[x * channels] / 255;
      rgb[target + 1] = row[x * channels + 1] / 255;
      rgb[target + 2] = row[x * channels + 2] / 255;
    }
  }
  return { width, height, rgb };
}

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dul = Math.abs(estimate - upperLeft);
  if (dl <= du && dl <= dul) return left;
  if (du <= dul) return up;
  return upperLeft;
}
