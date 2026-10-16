import { describe, expect, it } from "vitest";
import { emptyLog, EVIDENCE_LIMIT, type EvidenceRecord, type EvidenceReplay } from "./evidence-store";
import { exportConferences, importConferences, MAX_TRANSFER_BYTES } from "./evidence-transfer";

const PHOTO = "data:image/jpeg;base64,/9j/";
const RECORD: EvidenceRecord = {
  id: "conference-1",
  savedAtISO: "2026-10-02T19:00:00.000Z",
  item: "tangerine",
  crateName: "Pequena",
  headline: "185 unidades · entre 170 e 200",
  imageDataUrl: PHOTO,
};

const REPLAY: EvidenceReplay = {
  photos: { top: PHOTO, a: PHOTO, b: PHOTO, c: PHOTO },
  crate: { name: "Pequena", lengthCm: 30, widthCm: 20, heightCm: 15 },
  focal35Mm: 26,
  densityKgPerLiter: 0.55,
  corners: [
    { x: 0.216, y: 0.0807 },
    { x: 0.6967, y: 0.0141 },
    { x: 0.8478, y: 0.9463 },
    { x: 0.2462, y: 1.0513 },
  ],
};

function envelope(records: unknown[], fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: "olho-na-caixa.conferences",
    version: 1,
    exportedAtISO: "2026-10-03T12:00:00.000Z",
    records,
    ...fields,
  });
}

describe("conference transfer", () => {
  it("round-trips records with complete replay data and strips unknown fields", () => {
    const enriched = { ...RECORD, replay: REPLAY, extra: "discard me" };
    const raw = exportConferences([enriched as EvidenceRecord]);
    const imported = importConferences(raw, emptyLog());
    expect(imported).toEqual({ log: { records: [{ ...RECORD, replay: REPLAY }] }, added: 1, duplicates: 0 });
  });

  it("imports tomato replay data without frame C", () => {
    const tomato: EvidenceRecord = {
      ...RECORD,
      id: "tomato-1",
      item: "tomato",
      replay: { ...REPLAY, photos: { top: PHOTO, a: PHOTO, b: PHOTO }, corners: REPLAY.corners },
    };
    expect(importConferences(exportConferences([tomato]), emptyLog()).log.records).toEqual([tomato]);
  });

  it("rejects malformed input, unknown format or version, and empty or oversized batches", () => {
    expect(() => importConferences("not json", emptyLog())).toThrow("JSON válido");
    expect(() => importConferences(envelope([RECORD], { format: "other" }), emptyLog())).toThrow("não é uma exportação");
    expect(() => importConferences(envelope([RECORD], { version: 2 }), emptyLog())).toThrow("não é compatível");
    expect(() => importConferences(envelope([]), emptyLog())).toThrow("não contém conferências");
    expect(() => importConferences(envelope(Array.from({ length: EVIDENCE_LIMIT + 1 }, (_, i) => ({ ...RECORD, id: `r${i}` }))), emptyLog())).toThrow("no máximo");
  });

  it("rejects incomplete records, invalid dates, and remote or non-raster photos", () => {
    for (const invalid of [
      { ...RECORD, id: " " },
      { ...RECORD, crateName: "" },
      { ...RECORD, headline: "\n" },
      { ...RECORD, savedAtISO: "yesterday" },
      { ...RECORD, item: "banana" },
      { ...RECORD, imageDataUrl: "https://example.test/photo.jpg" },
      { ...RECORD, imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
      { ...RECORD, imageDataUrl: "data:image/gif;base64,R0lG" },
    ]) {
      expect(() => importConferences(envelope([invalid]), emptyLog())).toThrow();
    }
    expect(() => exportConferences([{ ...RECORD, imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }])).toThrow();
  });

  it("rejects invalid replay photos and missing tangerine frame C", () => {
    for (const replay of [
      { ...REPLAY, photos: { ...REPLAY.photos, a: "https://example.test/a.jpg" } },
      { ...REPLAY, photos: { ...REPLAY.photos, top: "data:image/svg+xml;base64,PHN2Zz4=" } },
      { ...REPLAY, photos: { top: PHOTO, a: PHOTO, b: PHOTO } },
    ]) {
      expect(() => importConferences(envelope([{ ...RECORD, replay }]), emptyLog())).toThrow("reprodução inválidos");
    }
  });

  it("skips identical IDs and rejects changed data atomically", () => {
    const second = { ...RECORD, id: "conference-2", savedAtISO: "2026-10-03T12:00:00.000Z" };
    const current = { records: [RECORD] };
    const merged = importConferences(envelope([RECORD, second, second]), current);
    expect(merged.added).toBe(1);
    expect(merged.duplicates).toBe(2);
    expect(merged.log.records.map(({ id }) => id)).toEqual(["conference-2", "conference-1"]);

    const conflict = { ...RECORD, headline: "Dados alterados" };
    expect(() => importConferences(envelope([second, conflict]), current)).toThrow("dados diferentes");
    expect(current.records).toEqual([RECORD]);
  });

  it("rejects an import that exceeds capacity without dropping current history", () => {
    const existing = Array.from({ length: EVIDENCE_LIMIT }, (_, index) => ({ ...RECORD, id: `old-${index}` }));
    const current = { records: existing };
    const before = structuredClone(current);
    expect(() => importConferences(exportConferences([{ ...RECORD, id: "new" }]), current)).toThrow("passaria do limite");
    expect(current).toEqual(before);
  });

  it("enforces the UTF-8 transfer size limit", () => {
    const tooLarge = "x".repeat(MAX_TRANSFER_BYTES + 1);
    expect(() => importConferences(tooLarge, emptyLog())).toThrow("25 MB");
  });

  it("orders equal timestamps by ID for deterministic output", () => {
    const z = { ...RECORD, id: "z" };
    const a = { ...RECORD, id: "a" };
    expect(importConferences(exportConferences([z, a]), emptyLog()).log.records.map(({ id }) => id)).toEqual(["a", "z"]);
  });
});
