import { describe, expect, it } from "vitest";
import { testStillSet } from "./test-stills";

describe("test stills", () => {
  it("points at the book scenes under the served prefix", () => {
    expect(testStillSet("tangerine")).toEqual({
      top: "/test-stills/images/val/tangerine-s5.png",
      a: "/test-stills/sides/val/tangerine-s5.png",
      b: "/test-stills/sides/val/tangerine-s5-b.png",
      c: "/test-stills/sides/val/tangerine-s5-c.png",
      label: "tangerine-s5",
    });
  });

  it("gives tomato two arc frames and no C", () => {
    const tomato = testStillSet("tomato");
    expect(tomato.top).toBe("/test-stills/images/val/tomato-s1005.png");
    expect(tomato.a).toBe("/test-stills/sides/tomato/val/tomato-s1005.png");
    expect(tomato.b).toBe("/test-stills/sides/tomato/val/tomato-s1005-b.png");
    expect(tomato.c).toBeNull();
  });
});
