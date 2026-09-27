import type { Point } from "./frame-quality";

/** Image point to centimeters on the crate opening. `h[8]` is fixed at 1. */
export function openingScale(
  corners: Point[],
  lengthCm: number,
  widthCm: number,
): (point: Point) => Point {
  const target = [
    { x: 0, y: 0 },
    { x: lengthCm, y: 0 },
    { x: lengthCm, y: widthCm },
    { x: 0, y: widthCm },
  ];
  const h = solveHomography(corners, target);
  return (point) => applyHomography(h, point);
}

function solveHomography(from: Point[], to: Point[]): number[] {
  const rows: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = from[index];
    const { x: planeX, y: planeY } = to[index];
    rows.push([x, y, 1, 0, 0, 0, -planeX * x, -planeX * y]);
    values.push(planeX);
    rows.push([0, 0, 0, x, y, 1, -planeY * x, -planeY * y]);
    values.push(planeY);
  }
  return gaussian(rows, values);
}

function applyHomography(h: number[], point: Point): Point {
  const denominator = h[6] * point.x + h[7] * point.y + 1;
  return {
    x: (h[0] * point.x + h[1] * point.y + h[2]) / denominator,
    y: (h[3] * point.x + h[4] * point.y + h[5]) / denominator,
  };
}

function gaussian(rows: number[][], values: number[]): number[] {
  const n = values.length;
  const matrix = rows.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 1e-10) throw new Error("corners do not define a plane");
    for (let columnIndex = column; columnIndex <= n; columnIndex += 1) {
      matrix[column][columnIndex] /= divisor;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let columnIndex = column; columnIndex <= n; columnIndex += 1) {
        matrix[row][columnIndex] -= factor * matrix[column][columnIndex];
      }
    }
  }
  return matrix.map((row) => row[n]);
}
