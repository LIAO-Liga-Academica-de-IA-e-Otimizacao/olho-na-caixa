import type { ProduceItem } from "./top-layer";

export type TestStillSet = {
  top: string;
  a: string;
  b: string;
  c: string | null;
  label: string;
};

/**
 * Canonical simulator stills for the temporary no-video shortcut.
 *
 * Skipping the film step is a development habit, not the kitchen flow, so
 * the frames step fills itself with these scenes instead of asking for
 * four files every time. Served from `public/test-stills/` by
 * `scripts/link-public.mjs`. Both files and this map go away with the
 * shortcut. Tangerine is seed 5, tomato is seed 1005, the scenes the book
 * walks through.
 */
const ROOT = "/test-stills";

export function testStillSet(item: ProduceItem): TestStillSet {
  if (item === "tomato") {
    return {
      top: `${ROOT}/images/val/tomato-s1005.png`,
      a: `${ROOT}/sides/tomato/val/tomato-s1005.png`,
      b: `${ROOT}/sides/tomato/val/tomato-s1005-b.png`,
      c: null,
      label: "tomato-s1005",
    };
  }
  return {
    top: `${ROOT}/images/val/tangerine-s5.png`,
    a: `${ROOT}/sides/val/tangerine-s5.png`,
    b: `${ROOT}/sides/val/tangerine-s5-b.png`,
    c: `${ROOT}/sides/val/tangerine-s5-c.png`,
    label: "tangerine-s5",
  };
}
