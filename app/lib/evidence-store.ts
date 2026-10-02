import type { ProduceItem } from "./top-layer";

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

/** Parse a stored log. One bad record falls out, never the whole review trail. */
export function parseLog(raw: string | null): EvidenceLog {
  if (!raw) return emptyLog();
  try {
    const parsed = JSON.parse(raw) as Partial<EvidenceLog>;
    const records = Array.isArray(parsed.records) ? parsed.records.filter(isEvidence) : [];
    return { records: records.slice(0, EVIDENCE_LIMIT) };
  } catch {
    return emptyLog();
  }
}

/** Newest first, capped: the review trail survives one bad save. */
export function appendRecord(log: EvidenceLog, record: EvidenceRecord): EvidenceLog {
  if (!isEvidence(record)) return log;
  const records = [record, ...log.records.filter((entry) => entry.id !== record.id)];
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
