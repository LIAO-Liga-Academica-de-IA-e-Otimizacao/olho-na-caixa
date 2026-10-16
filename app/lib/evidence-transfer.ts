import {
  EVIDENCE_LIMIT,
  isEvidenceReplay,
  type EvidenceLog,
  type EvidenceRecord,
  type EvidenceReplay,
} from "./evidence-store";

export const MAX_TRANSFER_BYTES = 25 * 1024 * 1024;

const FORMAT = "olho-na-caixa.conferences";

type TransferEnvelope = {
  format: typeof FORMAT;
  version: 1;
  exportedAtISO: string;
  records: EvidenceRecord[];
};

/** Serialize validated conference records in the portable, versioned format. */
export function exportConferences(records: EvidenceRecord[]): string {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Selecione ao menos uma conferência para exportar.");
  }
  if (records.length > EVIDENCE_LIMIT) {
    throw new Error(`O arquivo pode conter no máximo ${EVIDENCE_LIMIT} conferências.`);
  }
  const projected = records.map((record) => projectRecord(record));
  const envelope: TransferEnvelope = {
    format: FORMAT,
    version: 1,
    exportedAtISO: new Date().toISOString(),
    records: projected,
  };
  const raw = JSON.stringify(envelope);
  ensureTransferSize(raw);
  return raw;
}

/** Validate a complete transfer before returning a merged, newest-first log. */
export function importConferences(
  raw: string,
  current: EvidenceLog,
): { log: EvidenceLog; added: number; duplicates: number } {
  ensureTransferSize(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("O arquivo de conferências não contém JSON válido.");
  }

  if (!isObject(parsed) || parsed.format !== FORMAT) {
    throw new Error("Este arquivo não é uma exportação de conferências do Olho na Caixa.");
  }
  if (parsed.version !== 1) {
    throw new Error("Esta versão do arquivo de conferências não é compatível.");
  }
  if (!isValidISODate(parsed.exportedAtISO)) {
    throw new Error("A data de exportação do arquivo é inválida.");
  }
  if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
    throw new Error("O arquivo não contém conferências para importar.");
  }
  if (parsed.records.length > EVIDENCE_LIMIT) {
    throw new Error(`O arquivo pode conter no máximo ${EVIDENCE_LIMIT} conferências.`);
  }

  // Validate and project the whole batch before examining or constructing a merge.
  const incoming = parsed.records.map((record) => projectRecord(record));
  const currentById = new Map<string, EvidenceRecord>();
  for (const record of current.records) {
    if (!currentById.has(record.id)) currentById.set(record.id, record);
  }

  const uniqueIncoming = new Map<string, EvidenceRecord>();
  let duplicates = 0;
  for (const record of incoming) {
    const previousInBatch = uniqueIncoming.get(record.id);
    if (previousInBatch) {
      if (!sameKnownData(previousInBatch, record)) conflict(record.id);
      duplicates += 1;
      continue;
    }
    const existing = currentById.get(record.id);
    if (existing) {
      let projectedExisting: EvidenceRecord;
      try {
        projectedExisting = projectRecord(existing);
      } catch {
        conflict(record.id);
      }
      if (!sameKnownData(projectedExisting, record)) conflict(record.id);
      duplicates += 1;
      uniqueIncoming.set(record.id, record);
      continue;
    }
    uniqueIncoming.set(record.id, record);
  }

  const addedRecords = [...uniqueIncoming.values()].filter((record) => !currentById.has(record.id));
  if (current.records.length + addedRecords.length > EVIDENCE_LIMIT) {
    throw new Error(
      `A importação passaria do limite de ${EVIDENCE_LIMIT} conferências. Importe um arquivo com menos conferências novas.`,
    );
  }

  const merged = [...current.records, ...addedRecords].sort(compareNewestFirst);
  return { log: { records: merged }, added: addedRecords.length, duplicates };
}

function projectRecord(value: unknown): EvidenceRecord {
  if (!isObject(value)) invalidRecord();
  const item = value.item;
  const id = value.id;
  const savedAtISO = value.savedAtISO;
  const crateName = value.crateName;
  const headline = value.headline;
  const imageDataUrl = value.imageDataUrl;

  if (typeof id !== "string" || id.trim().length === 0) invalidRecord();
  if (!isValidISODate(savedAtISO)) invalidRecord();
  if (item !== "tangerine" && item !== "tomato") invalidRecord();
  if (typeof crateName !== "string" || crateName.trim().length === 0) invalidRecord();
  if (typeof headline !== "string" || headline.trim().length === 0) invalidRecord();
  if (!isRasterBase64DataUrl(imageDataUrl)) invalidRecord();

  let replay: EvidenceReplay | undefined;
  if (value.replay !== undefined) {
    if (
      !isEvidenceReplay(value.replay) ||
      !isRasterBase64DataUrl(value.replay.photos.top) ||
      !isRasterBase64DataUrl(value.replay.photos.a) ||
      !isRasterBase64DataUrl(value.replay.photos.b) ||
      (value.replay.photos.c !== undefined && !isRasterBase64DataUrl(value.replay.photos.c)) ||
      (item === "tangerine" && value.replay.photos.c === undefined)
    ) {
      invalidReplay();
    }
    replay = projectReplay(value.replay);
  }

  return {
    id,
    savedAtISO,
    item,
    crateName,
    headline,
    imageDataUrl,
    ...(replay ? { replay } : {}),
  };
}

function projectReplay(replay: EvidenceReplay): EvidenceReplay {
  return {
    photos: {
      top: replay.photos.top,
      a: replay.photos.a,
      b: replay.photos.b,
      ...(replay.photos.c !== undefined ? { c: replay.photos.c } : {}),
    },
    crate: {
      name: replay.crate.name,
      lengthCm: replay.crate.lengthCm,
      widthCm: replay.crate.widthCm,
      heightCm: replay.crate.heightCm,
    },
    focal35Mm: replay.focal35Mm,
    densityKgPerLiter: replay.densityKgPerLiter,
    corners: replay.corners.map(({ x, y }) => ({ x, y })),
  };
}

function isRasterBase64DataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(value);
  if (!match) return false;
  const payload = match[2];
  if (!payload || payload.length % 4 === 1) return false;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return padding === 0 ? payload.length % 4 !== 1 : payload.length % 4 === 0;
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ensureTransferSize(raw: string): void {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).byteLength > MAX_TRANSFER_BYTES) {
    throw new Error("O arquivo de conferências ultrapassa o limite de 25 MB.");
  }
}

function sameKnownData(left: EvidenceRecord, right: EvidenceRecord): boolean {
  return JSON.stringify(projectRecord(left)) === JSON.stringify(projectRecord(right));
}

function compareNewestFirst(left: EvidenceRecord, right: EvidenceRecord): number {
  const byDate = Date.parse(right.savedAtISO) - Date.parse(left.savedAtISO);
  return byDate || left.id.localeCompare(right.id);
}

function invalidRecord(): never {
  throw new Error("O arquivo contém uma conferência inválida ou incompleta.");
}

function invalidReplay(): never {
  throw new Error("O arquivo contém fotos ou dados de reprodução inválidos.");
}

function conflict(id: string): never {
  throw new Error(`A conferência “${id}” já existe com dados diferentes. Nenhum registro foi importado.`);
}
