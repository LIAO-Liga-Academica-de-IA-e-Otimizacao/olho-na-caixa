import { describe, expect, it } from "vitest";
import type { PixelBuffer } from "./frame-quality";
import { markTopLayer } from "./top-layer";

const FULL_OPENING = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function blank(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 230;
    data[index + 1] = 222;
    data[index + 2] = 209;
    data[index + 3] = 255;
  }
  return { data, width, height };
}

function paintDisk(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  radius: number,
  color: [number, number, number],
) {
  for (let y = Math.max(0, cy - radius); y <= cy + radius && y < buffer.height; y += 1) {
    for (let x = Math.max(0, cx - radius); x <= cx + radius && x < buffer.width; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const index = (y * buffer.width + x) * 4;
      buffer.data[index] = color[0];
      buffer.data[index + 1] = color[1];
      buffer.data[index + 2] = color[2];
    }
  }
}

function paint(buffer: PixelBuffer, x0: number, y0: number, size: number, color: [number, number, number]) {
  for (let y = y0; y < y0 + size; y += 1) {
    for (let x = x0; x < x0 + size; x += 1) {
      const index = (y * buffer.width + x) * 4;
      buffer.data[index] = color[0];
      buffer.data[index + 1] = color[1];
      buffer.data[index + 2] = color[2];
    }
  }
}

describe("markTopLayer", () => {
  it("measures an orange piece against the opening", () => {
    const buffer = blank(80, 80);
    paint(buffer, 30, 30, 20, [216, 90, 36]);
    const layer = markTopLayer(buffer, FULL_OPENING, 40, 40, "tangerine");
    expect(layer.count).toBe(1);
    expect(layer.matchesItem).toBe(true);
    expect(layer.medianDiameterCm).toBeCloseTo(10, 0);
    expect(layer.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("counts a ripening orange piece and a green tomato, not the grey ground", () => {
    const buffer = blank(120, 80);
    paint(buffer, 8, 30, 24, [216, 90, 36]);
    paint(buffer, 70, 28, 28, [70, 160, 50]);
    const layer = markTopLayer(buffer, FULL_OPENING, 120, 80, "tomato");
    expect(layer.count).toBe(2);
    expect(layer.medianDiameterCm).toBeGreaterThan(18);
    expect(layer.medianDiameterCm).toBeLessThan(32);
  });

  it("does not call a green tomato a tangerine", () => {
    const buffer = blank(80, 80);
    paint(buffer, 30, 30, 20, [70, 160, 50]);
    const layer = markTopLayer(buffer, FULL_OPENING, 40, 40, "tangerine");
    expect(layer.count).toBe(0);
  });

  it("keeps one mark when a highlight sits in the middle of a tomato", () => {
    const buffer = blank(80, 80);
    paint(buffer, 24, 24, 32, [190, 40, 35]);
    paint(buffer, 34, 34, 12, [245, 245, 245]);
    const layer = markTopLayer(buffer, FULL_OPENING, 40, 40, "tomato");
    expect(layer.count).toBe(1);
    expect(layer.medianDiameterCm).toBeGreaterThan(12);
  });

  it("splits two tomatoes that touch", () => {
    const buffer = blank(100, 60);
    paintDisk(buffer, 28, 30, 16, [180, 45, 40]);
    paintDisk(buffer, 58, 30, 16, [170, 50, 35]);
    const layer = markTopLayer(buffer, FULL_OPENING, 100, 60, "tomato");
    expect(layer.count).toBe(2);
    for (const mark of layer.marks) expect(mark.diameterCm).toBeGreaterThan(20);
  });

  it("ignores a piece outside the opening", () => {
    const buffer = blank(80, 80);
    paint(buffer, 2, 2, 16, [216, 90, 36]);
    const layer = markTopLayer(
      buffer,
      [
        { x: 0.4, y: 0.4 },
        { x: 0.9, y: 0.4 },
        { x: 0.9, y: 0.9 },
        { x: 0.4, y: 0.9 },
      ],
      40,
      40,
      "tangerine",
    );
    expect(layer.count).toBe(0);
  });

  it("counts two pieces and reports the median diameter", () => {
    const buffer = blank(100, 40);
    paint(buffer, 5, 10, 10, [216, 90, 36]);
    paint(buffer, 40, 8, 20, [216, 90, 36]);
    const layer = markTopLayer(buffer, FULL_OPENING, 100, 40, "tangerine");
    expect(layer.count).toBe(2);
    expect(layer.medianDiameterCm).toBeCloseTo(15, 0);
  });
});
