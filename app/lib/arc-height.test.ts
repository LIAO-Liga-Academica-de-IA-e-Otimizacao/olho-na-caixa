import { inflateSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cameraRoundtripMeters, readArcLid, type RgbImage } from "./arc-height";

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
    const published = -1.0879 + 0.998045 * Number(row?.[5]);
    const lid = readArcLid("tomato", [readPng(`${stem}.png`), readPng(`${stem}-b.png`)]);
    expect(Math.abs(lid.heightCm - published)).toBeLessThan(0.4);
  }, 60000);

  it("reads the tangerine val still the way the frozen lid does", () => {
    const stem = path.join(ROOT, "sim/assets/detect/sides/val/tangerine-s5");
    if (!existsSync(`${stem}.png`)) return;
    const lid = readArcLid("tangerine", [
      readPng(`${stem}.png`),
      readPng(`${stem}-b.png`),
      readPng(`${stem}-c.png`),
    ]);
    expect(Math.abs(lid.heightCm - 7.53)).toBeLessThan(0.5);
  }, 60000);
});

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
