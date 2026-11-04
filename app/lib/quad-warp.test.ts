import { describe, expect, it } from "vitest";
import { quadMap } from "./homography";
import { warpRgba } from "./quad-warp";

describe("warpRgba", () => {
  it("leaves a photo unchanged when the quads are the same", () => {
    const width = 4;
    const height = 4;
    const source = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      source[index * 4] = index * 10;
      source[index * 4 + 1] = 20;
      source[index * 4 + 2] = 30;
      source[index * 4 + 3] = 255;
    }
    const corners = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ];
    const warped = warpRgba(source, width, height, corners, corners, [1, 2, 3]);
    expect(Array.from(warped)).toEqual(Array.from(source));
  });

  it("moves a corner pixel onto the destination corner", () => {
    const width = 6;
    const height = 6;
    const source = new Uint8ClampedArray(width * height * 4);
    source[0] = 200;
    source[1] = 10;
    source[2] = 10;
    const from = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const to = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
    ];
    const warped = warpRgba(source, width, height, from, to, [0, 0, 0]);
    const moved = (1 * width + 1) * 4;
    expect(warped[moved]).toBe(200);
    expect(warped[moved + 1]).toBe(10);
    expect(warped[0]).toBe(0);
  });

  it("fills samples outside the photo with the border", () => {
    const width = 3;
    const height = 3;
    const source = new Uint8ClampedArray(width * height * 4).fill(255);
    const from = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const to = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];
    const warped = warpRgba(source, width, height, from, to, [7, 8, 9]);
    const outside = (2 * width + 2) * 4;
    expect([warped[outside], warped[outside + 1], warped[outside + 2]]).toEqual([7, 8, 9]);
  });
});

describe("quadMap", () => {
  it("sends each source corner to the matching destination", () => {
    const from = [
      { x: 9, y: 358 },
      { x: 629, y: 359 },
      { x: 520, y: 91 },
      { x: 115, y: 92 },
    ];
    const to = [
      { x: 10, y: 351.5 },
      { x: 634.3, y: 342.3 },
      { x: 525.6, y: 91.4 },
      { x: 108.6, y: 96.3 },
    ];
    const map = quadMap(from, to);
    from.forEach((point, index) => {
      const landed = map(point);
      expect(landed.x).toBeCloseTo(to[index].x, 4);
      expect(landed.y).toBeCloseTo(to[index].y, 4);
    });
  });
});
