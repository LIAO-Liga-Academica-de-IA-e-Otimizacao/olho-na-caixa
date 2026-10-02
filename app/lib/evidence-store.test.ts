import { describe, expect, it } from "vitest";
import { appendRecord, emptyLog, EVIDENCE_LIMIT, isEvidence, parseLog } from "./evidence-store";
import { markRect } from "./evidence";

const RECORD = {
  id: "s5-tangerina",
  savedAtISO: "2026-10-02T19:00:00.000Z",
  item: "tangerine" as const,
  crateName: "Pequena",
  headline: "185 unidades · entre 170 e 200",
  imageDataUrl: "data:image/jpeg;base64,/9j/",
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
