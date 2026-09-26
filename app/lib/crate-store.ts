import type { Crate } from "./packing";

export const CRATE_STORAGE_KEY = "olho-na-caixa.crate";

export function readCrate(): Crate | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CRATE_STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Crate;
  if (
    !parsed.name ||
    parsed.lengthCm <= 0 ||
    parsed.widthCm <= 0 ||
    parsed.heightCm <= 0
  ) {
    return null;
  }
  return parsed;
}

export function writeCrate(crate: Crate): void {
  window.localStorage.setItem(CRATE_STORAGE_KEY, JSON.stringify(crate));
}
