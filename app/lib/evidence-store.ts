import type { ProduceItem } from "./top-layer";
import { isCrate } from "./crate-store";
import { isConvexQuad, type Point } from "./frame-quality";
import type { Crate } from "./packing";

/** Key of the saved-conference log: the annotated result photo plus its numbers. */
export const EVIDENCE_KEY = "olho-na-caixa.evidence";

/** Oldest records fall out past this many: phone storage is small. */
export const EVIDENCE_LIMIT = 30;

export type EvidenceRecord = {
  id: string;
  savedAtISO: string;
  item: ProduceItem;
  crateName: string;
  headline: string;
  imageDataUrl: string;
  replay?: EvidenceReplay;
};

export type ConferencePhotos = {
  top: string;
  a: string;
  b: string;
  c?: string;
};

export type EvidenceReplay = {
  photos: ConferencePhotos;
  crate: Crate;
  focal35Mm: number;
  densityKgPerLiter: number;
  corners: Point[];
};

export type EvidenceLog = {
  records: EvidenceRecord[];
};

export function emptyLog(): EvidenceLog {
  return { records: [] };
}

/** A record is usable when it names its photo and its numbers. */
export function isEvidence(value: unknown): value is EvidenceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EvidenceRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.savedAtISO === "string" &&
    (record.item === "tangerine" || record.item === "tomato") &&
    typeof record.crateName === "string" &&
    typeof record.headline === "string" &&
    typeof record.imageDataUrl === "string" &&
    record.imageDataUrl.startsWith("data:image/")
  );
}

/** Validate the saved inputs needed to reproduce a conference locally. */
export function isEvidenceReplay(value: unknown): value is EvidenceReplay {
  if (!value || typeof value !== "object") return false;
  const replay = value as Partial<EvidenceReplay>;
  const photos = replay.photos;
  const crate = replay.crate;
  return (
    !!photos &&
    typeof photos === "object" &&
    isImageDataUrl(photos.top) &&
    isImageDataUrl(photos.a) &&
    isImageDataUrl(photos.b) &&
    (photos.c === undefined || isImageDataUrl(photos.c)) &&
    isCrate(crate) &&
    Number.isFinite(crate.lengthCm) &&
    Number.isFinite(crate.widthCm) &&
    Number.isFinite(crate.heightCm) &&
    Number.isFinite(replay.focal35Mm) &&
    replay.focal35Mm! > 0 &&
    Number.isFinite(replay.densityKgPerLiter) &&
    replay.densityKgPerLiter! > 0 &&
    Array.isArray(replay.corners) &&
    replay.corners.length === 4 &&
    replay.corners.every(isFinitePoint) &&
    isConvexQuad(replay.corners)
  );
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value);
}

function isFinitePoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
  );
}

function sanitizeEvidence(value: unknown): EvidenceRecord | null {
  if (!isEvidence(value)) return null;
  if (
    isEvidenceReplay(value.replay) &&
    (value.item !== "tangerine" || value.replay.photos.c !== undefined)
  ) {
    return value;
  }
  if ("replay" in value) {
    const { replay: _invalidReplay, ...record } = value;
    return record;
  }
  return value;
}

/** Parse a stored log. One bad record falls out, never the whole review trail. */
export function parseLog(raw: string | null): EvidenceLog {
  if (!raw) return emptyLog();
  try {
    const parsed = JSON.parse(raw) as Partial<EvidenceLog>;
    const records = Array.isArray(parsed.records)
      ? parsed.records.map(sanitizeEvidence).filter((record): record is EvidenceRecord => record !== null)
      : [];
    return { records: records.slice(0, EVIDENCE_LIMIT) };
  } catch {
    return emptyLog();
  }
}

/** Newest first, capped: the review trail survives one bad save. */
export function appendRecord(log: EvidenceLog, record: EvidenceRecord): EvidenceLog {
  const sanitized = sanitizeEvidence(record);
  if (!sanitized) return log;
  const records = [sanitized, ...log.records.filter((entry) => entry.id !== sanitized.id)];
  return { records: records.slice(0, EVIDENCE_LIMIT) };
}

/** Read the log on this browser. There is no server copy. */
export function readLog(): EvidenceLog {
  if (typeof window === "undefined") return emptyLog();
  return parseLog(window.localStorage.getItem(EVIDENCE_KEY));
}

/** Remember the log on this browser. */
export function writeLog(log: EvidenceLog): void {
  window.localStorage.setItem(EVIDENCE_KEY, JSON.stringify(log));
}
