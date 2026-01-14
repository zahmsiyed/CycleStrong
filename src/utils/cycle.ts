// cycle.ts: Shared utilities for cycle phase prediction and calculations.
import type { CyclePhase } from "../types/domain";

// Predict cycle phase based on day number using simple day-range heuristic.
export function predictPhaseFromDay(day: number | null): CyclePhase | null {
  if (!day) {
    return null;
  }
  // Phase prediction ranges are fixed for MVP.
  if (day >= 1 && day <= 5) {
    return "menstrual";
  }
  if (day >= 6 && day <= 13) {
    return "follicular";
  }
  if (day >= 14 && day <= 16) {
    return "ovulatory";
  }
  return "luteal";
}
