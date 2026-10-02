import type { Mark } from "./top-layer";

/** Width of the saved evidence photo. Phones hold dozens at this size. */
export const EVIDENCE_WIDTH = 640;

/** The on-screen box color, so the saved photo matches the result screen. */
export const BOX_COLOR = "#e2692b";

export type BoxRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Mark fractions (center-based, like the overlay) to canvas pixels. */
export function markRect(mark: Mark, width: number, height: number): BoxRect {
  return {
    x: (mark.x - mark.width / 2) * width,
    y: (mark.y - mark.height / 2) * height,
    width: mark.width * width,
    height: mark.height * height,
  };
}

/** The result photo with its boxes burned in, as a JPEG data URL. Null when unreadable. */
export function composeEvidence(topUrl: string, marks: Mark[]): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = EVIDENCE_WIDTH / image.naturalWidth;
        const canvas = document.createElement("canvas");
        canvas.width = EVIDENCE_WIDTH;
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.strokeStyle = BOX_COLOR;
        context.lineWidth = 3;
        for (const mark of marks) {
          const rect = markRect(mark, canvas.width, canvas.height);
          context.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = topUrl;
  });
}
