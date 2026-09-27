import { describe, expect, it } from "vitest";
import { parseLots } from "./lots";

const valid = {
  id: "caixa-1",
  item: "tangerine",
  role: "frozen",
  crateName: "Caixa da cozinha",
  lengthCm: 50,
  widthCm: 30,
  heightCm: 22,
  variety: "",
  rulerHeightCm: 21,
  videoLabel: "arco-1",
  countA: 110,
  countB: 111,
  countC: null,
  weightKg: null,
};

describe("parseLots", () => {
  it("reads an empty store as no crates", () => {
    expect(parseLots(null)).toEqual([]);
    expect(parseLots("not json")).toEqual([]);
  });

  it("keeps a complete record and drops a broken one", () => {
    const raw = JSON.stringify([valid, { id: "broken" }]);
    expect(parseLots(raw)).toEqual([valid]);
  });
});
