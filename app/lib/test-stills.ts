import type { ProduceItem } from "./top-layer";

export type TestStillSet = {
  top: string;
  a: string;
  b: string;
  c: string | null;
  label: string;
  /**
   * True mouth corners in 0..1 photo space, screen order (top-left,
   * top-right, bottom-right, bottom-left). Projected from the render
   * camera of that seed: deterministic top pose plus the seeded light
   * jitter, tracked against the rim bounds, and checked against the
   * pixels. One corner can sit just outside the frame. Test-only.
   */
  corners: Array<[number, number]>;
};

/**
 * Canonical simulator stills for the temporary no-photo shortcut.
 *
 * Opening the frames with empty slots is a development habit, not the
 * kitchen flow, so the frames step fills itself with these scenes instead
 * of asking for four files every time. Served from `public/test-stills/`
 * by `scripts/link-public.mjs`. Both files and this map go away with the
 * shortcut. Tangerine is seed 5, tomato is seed 1005, the scenes the book
 * walks through.
 */
const ROOT = "/test-stills";

export type ProbeKind = "dark" | "blown" | "ok";

const PROBE_LABEL: Record<ProbeKind, string> = {
  dark: "prova-escura",
  blown: "prova-estourada",
  ok: "prova-ok",
};

/**
 * Solid-color frames that trip (or pass) the light gate, for testing the
 * refusal without a camera. Served like the book scenes: drop
 * `gate-dark.png`, `gate-blown.png` and `gate-ok.png` (all git-ignored)
 * next to the val tops and `scripts/link-public.mjs` hard-links them into
 * `public/test-stills/`. Goes away with the shortcut.
 */
export function probeStillSet(kind: ProbeKind): TestStillSet {
  const url = `${ROOT}/images/val/gate-${kind}.png`;
  return {
    top: url,
    a: url,
    b: url,
    c: url,
    label: PROBE_LABEL[kind],
    corners: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
}

export function testStillSet(item: ProduceItem): TestStillSet {
  if (item === "tomato") {
    return {
      top: `${ROOT}/images/val/tomato-s1005.png`,
      a: `${ROOT}/sides/tomato/val/tomato-s1005.png`,
      b: `${ROOT}/sides/tomato/val/tomato-s1005-b.png`,
      c: null,
      label: "tomato-s1005",
      corners: [
        [0.2236, 0.0778],
        [0.7022, 0.0221],
        [0.8433, 0.9533],
        [0.2365, 1.0433],
      ],
    };
  }
  return {
    top: `${ROOT}/images/val/tangerine-s5.png`,
    a: `${ROOT}/sides/val/tangerine-s5.png`,
    b: `${ROOT}/sides/val/tangerine-s5-b.png`,
    c: `${ROOT}/sides/val/tangerine-s5-c.png`,
    label: "tangerine-s5",
    corners: [
      [0.216, 0.0807],
      [0.6967, 0.0141],
      [0.8478, 0.9463],
      [0.2462, 1.0513],
    ],
  };
}
