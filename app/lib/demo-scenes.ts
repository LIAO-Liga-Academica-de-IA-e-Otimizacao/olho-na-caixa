import camerasJson from "./arc-cameras.json";
import { mouthQuad, type Quad } from "./arc-height";
import type { Crate } from "./packing";
import type { ProduceItem } from "./top-layer";

/**
 * Rendered scenes seated on the protocol mouth.
 *
 * Side corners are the inner lip measured on that still (near-left,
 * near-right, far-right, far-left), the same order `mouthQuad` projects.
 * Top corners are the rim projected from that seed's render camera, in
 * screen order, and the protocol asks that rim to fill the frame.
 * Tangerine is seed 5. Tomato is seed 1005. The files are not in git.
 */

const PROTOCOL_WIDTH = 640;
const PROTOCOL_HEIGHT = 480;

/** The mesh the rig was fit on: 39.2 cm across, 28.2 cm deep, 25.7 cm of wall. */
export const STUDIO_CRATE: Crate = {
  name: "Plástica 01",
  lengthCm: 39.2,
  widthCm: 28.2,
  heightCm: 25.7,
};

const FRAME: Quad = [
  [0, 0],
  [PROTOCOL_WIDTH - 1, 0],
  [PROTOCOL_WIDTH - 1, PROTOCOL_HEIGHT - 1],
  [0, PROTOCOL_HEIGHT - 1],
];

export type DemoSlotId = "top" | "a" | "b" | "c";

export type DemoFrame = {
  id: DemoSlotId;
  title: string;
  /** What this station is for, under the photo. */
  blurb: string;
  url: string;
  /** Mouth corners in the render, pixels. */
  source: Quad;
  /** Where that mouth sits on the protocol frame, pixels. */
  target: Quad;
};

type Bounds = {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  cameras: Array<{ origin: number[] }>;
  tomatoCameras: Array<{ origin: number[] }>;
};

const BOUNDS = camerasJson as Bounds;

const DEPTH_MIN = -0.52;
const DEPTH_MAX = 0.28;
const ACROSS_MIN = -0.32;
const ACROSS_MAX = 0.32;

export type PlanPoint = { x: number; y: number };

export type DemoPlan = {
  crate: PlanPoint[];
  /** The lip the arc stands over. */
  near: [PlanPoint, PlanPoint];
  marks: Array<{ id: DemoSlotId; label: string; point: PlanPoint }>;
};

/**
 * Ground truth of the demo scene, from the simulator meta next to the still.
 * The Demo page shows this beside the reading. Conferir does not.
 */
export type DemoTruth = {
  seed: number;
  /** Fruit that stayed inside the opening. */
  inside: number;
  /** Fruit the top detector should see. */
  visible: number;
  /** Mean lid height of the settled mesh, centimeters. */
  heightCm: number;
  diameterCm: number;
};

export function demoTruth(item: ProduceItem): DemoTruth {
  return item === "tangerine" ? TANGERINE_TRUTH : TOMATO_TRUTH;
}

export function demoFrames(item: ProduceItem): DemoFrame[] {
  const side = item === "tangerine" ? TANGERINE_SIDE : TOMATO_SIDE;
  const top = item === "tangerine" ? TANGERINE_TOP : TOMATO_TOP;
  const frames: DemoFrame[] = [
    {
      id: "top",
      title: "Vista de cima",
      blurb: "A boca preenche o quadro. Esse retângulo é o molde da vista de cima.",
      url: `/demo-stills/${item}-top.png`,
      source: top,
      target: FRAME,
    },
  ];
  const slots: Array<{ id: DemoSlotId; title: string; blurb: string; index: 0 | 1 | 2 }> = [
    {
      id: "a",
      title: "Quadro A",
      blurb: "A câmera fica no meio do arco, acima da borda próxima. O trapézio é a boca nessa posição.",
      index: 0,
    },
    {
      id: "b",
      title: "Quadro B",
      blurb: "A mesma borda, deslocada para um lado. O trapézio muda com o ângulo.",
      index: 1,
    },
  ];
  if (item === "tangerine") {
    slots.push({
      id: "c",
      title: "Quadro C",
      blurb: "O outro lado do arco, um pouco mais alto. O tomate não usa este quadro.",
      index: 2,
    });
  }
  for (const slot of slots) {
    const target = mouthQuad(item, slot.index, 35, {
      lengthCm: STUDIO_CRATE.lengthCm,
      widthCm: STUDIO_CRATE.widthCm,
      heightCm: STUDIO_CRATE.heightCm,
    });
    if (!target) throw new Error(`o molde do ${slot.title} não fechou`);
    frames.push({
      id: slot.id,
      title: slot.title,
      blurb: slot.blurb,
      url: `/demo-stills/${item}-${slot.id}.png`,
      source: side[slot.index],
      target,
    });
  }
  return frames;
}

/** Top-down sketch of the opening and the stations that look at it. */
export function demoPlan(item: ProduceItem): DemoPlan {
  const crate: PlanPoint[] = [
    place(BOUNDS.min_x, BOUNDS.min_y),
    place(BOUNDS.max_x, BOUNDS.min_y),
    place(BOUNDS.max_x, BOUNDS.max_y),
    place(BOUNDS.min_x, BOUNDS.max_y),
  ];
  const near: [PlanPoint, PlanPoint] = [
    place(BOUNDS.min_x, BOUNDS.min_y),
    place(BOUNDS.min_x, BOUNDS.max_y),
  ];
  const rig = item === "tomato" ? BOUNDS.tomatoCameras : BOUNDS.cameras;
  const labels = ["A", "B", "C"];
  const marks: DemoPlan["marks"] = [
    {
      id: "top",
      label: "Cima",
      point: place(DEPTH_MAX - 0.08, (BOUNDS.min_y + BOUNDS.max_y) / 2),
    },
  ];
  rig.forEach((camera, index) => {
    marks.push({
      id: (["a", "b", "c"] as const)[index],
      label: labels[index],
      point: place(camera.origin[0], camera.origin[1]),
    });
  });
  return { crate, near, marks };
}

/** Screen point for a world position. Depth grows up the page. Across grows to the right. */
function place(depth: number, across: number): PlanPoint {
  return {
    x: ((across - ACROSS_MIN) / (ACROSS_MAX - ACROSS_MIN)) * 100,
    y: ((DEPTH_MAX - depth) / (DEPTH_MAX - DEPTH_MIN)) * 100,
  };
}

/** Pull the drawn stroke inside the photo so the frame edge does not clip it. */
export function guideOf(frame: DemoFrame): Quad {
  if (frame.id !== "top") return frame.target;
  const cx = frame.target.reduce((sum, point) => sum + point[0], 0) / frame.target.length;
  const cy = frame.target.reduce((sum, point) => sum + point[1], 0) / frame.target.length;
  const scale = 0.985;
  return frame.target.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

const TANGERINE_TRUTH: DemoTruth = {
  seed: 5,
  inside: 86,
  visible: 48,
  heightCm: 8.14,
  diameterCm: 5.05,
};

const TOMATO_TRUTH: DemoTruth = {
  seed: 1005,
  inside: 102,
  visible: 41,
  heightCm: 12.71,
  diameterCm: 5.42,
};

const TANGERINE_TOP: Quad = [
  [0.216 * PROTOCOL_WIDTH, 0.0807 * PROTOCOL_HEIGHT],
  [0.6967 * PROTOCOL_WIDTH, 0.0141 * PROTOCOL_HEIGHT],
  [0.8478 * PROTOCOL_WIDTH, 0.9463 * PROTOCOL_HEIGHT],
  [0.2462 * PROTOCOL_WIDTH, 1.0513 * PROTOCOL_HEIGHT],
];

const TOMATO_TOP: Quad = [
  [0.2236 * PROTOCOL_WIDTH, 0.0778 * PROTOCOL_HEIGHT],
  [0.7022 * PROTOCOL_WIDTH, 0.0221 * PROTOCOL_HEIGHT],
  [0.8433 * PROTOCOL_WIDTH, 0.9533 * PROTOCOL_HEIGHT],
  [0.2365 * PROTOCOL_WIDTH, 1.0433 * PROTOCOL_HEIGHT],
];

const TANGERINE_SIDE: Quad[] = [
  [
    [9, 358],
    [629, 359],
    [520, 91],
    [115, 92],
  ],
  [
    [80, 435],
    [629, 297],
    [475, 61],
    [82, 120],
  ],
  [
    [36, 303],
    [524, 440],
    [556, 129],
    [172, 56],
  ],
];

const TOMATO_SIDE: Quad[] = [
  [
    [10, 359],
    [629, 359],
    [524, 92],
    [118, 91],
  ],
  [
    [79, 434],
    [622, 302],
    [471, 60],
    [84, 119],
  ],
];
