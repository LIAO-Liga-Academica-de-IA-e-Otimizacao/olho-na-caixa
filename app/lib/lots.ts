export type LotItem = "tangerine" | "tomato";
export type LotRole = "calibration" | "frozen";

export type LotRecord = {
  id: string;
  item: LotItem;
  role: LotRole;
  crateName: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  variety: string;
  rulerHeightCm: number;
  videoLabel: string;
  countA: number | null;
  countB: number | null;
  countC: number | null;
  weightKg: number | null;
};

export const LOTS_STORAGE_KEY = "olho-na-caixa.lots";

export function parseLots(raw: string | null): LotRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLot);
  } catch {
    return [];
  }
}

export function readLots(): LotRecord[] {
  if (typeof window === "undefined") return [];
  return parseLots(window.localStorage.getItem(LOTS_STORAGE_KEY));
}

function isLot(value: unknown): value is LotRecord {
  if (!value || typeof value !== "object") return false;
  const lot = value as LotRecord;
  return (
    typeof lot.id === "string" &&
    (lot.item === "tangerine" || lot.item === "tomato") &&
    (lot.role === "calibration" || lot.role === "frozen") &&
    typeof lot.crateName === "string" &&
    lot.lengthCm > 0 &&
    lot.widthCm > 0 &&
    lot.heightCm > 0 &&
    typeof lot.variety === "string" &&
    lot.rulerHeightCm > 0 &&
    typeof lot.videoLabel === "string"
  );
}
