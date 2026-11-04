import { describe, expect, it } from "vitest";
import { isConvexQuad } from "./frame-quality";
import { mouthQuad } from "./arc-height";
import { demoFrames, demoPlan, demoTruth, STUDIO_CRATE } from "./demo-scenes";

describe("demo scenes", () => {
  it("seats each side mouth on the protocol trapezium", () => {
    for (const item of ["tangerine", "tomato"] as const) {
      const frames = demoFrames(item);
      expect(frames[0].id).toBe("top");
      expect(frames[0].target).toEqual([
        [0, 0],
        [639, 0],
        [639, 479],
        [0, 479],
      ]);
      const sides = frames.slice(1);
      expect(sides.map((frame) => frame.id)).toEqual(item === "tangerine" ? ["a", "b", "c"] : ["a", "b"]);
      sides.forEach((frame, index) => {
        const protocol = mouthQuad(item, index as 0 | 1 | 2, 35, {
          lengthCm: STUDIO_CRATE.lengthCm,
          widthCm: STUDIO_CRATE.widthCm,
          heightCm: STUDIO_CRATE.heightCm,
        });
        expect(frame.target).toEqual(protocol);
        expect(frame.source).toHaveLength(4);
        expect(
          isConvexQuad(frame.target.map(([x, y]) => ({ x, y }))),
        ).toBe(true);
      });
    }
  });

  it("keeps the book truth for the two demo seeds", () => {
    expect(demoTruth("tangerine")).toMatchObject({ seed: 5, inside: 86, heightCm: 8.14 });
    expect(demoTruth("tomato")).toMatchObject({ seed: 1005, inside: 102, heightCm: 12.71 });
  });

  it("puts the arc cameras on opposite sides of the center station", () => {
    const tangerine = demoPlan("tangerine");
    const tomato = demoPlan("tomato");
    expect(tangerine.marks.map((mark) => mark.id)).toEqual(["top", "a", "b", "c"]);
    expect(tomato.marks.map((mark) => mark.id)).toEqual(["top", "a", "b"]);
    const [left, center, right] = tangerine.marks.slice(1).sort((first, second) => first.point.x - second.point.x);
    expect(left.id).not.toBe("a");
    expect(right.id).not.toBe("a");
    expect(center.id).toBe("a");
    expect(tangerine.crate).toHaveLength(4);
    expect(tangerine.near).toHaveLength(2);
  });
});
