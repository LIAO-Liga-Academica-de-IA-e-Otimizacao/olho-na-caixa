import type { Point } from "./frame-quality";
import { quadMap } from "./homography";

/**
 * Pull `source` so the quad `from` lands on `to`.
 *
 * Both quads are in the same pixel space as the buffer. A sample that falls
 * outside the photo takes `border`, so the studio gray continues instead of
 * smearing the crate wall. The demo uses this to seat a render on the
 * protocol mouth. The height reader keeps the original still.
 */
export function warpRgba(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  from: Point[],
  to: Point[],
  border: readonly [number, number, number],
): Uint8ClampedArray<ArrayBuffer> {
  const map = quadMap(to, from);
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const [borderRed, borderGreen, borderBlue] = border;
  const xMax = width - 1;
  const yMax = height - 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = map({ x, y });
      const dest = (y * width + x) * 4;
      if (sample.x < 0 || sample.y < 0 || sample.x > xMax || sample.y > yMax) {
        out[dest] = borderRed;
        out[dest + 1] = borderGreen;
        out[dest + 2] = borderBlue;
        out[dest + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sample.x);
      const y0 = Math.floor(sample.y);
      const x1 = Math.min(x0 + 1, xMax);
      const y1 = Math.min(y0 + 1, yMax);
      const tx = sample.x - x0;
      const ty = sample.y - y0;
      const north = 1 - ty;
      const west = 1 - tx;
      const weight00 = west * north;
      const weight10 = tx * north;
      const weight01 = west * ty;
      const weight11 = tx * ty;
      const i00 = (y0 * width + x0) * 4;
      const i10 = (y0 * width + x1) * 4;
      const i01 = (y1 * width + x0) * 4;
      const i11 = (y1 * width + x1) * 4;
      out[dest] = channel(source, i00, 0, weight00, i10, weight10, i01, weight01, i11, weight11);
      out[dest + 1] = channel(source, i00, 1, weight00, i10, weight10, i01, weight01, i11, weight11);
      out[dest + 2] = channel(source, i00, 2, weight00, i10, weight10, i01, weight01, i11, weight11);
      out[dest + 3] = 255;
    }
  }
  return out;
}

function channel(
  source: Uint8ClampedArray,
  i00: number,
  offset: number,
  weight00: number,
  i10: number,
  weight10: number,
  i01: number,
  weight01: number,
  i11: number,
  weight11: number,
): number {
  return (
    source[i00 + offset] * weight00 +
    source[i10 + offset] * weight10 +
    source[i01 + offset] * weight01 +
    source[i11 + offset] * weight11 +
    0.5
  );
}
