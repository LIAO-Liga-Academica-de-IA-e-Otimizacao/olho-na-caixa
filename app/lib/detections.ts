// Detector boxes become the same top-layer record the color marks use.
// The network sees one top frame and does not count buried fruit.
// Coordinates are fractions of the image, y growing downward, the YOLO layout.

import type { Point } from "./frame-quality";
import { openingScale } from "./homography";
import type { Mark, ProduceItem, TopLayer } from "./top-layer";

export type Detection = {
  classId: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
  score: number;
};

export const CLASS_ID: Record<ProduceItem, number> = {
  tangerine: 0,
  tomato: 1,
};

// Same operating point as sim/detect/score.py. A looser NMS leaves two boxes on one cap.
const SCORE_MIN = 0.55;
const NMS_IOU = 0.45;

export function layerFromDetections(
  detections: Detection[],
  corners: Point[],
  lengthCm: number,
  widthCm: number,
  item: ProduceItem,
): TopLayer {
  const started = performance.now();
  const wanted = CLASS_ID[item];
  const kept = detections.filter(
    (box) => box.score >= SCORE_MIN && insideQuad({ x: box.cx, y: box.cy }, corners),
  );
  const mine = kept.filter((box) => box.classId === wanted);
  const others = kept.length - mine.length;
  const toPlane = openingScale(corners, lengthCm, widthCm);
  const marks = mine.map((box) => toMark(box, toPlane));
  marks.sort((a, b) => a.x - b.x);
  const diameters = marks.map((mark) => mark.diameterCm).sort((a, b) => a - b);
  return {
    marks,
    count: marks.length,
    medianDiameterCm: median(diameters),
    matchesItem: mine.length > 0 && mine.length >= others,
    elapsedMs: performance.now() - started,
  };
}

/** YOLO nano raw head: channels-first `[cx, cy, w, h, class…]` over anchors. */
export function decodeYolo(
  data: ArrayLike<number>,
  anchors: number,
  classCount: number,
  frameWidth: number,
  frameHeight: number,
  scoreMin = SCORE_MIN,
): Detection[] {
  const found: Detection[] = [];
  for (let anchor = 0; anchor < anchors; anchor += 1) {
    let classId = 0;
    let score = data[(4 + 0) * anchors + anchor];
    for (let next = 1; next < classCount; next += 1) {
      const candidate = data[(4 + next) * anchors + anchor];
      if (candidate > score) {
        score = candidate;
        classId = next;
      }
    }
    if (score < scoreMin) continue;
    const cx = data[0 * anchors + anchor];
    const cy = data[1 * anchors + anchor];
    const width = data[2 * anchors + anchor];
    const height = data[3 * anchors + anchor];
    const pixels = cx > 2 || cy > 2;
    found.push({
      classId,
      cx: pixels ? cx / frameWidth : cx,
      cy: pixels ? cy / frameHeight : cy,
      width: pixels ? width / frameWidth : width,
      height: pixels ? height / frameHeight : height,
      score,
    });
  }
  return nms(found, NMS_IOU);
}

function toMark(box: Detection, toPlane: (point: Point) => Point): Mark {
  const across = distance(
    toPlane({ x: box.cx - box.width / 2, y: box.cy }),
    toPlane({ x: box.cx + box.width / 2, y: box.cy }),
  );
  const down = distance(
    toPlane({ x: box.cx, y: box.cy - box.height / 2 }),
    toPlane({ x: box.cx, y: box.cy + box.height / 2 }),
  );
  return {
    x: box.cx,
    y: box.cy,
    radius: Math.max(box.width, box.height) / 2,
    diameterCm: (across + down) / 2,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function insideQuad(point: Point, corners: Point[]): boolean {
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = corners[index];
    const b = corners[(index + 1) % 4];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    const next = Math.sign(cross);
    if (sign === 0) sign = next;
    else if (next !== sign) return false;
  }
  return true;
}

function nms(boxes: Detection[], iouLimit: number): Detection[] {
  const ordered = [...boxes].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const box of ordered) {
    if (kept.some((other) => other.classId === box.classId && iou(other, box) > iouLimit)) continue;
    kept.push(box);
  }
  return kept;
}

function iou(a: Detection, b: Detection): number {
  const ax0 = a.cx - a.width / 2;
  const ay0 = a.cy - a.height / 2;
  const ax1 = a.cx + a.width / 2;
  const ay1 = a.cy + a.height / 2;
  const bx0 = b.cx - b.width / 2;
  const by0 = b.cy - b.height / 2;
  const bx1 = b.cx + b.width / 2;
  const by1 = b.cy + b.height / 2;
  const overlapW = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const overlapH = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  const overlap = overlapW * overlapH;
  const union = a.width * a.height + b.width * b.height - overlap;
  return union <= 0 ? 0 : overlap / union;
}
