import { describe, expect, it } from "vitest";
import {
  activeCrate,
  emptyBook,
  migrateLegacy,
  parseBook,
  removeCrate,
  setActive,
  upsertCrate,
  type CrateBook,
} from "./crate-store";

const SMALL = { name: "Pequena", lengthCm: 39.2, widthCm: 28.2, heightCm: 25.7 };
const LARGE = { name: "Grande", lengthCm: 50, widthCm: 30, heightCm: 22 };

function bookOf(names: string[], active: string | null): CrateBook {
  const all = { Pequena: SMALL, Grande: LARGE };
  return {
    crates: names.map((name) => all[name as keyof typeof all]),
    active,
  };
}

describe("crate book", () => {
  it("starts empty on missing or broken storage", () => {
    expect(parseBook(null)).toEqual(emptyBook());
    expect(parseBook("not json")).toEqual(emptyBook());
  });

  it("drops incomplete crates and points at the first survivor", () => {
    const book = parseBook(
      JSON.stringify({
        crates: [SMALL, { name: "", lengthCm: 0, widthCm: 1, heightCm: 1 }],
        active: "ghost",
      }),
    );
    expect(book.crates).toEqual([SMALL]);
    expect(book.active).toBe("Pequena");
  });

  it("folds the legacy single crate in once", () => {
    expect(migrateLegacy(SMALL, emptyBook())).toEqual({ crates: [SMALL], active: "Pequena" });
    const full = bookOf(["Pequena"], "Pequena");
    expect(migrateLegacy(LARGE, full)).toBe(full);
    expect(migrateLegacy(null, emptyBook())).toEqual(emptyBook());
  });

  it("upserts by name and activates the saved crate", () => {
    const added = upsertCrate(emptyBook(), SMALL);
    expect(activeCrate(added)).toEqual(SMALL);
    const taller = { ...SMALL, heightCm: 30 };
    const replaced = upsertCrate(added, taller);
    expect(replaced.crates).toEqual([taller]);
    const second = upsertCrate(replaced, LARGE);
    expect(second.crates).toEqual([taller, LARGE]);
    expect(activeCrate(second)).toEqual(LARGE);
  });

  it("removes by name and moves on from a deleted active crate", () => {
    const full = bookOf(["Pequena", "Grande"], "Grande");
    expect(removeCrate(full, "Grande")).toEqual({ crates: [SMALL], active: "Pequena" });
    expect(removeCrate(full, "Pequena")).toEqual({ crates: [LARGE], active: "Grande" });
    expect(removeCrate(bookOf(["Pequena"], "Pequena"), "Pequena")).toEqual(emptyBook());
  });

  it("only activates a saved name", () => {
    const full = bookOf(["Pequena", "Grande"], "Pequena");
    expect(setActive(full, "Grande").active).toBe("Grande");
    expect(setActive(full, "ghost")).toBe(full);
    expect(activeCrate(emptyBook())).toBeNull();
  });
});
