import { describe, expect, it } from "vitest";
import { focalPx, PHONE_PRESETS, SIMULATOR_PHONE } from "./phone";

describe("phone profile", () => {
  it("matches the studio lens at 35 mm", () => {
    expect(focalPx(SIMULATOR_PHONE.focal35Mm, 640)).toBeCloseTo((35 / 36) * 640, 9);
  });

  it("sees wider than the simulator on a 24 mm phone", () => {
    expect(focalPx(24, 640)).toBeLessThan(focalPx(35, 640));
  });

  it("ships presets with positive focals", () => {
    for (const preset of PHONE_PRESETS) expect(preset.focal35Mm).toBeGreaterThan(0);
  });
});
