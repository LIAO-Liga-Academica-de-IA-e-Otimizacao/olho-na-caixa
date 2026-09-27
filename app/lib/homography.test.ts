import { describe, expect, it } from "vitest";
import { openingScale } from "./homography";

describe("openingScale", () => {
  it("maps the opening corners onto the crate size", () => {
    const map = openingScale(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      50,
      30,
    );
    expect(map({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(map({ x: 1, y: 0 }).x).toBeCloseTo(50);
    expect(map({ x: 1, y: 0 }).y).toBeCloseTo(0);
    expect(map({ x: 0.5, y: 0.5 }).x).toBeCloseTo(25);
    expect(map({ x: 0.5, y: 0.5 }).y).toBeCloseTo(15);
  });

  it("maps a quad that does not fill the image", () => {
    const map = openingScale(
      [
        { x: 0.2, y: 0.25 },
        { x: 0.8, y: 0.25 },
        { x: 0.8, y: 0.75 },
        { x: 0.2, y: 0.75 },
      ],
      60,
      40,
    );
    expect(map({ x: 0.5, y: 0.5 }).x).toBeCloseTo(30);
    expect(map({ x: 0.5, y: 0.5 }).y).toBeCloseTo(20);
  });
});
