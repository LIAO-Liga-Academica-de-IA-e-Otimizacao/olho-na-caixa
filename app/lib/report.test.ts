import { describe, expect, it } from "vitest";
import { countsAgree, frozenReport, SIMULATION_STATEMENT, simulationReport } from "./report";

describe("frozenReport", () => {
  it("returns nothing when there is no frozen crate", () => {
    expect(frozenReport([])).toBeNull();
  });

  it("summarizes signed errors with the sample standard deviation", () => {
    const report = frozenReport([
      { estimate: 104, truth: 100 },
      { estimate: 98, truth: 100 },
      { estimate: 108, truth: 100 },
      { estimate: 90, truth: 100 },
    ]);
    expect(report).not.toBeNull();
    expect(report?.n).toBe(4);
    expect(report?.bias).toBeCloseTo(0);
    expect(report?.meanAbsolute).toBeCloseTo(0.06);
    expect(report?.sampleStd).toBeCloseTo(Math.sqrt(0.0184 / 3));
    expect(report?.withinFraction).toBe(1);
    expect(report?.p90Absolute).toBeCloseTo(0.1);
  });

  it("leaves the standard deviation empty for a single crate", () => {
    const report = frozenReport([{ estimate: 11, truth: 10 }]);
    expect(report?.sampleStd).toBeNull();
    expect(report?.bias).toBeCloseTo(0.1);
    expect(report?.withinFraction).toBe(1);
  });
});

describe("simulationReport", () => {
  it("returns nothing when no scene has been rendered", () => {
    expect(simulationReport([])).toBeNull();
  });

  it("keeps the figures and forces the simulation label", () => {
    const report = simulationReport([
      { estimate: 104, truth: 100 },
      { estimate: 98, truth: 100 },
    ]);
    expect(report?.source).toBe("simulation");
    expect(report?.statement).toBe(SIMULATION_STATEMENT);
    expect(report?.statement).toMatch(/não é a margem de erro de fruta de cozinha/);
    expect(report?.meanAbsolute).toBeCloseTo(0.03);
  });
});

describe("countsAgree", () => {
  it("accepts two counts inside 2%", () => {
    expect(countsAgree(100, 101)).toBe(true);
  });

  it("asks for a third count when the pair diverges", () => {
    expect(countsAgree(100, 103)).toBe(false);
  });
});
