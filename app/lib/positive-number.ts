/** Parse a finite positive number, accepting the Portuguese decimal comma. */
export function positiveNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized || (normalized.includes(",") && normalized.includes("."))) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
