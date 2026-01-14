// number.ts: Shared utilities for number parsing and validation.

// Parse a number from a string with validation and fallback.
export function parseNumber(value: string, fallback: number, min?: number): number {
  if (!value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return min !== undefined ? Math.max(min, parsed) : parsed;
}

// Parse an optional number (returns undefined for empty input).
export function parseOptionalNumber(value: string, fallback?: number, min?: number): number | undefined {
  if (!value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return min !== undefined ? Math.max(min, parsed) : parsed;
}
