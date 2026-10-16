import { describe, expect, it } from "vitest";
import { positiveNumber } from "./positive-number";

describe("positiveNumber", () => {
  it("accepts dot and comma decimal separators", () => {
    expect(positiveNumber(" 35.5 ")).toBe(35.5);
    expect(positiveNumber("0,55")).toBe(0.55);
  });

  it("rejects empty, malformed, non-finite, and non-positive values", () => {
    for (const value of ["", " ", "abc", "1,2.3", "Infinity", "0", "-2"]) {
      expect(positiveNumber(value)).toBeNull();
    }
  });
});
