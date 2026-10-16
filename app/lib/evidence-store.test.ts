import { describe, expect, it } from "vitest";
import {
  appendRecord,
  emptyLog,
  EVIDENCE_LIMIT,
  isEvidence,
  isEvidenceReplay,
  parseLog,
  type EvidenceReplay,
} from "./evidence-store";
import { markRect } from "./evidence";
import { testStillSet } from "./test-stills";

const RECORD = {
  id: "s5-tangerina",
  savedAtISO: "2026-10-02T19:00:00.000Z",
  item: "tangerine" as const,
  crateName: "Pequena",
  headline: "185 unidades · entre 170 e 200",
  imageDataUrl: "data:image/jpeg;base64,/9j/",
};

const REPLAY: EvidenceReplay = {
  photos: {
    top: "data:image/jpeg;base64,top",
    a: "data:image/jpeg;base64,a",
    b: "data:image/jpeg;base64,b",
    c: "data:image/jpeg;base64,c",
  },
  crate: { name: "Pequena", lengthCm: 30, widthCm: 20, heightCm: 15 },
  focal35Mm: 26,
  densityKgPerLiter: 0.55,
  corners: [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ],
};

describe("evidence log", () => {
  it("starts empty on missing or broken storage", () => {
    expect(parseLog(null)).toEqual(emptyLog());
    expect(parseLog("not json")).toEqual(emptyLog());
  });

  it("drops records without a photo", () => {
    const log = parseLog(JSON.stringify({ records: [RECORD, { ...RECORD, id: "bad", imageDataUrl: "http://x/y.png" }] }));
    expect(log.records.map((entry) => entry.id)).toEqual(["s5-tangerina"]);
  });

  it("keeps old records without replay data and round-trips a valid replay bundle", () => {
    const log = parseLog(JSON.stringify({ records: [RECORD, { ...RECORD, id: "with-replay", replay: REPLAY }] }));
    expect(log.records).toEqual([RECORD, { ...RECORD, id: "with-replay", replay: REPLAY }]);
    expect(isEvidenceReplay(REPLAY)).toBe(true);
  });

  it("preserves test still corners that extend beyond the image and requires tangerine frame C", () => {
    for (const item of ["tangerine", "tomato"] as const) {
      const stills = testStillSet(item);
      const replay: EvidenceReplay = {
        ...REPLAY,
        photos: {
          top: REPLAY.photos.top,
          a: REPLAY.photos.a,
          b: REPLAY.photos.b,
          ...(stills.c ? { c: REPLAY.photos.c } : {}),
        },
        corners: stills.corners.map(([x, y]) => ({ x, y })),
      };
      const record = { ...RECORD, id: item, item, replay };
      expect(replay.corners.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)).toBe(true);
      expect(parseLog(JSON.stringify({ records: [record] })).records).toEqual([record]);
    }

    const withoutC = { ...REPLAY, photos: { ...REPLAY.photos, c: undefined } };
    expect(parseLog(JSON.stringify({ records: [{ ...RECORD, replay: withoutC }] })).records).toEqual([RECORD]);
  });

  it("strips corrupt replay data while preserving the saved evidence", () => {
    const malformed = { ...REPLAY, photos: { ...REPLAY.photos, a: "https://example.test/a.jpg" } };
    const log = parseLog(JSON.stringify({ records: [{ ...RECORD, replay: malformed }] }));
    expect(log.records).toEqual([RECORD]);

    const appended = appendRecord(emptyLog(), { ...RECORD, replay: malformed } as never);
    expect(appended.records).toEqual([RECORD]);
  });

  it("rejects invalid replay fields and corner geometry", () => {
    expect(isEvidenceReplay({ ...REPLAY, focal35Mm: Infinity })).toBe(false);
    expect(isEvidenceReplay({ ...REPLAY, densityKgPerLiter: 0 })).toBe(false);
    expect(isEvidenceReplay({ ...REPLAY, crate: { ...REPLAY.crate, widthCm: Infinity } })).toBe(false);
    expect(isEvidenceReplay({ ...REPLAY, photos: { ...REPLAY.photos, top: "data:text/plain,x" } })).toBe(false);
    expect(isEvidenceReplay({ ...REPLAY, corners: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).toBe(false);
    expect(isEvidenceReplay({ ...REPLAY, corners: [{ x: Number.NaN, y: 0 }, ...REPLAY.corners.slice(1)] })).toBe(false);
  });

  it("keeps newest first and caps the trail", () => {
    let log = emptyLog();
    for (let index = 0; index < EVIDENCE_LIMIT + 5; index += 1) {
      log = appendRecord(log, { ...RECORD, id: `r${index}` });
    }
    expect(log.records).toHaveLength(EVIDENCE_LIMIT);
    expect(log.records[0].id).toBe(`r${EVIDENCE_LIMIT + 4}`);
  });

  it("refuses a record that is not evidence", () => {
    expect(isEvidence({ ...RECORD, item: "banana" })).toBe(false);
    expect(appendRecord(emptyLog(), { ...RECORD, item: "banana" } as never)).toEqual(emptyLog());
  });
});

describe("markRect", () => {
  it("centers the box on the mark", () => {
    expect(markRect({ x: 0.5, y: 0.5, radius: 0.05, width: 0.2, height: 0.1, diameterCm: 5 }, 640, 480)).toEqual({
      x: 256,
      y: 216,
      width: 128,
      height: 48,
    });
  });
});
