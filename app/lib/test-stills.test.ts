import { describe, expect, it } from "vitest";
import { isConvexQuad } from "./frame-quality";
import { probeStillSet, testStillSet } from "./test-stills";

describe("test stills", () => {
  it("points at the book scenes under the served prefix", () => {
    const tangerine = testStillSet("tangerine");
    expect(tangerine.top).toBe("/test-stills/images/val/tangerine-s5.png");
    expect(tangerine.a).toBe("/test-stills/sides/val/tangerine-s5.png");
    expect(tangerine.b).toBe("/test-stills/sides/val/tangerine-s5-b.png");
    expect(tangerine.c).toBe("/test-stills/sides/val/tangerine-s5-c.png");
    expect(tangerine.label).toBe("tangerine-s5");
  });

  it("gives tomato two arc frames and no C", () => {
    const tomato = testStillSet("tomato");
    expect(tomato.top).toBe("/test-stills/images/val/tomato-s1005.png");
    expect(tomato.a).toBe("/test-stills/sides/tomato/val/tomato-s1005.png");
    expect(tomato.b).toBe("/test-stills/sides/tomato/val/tomato-s1005-b.png");
    expect(tomato.c).toBeNull();
  });

  it("places four convex corners near the frame", () => {
    for (const item of ["tangerine", "tomato"] as const) {
      const corners = testStillSet(item).corners;
      expect(corners).toHaveLength(4);
      expect(isConvexQuad(corners.map(([x, y]) => ({ x, y })))).toBe(true);
      for (const [x, y] of corners) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1.1);
      }
    }
  });
});

describe("probe stills", () => {
  it("serves one solid frame per slot for each gate probe", () => {
    for (const kind of ["dark", "blown", "ok"] as const) {
      const set = probeStillSet(kind);
      for (const url of [set.top, set.a, set.b, set.c]) {
        expect(url).toBe(`/test-stills/images/val/gate-${kind}.png`);
      }
      expect(set.label.startsWith("prova-")).toBe(true);
      expect(set.corners).toHaveLength(4);
      expect(isConvexQuad(set.corners.map(([x, y]) => ({ x, y })))).toBe(true);
    }
  });
});
