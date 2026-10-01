/**
 * The count the screens run today.
 *
 * Tangerines are a top-layer count times a number of layers. Tomatoes and
 * carrots are liters times a kilograms-per-liter typed from the lot. Bananas
 * are hands times fingers times hand layers. The photo height readers live in
 * `sim/detect/` and are not called from here.
 */

/** Vertical step of hexagonal sphere packing, in diameters. About 0.816, written 0.82 in the book. */
export const HCP_PITCH = Math.sqrt(2 / 3);

export type Crate = {
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type Estimate = {
  value: number;
  unit: "un" | "kg";
  relativeSigma: number;
  flags: string[];
};

/** Inner length times inner width, in square centimeters. */
export function baseAreaCm2(crate: Crate): number {
  return crate.lengthCm * crate.widthCm;
}

/** Pile volume. One liter is 1000 cm³, so the height in centimeters divides by 1000. */
export function volumeLiters(crate: Crate, fillHeightCm: number): number {
  return (baseAreaCm2(crate) * fillHeightCm) / 1000;
}

/**
 * How many layers fit in the fill height.
 *
 * The first layer is one diameter tall. Each later layer rises `pitchFactor`
 * diameters. `residual` is how far the raw value sits from the nearest integer.
 * Above 0.25 the stack is irregular and the screen should ask for another arc.
 */
export function layerCount(
  fillHeightCm: number,
  diameterCm: number,
  pitchFactor: number,
): { layers: number; residual: number } {
  if (diameterCm <= 0 || fillHeightCm <= 0 || pitchFactor <= 0) {
    throw new Error("diameter, fill height, and pitch must be positive");
  }
  const raw = 1 + (fillHeightCm - diameterCm) / (pitchFactor * diameterCm);
  const rounded = Math.round(raw);
  return {
    layers: Math.max(1, rounded),
    residual: Math.abs(raw - rounded),
  };
}

/** Units: visible fruits on top times the rounded layer count. */
export function tangerineCount(
  topCount: number,
  diameterCm: number,
  fillHeightCm: number,
  pitchFactor = HCP_PITCH,
): Estimate {
  const { layers, residual } = layerCount(fillHeightCm, diameterCm, pitchFactor);
  const flags = residual > 0.25 ? ["layer_height_inconsistent"] : [];
  const relativeSigma = Math.hypot(0.03, 0.04, 0.03, 0.04);
  return {
    value: topCount * layers,
    unit: "un",
    relativeSigma,
    flags,
  };
}

/**
 * Kilograms: liters of the pile times the lot's kilograms per liter.
 *
 * Tomato and carrot share this account. The density is typed from a weighing
 * of that lot. A thin carrot and a thick carrot do not share the number.
 * A photo does not produce it.
 */
export function massFromLiters(
  crate: Crate,
  fillHeightCm: number,
  bulkDensityKgPerLiter: number,
): Estimate {
  if (fillHeightCm <= 0 || fillHeightCm > crate.heightCm) {
    throw new Error("fill height is outside the crate");
  }
  if (bulkDensityKgPerLiter <= 0) {
    throw new Error("bulk density must be positive");
  }
  return {
    value: volumeLiters(crate, fillHeightCm) * bulkDensityKgPerLiter,
    unit: "kg",
    relativeSigma: Math.hypot(0.02, 0.05, 0.06),
    flags: [],
  };
}

/** Tomato mass. The carrot will call `massFromLiters` with its own lot density. */
export function tomatoMassKg(
  crate: Crate,
  fillHeightCm: number,
  bulkDensityKgPerLiter: number,
): Estimate {
  return massFromLiters(crate, fillHeightCm, bulkDensityKgPerLiter);
}

/**
 * Banana fingers: visible hands times fingers per hand times hand layers.
 *
 * This phase does not offer banana. The flag keeps the estimate from being
 * published if a screen calls it early. The hand thickness that sets the
 * layer count is measured on the lot.
 */
export function bananaFingers(
  visibleHands: number,
  fingersPerHand: number,
  handLayers: number,
): Estimate {
  if (visibleHands <= 0 || fingersPerHand <= 0 || handLayers <= 0) {
    throw new Error("hands, fingers, and layers must be positive");
  }
  return {
    value: visibleHands * fingersPerHand * handLayers,
    unit: "un",
    relativeSigma: Math.hypot(0.03, 0.04, 0.03, 0.04),
    flags: ["not_in_this_phase"],
  };
}

/** Approximate 95% interval from the estimate's relative sigma. */
export function interval(estimate: Estimate): { low: number; high: number } {
  return {
    low: estimate.value * (1 - 1.96 * estimate.relativeSigma),
    high: estimate.value * (1 + 1.96 * estimate.relativeSigma),
  };
}

/** True when that interval fits inside the relative tolerance, 0.10 for this phase. */
export function fitsTolerance(estimate: Estimate, tolerance: number): boolean {
  return 1.96 * estimate.relativeSigma <= tolerance;
}
