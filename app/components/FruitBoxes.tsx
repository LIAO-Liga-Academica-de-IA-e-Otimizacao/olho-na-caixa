import type { Mark } from "@/lib/top-layer";

export function FruitBoxes({ marks }: { marks: Mark[] }) {
  return marks.map((mark) => (
    <span
      key={`${mark.x}-${mark.y}-${mark.width}`}
      className="fruit-box"
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.width * 100}%`,
        height: `${mark.height * 100}%`,
      }}
    />
  ));
}
