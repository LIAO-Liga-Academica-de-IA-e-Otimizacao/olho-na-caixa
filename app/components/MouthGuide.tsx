import type { Quad } from "@/lib/arc-height";

/**
 * The mouth where it should sit in the still, as a dashed quad.
 *
 * Coordinates arrive in 640×480 still space and map to percentages, so the
 * mold stays on the mouth on any display size. It is exact on 640×480 stills.
 * On phone photos the still is center-cropped to 4:3 first, so the mold is
 * exact there too when the lens center sits in the middle of the sensor.
 */
export function MouthGuide({ quad, label }: { quad: Quad | null; label: string }) {
  if (!quad) return null;
  const points = quad.map(([x, y]) => `${(x / 640) * 100},${(y / 480) * 100}`).join(" ");
  return (
    <svg
      className="guide-quad"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polygon points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
