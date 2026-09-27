import { describe, expect, it } from "vitest";
import { analyzeFrame, isConvexQuad } from "./frame-quality";

function solid(luminance: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = luminance;
    data[index + 1] = luminance;
    data[index + 2] = luminance;
    data[index + 3] = 255;
  }
  return data;
}

describe("analyzeFrame", () => {
  it("warns when the frame is dark", () => {
    const quality = analyzeFrame({ data: solid(10), width: 8, height: 8 });
    expect(quality.warnings[0]).toMatch(/Escuro/);
  });

  it("accepts a mid gray frame", () => {
    const quality = analyzeFrame({ data: solid(120), width: 8, height: 8 });
    expect(quality.warnings).toEqual([]);
  });
});

describe("isConvexQuad", () => {
  it("accepts a rectangle in order", () => {
    expect(
      isConvexQuad([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true);
  });

  it("rejects a crossed quad", () => {
    expect(
      isConvexQuad([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(false);
  });
});
