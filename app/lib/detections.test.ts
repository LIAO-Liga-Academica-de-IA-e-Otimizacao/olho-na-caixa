import { describe, expect, it } from "vitest";
import { decodeYolo, layerFromDetections } from "./detections";

const FULL_OPENING = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe("decodeYolo", () => {
  it("drops a weak anchor and merges a duplicate box", () => {
    const anchors = 3;
    const data = new Float32Array(6 * anchors);
    // Anchor 0: a tangerine. Layout is channels-first.
    data[0 * anchors + 0] = 160;
    data[1 * anchors + 0] = 120;
    data[2 * anchors + 0] = 40;
    data[3 * anchors + 0] = 40;
    data[4 * anchors + 0] = 0.9;
    data[5 * anchors + 0] = 0.05;
    // Anchor 1: almost the same box, lower score.
    data[0 * anchors + 1] = 162;
    data[1 * anchors + 1] = 122;
    data[2 * anchors + 1] = 40;
    data[3 * anchors + 1] = 40;
    data[4 * anchors + 1] = 0.8;
    data[5 * anchors + 1] = 0.01;
    // Anchor 2: below the score floor.
    data[4 * anchors + 2] = 0.1;
    data[5 * anchors + 2] = 0.1;
    const boxes = decodeYolo(data, anchors, 2, 320, 240);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].classId).toBe(0);
    expect(boxes[0].cx).toBeCloseTo(0.5);
    expect(boxes[0].cy).toBeCloseTo(0.5);
  });
});

describe("layerFromDetections", () => {
  it("counts every box inside, whatever the label, and reads the diameter", () => {
    const layer = layerFromDetections(
      [
        { classId: 0, cx: 0.5, cy: 0.5, width: 0.1, height: 0.1, score: 0.8 },
        { classId: 1, cx: 0.2, cy: 0.2, width: 0.1, height: 0.1, score: 0.8 },
      ],
      FULL_OPENING,
      40,
      30,
      "tangerine",
    );
    expect(layer.count).toBe(2);
    expect(layer.otherCount).toBe(1);
    expect(layer.matchesItem).toBe(true);
    expect(layer.medianDiameterCm).toBeCloseTo(3.5);
  });

  it("flags a frame whose boxes mostly wear the other label", () => {
    const layer = layerFromDetections(
      [
        { classId: 1, cx: 0.5, cy: 0.5, width: 0.1, height: 0.1, score: 0.9 },
        { classId: 1, cx: 0.2, cy: 0.2, width: 0.1, height: 0.1, score: 0.9 },
        { classId: 0, cx: 0.8, cy: 0.8, width: 0.1, height: 0.1, score: 0.9 },
      ],
      FULL_OPENING,
      40,
      30,
      "tangerine",
    );
    expect(layer.count).toBe(3);
    expect(layer.otherCount).toBe(2);
    expect(layer.matchesItem).toBe(false);
  });

  it("refuses a frame with no boxes at all", () => {
    const layer = layerFromDetections([], FULL_OPENING, 40, 30, "tangerine");
    expect(layer.count).toBe(0);
    expect(layer.matchesItem).toBe(false);
  });
});
