import { describe, expect, it } from "vitest";
import { letterboxLayout, undoLetterbox } from "./yolo-frame";

describe("letterbox", () => {
  it("pads a 640 by 480 photo on the top and bottom", () => {
    const box = letterboxLayout(640, 480);
    expect(box.scale).toBeCloseTo(0.5);
    expect(box.resizedWidth).toBe(320);
    expect(box.resizedHeight).toBe(240);
    expect(box.left).toBe(0);
    expect(box.top).toBe(40);
  });

  it("puts a box from the 320 square back on the photo", () => {
    const anchors = 1;
    const data = new Float32Array([160, 160, 40, 40, 0.9, 0.1]);
    const back = undoLetterbox(data, anchors, letterboxLayout(640, 480), 640, 480);
    expect(back[0]).toBeCloseTo(0.5);
    expect(back[1]).toBeCloseTo(0.5);
    expect(back[2]).toBeCloseTo(40 / 0.5 / 640);
    expect(back[3]).toBeCloseTo(40 / 0.5 / 480);
  });
});
