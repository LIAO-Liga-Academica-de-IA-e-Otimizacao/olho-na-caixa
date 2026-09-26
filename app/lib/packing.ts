/** Vertical step of hexagonal sphere packing, in diameters. */
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

export function baseAreaCm2(crate: Crate): number {
  return crate.lengthCm * crate.widthCm;
}

export function volumeLiters(crate: Crate, fillHeightCm: number): number {
  return (baseAreaCm2(crate) * fillHeightCm) / 1000;
}

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

export function tomatoMassKg(
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

export function interval(estimate: Estimate): { low: number; high: number } {
  return {
    low: estimate.value * (1 - 1.96 * estimate.relativeSigma),
    high: estimate.value * (1 + 1.96 * estimate.relativeSigma),
  };
}

export function fitsTolerance(estimate: Estimate, tolerance: number): boolean {
  return 1.96 * estimate.relativeSigma <= tolerance;
}
