/**
 * Letterbox used by the trained top-layer network.
 *
 * The weights expect a 320×320 square. The photo keeps its shape and the
 * empty margin is filled with 114. Box centers come back in that square, so
 * they have to be moved back onto the original photo before NMS.
 */

export const MODEL_SIZE = 320;
export const ANCHORS = 2100;
export const CLASS_COUNT = 2;

export type Letterbox = {
  scale: number;
  top: number;
  left: number;
  resizedWidth: number;
  resizedHeight: number;
};

export function letterboxLayout(sourceWidth: number, sourceHeight: number, size = MODEL_SIZE): Letterbox {
  const scale = Math.min(size / sourceHeight, size / sourceWidth);
  const resizedWidth = Math.round(sourceWidth * scale);
  const resizedHeight = Math.round(sourceHeight * scale);
  return {
    scale,
    resizedWidth,
    resizedHeight,
    top: Math.round((size - resizedHeight) / 2 - 0.1) + 0,
    left: Math.round((size - resizedWidth) / 2 - 0.1) + 0,
  };
}

/** Move the raw head from the 320 square into fractions of the original photo. */
export function undoLetterbox(
  data: Float32Array,
  anchors: number,
  box: Letterbox,
  sourceWidth: number,
  sourceHeight: number,
): Float32Array {
  const out = new Float32Array(data);
  for (let anchor = 0; anchor < anchors; anchor += 1) {
    out[anchor] = (data[anchor] - box.left) / box.scale / sourceWidth;
    out[anchors + anchor] = (data[anchors + anchor] - box.top) / box.scale / sourceHeight;
    out[2 * anchors + anchor] = data[2 * anchors + anchor] / box.scale / sourceWidth;
    out[3 * anchors + anchor] = data[3 * anchors + anchor] / box.scale / sourceHeight;
  }
  return out;
}
