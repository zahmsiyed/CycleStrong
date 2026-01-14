// checkIn.ts: Shared utilities for cycle check-in processing.
import type { CheckIn, CyclePhase } from "../types/domain";

// Resolve the effective cycle phase (manual override wins over predicted).
export function getEffectivePhase(checkIn: CheckIn): CyclePhase {
  return checkIn.phase_override ?? checkIn.predicted_phase;
}
