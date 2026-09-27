export type Comparison = {
  estimate: number;
  truth: number;
};

export type FrozenReport = {
  n: number;
  bias: number;
  meanAbsolute: number;
  sampleStd: number | null;
  withinFraction: number;
  p90Absolute: number;
};

/** Published figures for a frozen set. The errors are (estimate − truth) / truth. */
export function frozenReport(pairs: Comparison[]): FrozenReport | null {
  if (pairs.length === 0) return null;
  const errors = pairs.map((pair) => {
    if (!(pair.truth > 0)) throw new Error("truth must be positive");
    return (pair.estimate - pair.truth) / pair.truth;
  });
  const n = errors.length;
  const bias = mean(errors);
  const absolute = errors.map((error) => Math.abs(error));
  const meanAbsolute = mean(absolute);
  const sampleStd = n < 2 ? null : Math.sqrt(sumSquares(errors, bias) / (n - 1));
  const withinFraction = absolute.filter((error) => error <= 0.1).length / n;
  const sorted = [...absolute].sort((left, right) => left - right);
  const rank = Math.ceil(0.9 * n) - 1;
  return {
    n,
    bias,
    meanAbsolute,
    sampleStd,
    withinFraction,
    p90Absolute: sorted[rank],
  };
}

export const SIMULATION_STATEMENT =
  "A verdade foi a contagem gerada pelo simulador, sob as hipóteses da cena. Este número não é a margem de erro de fruta de cozinha.";

export type SimulationReport = FrozenReport & {
  source: "simulation";
  statement: typeof SIMULATION_STATEMENT;
};

/** Same figures as the frozen set, kept labeled so a render cannot be filed as a kitchen error. */
export function simulationReport(pairs: Comparison[]): SimulationReport | null {
  const report = frozenReport(pairs);
  if (!report) return null;
  return { ...report, source: "simulation", statement: SIMULATION_STATEMENT };
}

/** Two counts agree when their difference is under 2% of their average. */
export function countsAgree(first: number, second: number): boolean {
  const average = (first + second) / 2;
  if (!(average > 0)) return false;
  return Math.abs(first - second) / average < 0.02;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumSquares(values: number[], center: number): number {
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0);
}
