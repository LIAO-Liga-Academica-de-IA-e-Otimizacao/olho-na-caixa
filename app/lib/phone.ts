/** The phone that takes the arc stills.
 *
 * The rig poses are positions. The lens turns pixels into rays, and the lens
 * belongs to the phone, not to the rig. A 35 mm-equivalent focal length is
 * printed in every spec sheet, and it converts directly: fx = f / 36 * width.
 * The simulator rendered at 35 mm. A phone that reports 24 mm sees wider.
 */

export type PhoneProfile = {
  name: string;
  focal35Mm: number;
};

export const PHONE_STORAGE_KEY = "olho-na-caixa.phone";

export const SIMULATOR_PHONE: PhoneProfile = { name: "Simulador", focal35Mm: 35 };

export const PHONE_PRESETS: PhoneProfile[] = [
  SIMULATOR_PHONE,
  { name: "iPhone principal", focal35Mm: 24 },
  { name: "Pixel principal", focal35Mm: 25 },
  { name: "Android comum", focal35Mm: 26 },
];

/** Horizontal focal length, in pixels, for an image width. */
export function focalPx(focal35Mm: number, widthPx: number): number {
  return (focal35Mm / 36) * widthPx;
}

/** The phone saved in this browser, or null if none was stored or it is nonsense. */
export function readPhone(): PhoneProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PHONE_STORAGE_KEY) ?? "null") as PhoneProfile;
    if (!parsed || !parsed.name || !(parsed.focal35Mm > 0)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remember the phone on this browser. There is no server copy. */
export function writePhone(phone: PhoneProfile): void {
  window.localStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify(phone));
}
