import { describe, expect, it } from "vitest";
import { HCP_PITCH, tangerineCount, tomatoMassKg, type Crate } from "./packing";

const crate: Crate = {
  name: "exemplo",
  lengthCm: 50,
  widthCm: 30,
  heightCm: 22,
};

describe("tangerineCount", () => {
  it("counts four layers from the documented example", () => {
    const estimate = tangerineCount(28, 6, 21, HCP_PITCH);
    expect(estimate.value).toBe(112);
    expect(estimate.unit).toBe("un");
    expect(estimate.flags).toEqual([]);
  });

  it("flags a pile whose height falls between layers", () => {
    const estimate = tangerineCount(10, 6, 18, HCP_PITCH);
    expect(estimate.flags).toContain("layer_height_inconsistent");
  });
});

describe("tomatoMassKg", () => {
  it("converts liters times bulk density", () => {
    const estimate = tomatoMassKg(crate, 20, 0.55);
    expect(estimate.value).toBeCloseTo(16.5, 5);
    expect(estimate.unit).toBe("kg");
  });
});
