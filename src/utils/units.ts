// units.ts: Weight unit conversion helpers (LBS as source of truth).

// Supported weight unit options for display and input.
export type WeightUnit = "lbs" | "kg";

// Exact conversion constants.
export const LBS_TO_KG = 0.45359237;
export const KG_TO_LBS = 1 / LBS_TO_KG;

// Convert pounds to kilograms.
export function lbsToKg(lbs: number) {
  return lbs * LBS_TO_KG;
}

// Convert kilograms to pounds.
export function kgToLbs(kg: number) {
  return kg * KG_TO_LBS;
}

// Round values for UI display (1.0 precision for MVP).
export function roundForDisplay(value: number) {
  return Math.round(value);
}

// Format a stored LBS value for display in the selected unit.
export function formatWeight(valueLbs: number, unit: WeightUnit) {
  const value = unit === "kg" ? roundForDisplay(lbsToKg(valueLbs)) : roundForDisplay(valueLbs);
  return `${value}${unit}`;
}

// Format a stored LBS value for input display (numeric only).
export function formatWeightValue(valueLbs: number, unit: WeightUnit) {
  const value = unit === "kg" ? roundForDisplay(lbsToKg(valueLbs)) : roundForDisplay(valueLbs);
  return String(value);
}

// Parse a user-entered weight and return the LBS value.
export function parseWeightInput(input: string, unit: WeightUnit) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) {
    return null;
  }
  const lbs = unit === "kg" ? kgToLbs(numeric) : numeric;
  return Math.round(lbs);
}
