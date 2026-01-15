// format.ts: Shared formatting helpers for reps and weight display.
import { formatWeight, type WeightUnit } from "./units";

// Always display reps with labels when shown as a single number.
export function formatReps(reps: number): string {
  return `${reps} reps`;
}

// Summary format for a single set: "245lbs x 4 reps".
export function formatSummarySet(weightLbs: number, reps: number, unit: WeightUnit): string {
  return `${formatWeight(weightLbs, unit)} x ${formatReps(reps)}`;
}

// Compact overview format for a plan: "3x8 @175lbs".
export function formatOverviewPrescription(
  sets: number,
  reps: number,
  weightLbs: number,
  unit: WeightUnit,
): string {
  return `${sets}x${reps} @${formatWeight(weightLbs, unit)}`;
}
