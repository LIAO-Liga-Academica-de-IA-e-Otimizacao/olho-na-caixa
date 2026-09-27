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

  it("does not call an orange piece a tomato", () => {
    const buffer = blank(80, 80);
    paint(buffer, 30, 30, 20, [216, 90, 36]);
    const layer = markTopLayer(buffer, FULL_OPENING, 40, 40, "tomato");
    expect(layer.count).toBe(0);
    expect(layer.matchesItem).toBe(false);
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
