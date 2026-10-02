export type PixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type FrameQuality = {
  brightness: number;
  clippedFraction: number;
  warnings: string[];
};

export function analyzeFrame(buffer: PixelBuffer): FrameQuality {
  const { data, width, height } = buffer;
  let sum = 0;
  let clipped = 0;
  let count = 0;
  const step = 4;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      sum += luminance;
      if (luminance < 8 || luminance > 247) clipped += 1;
      count += 1;
    }
  }

  const brightness = count === 0 ? 0 : sum / count;
  const clippedFraction = count === 0 ? 0 : clipped / count;
  const warnings: string[] = [];
  if (brightness < 45) warnings.push("Escuro demais. Grave de novo com mais luz.");
  if (brightness > 210 || clippedFraction > 0.25) {
    warnings.push("Luz estourada. Afaste a janela ou a lâmpada.");
  }
  return { brightness, clippedFraction, warnings };
}

export type Point = { x: number; y: number };

export type SlotShot = {
  slot: "top" | "a" | "b" | "c";
  label: string;
  quality: FrameQuality | null;
};

export function blockedSlots(shots: SlotShot[]): SlotShot[] {
  return shots.filter((shot) => shot.quality !== null && shot.quality.warnings.length > 0);
}

export function isConvexQuad(points: Point[]): boolean {
  if (points.length !== 4) return false;
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % 4];
    const c = points[(index + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    const next = Math.sign(cross);
    if (sign === 0) sign = next;
    else if (next !== sign) return false;
  }
  return true;
}
