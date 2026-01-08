// format.ts: Shared formatting helpers for reps and weight display.

// Always display weights with units, weight first.
export function formatWeightLbs(weight: number): string {
  return `${weight}lbs`;
}

// Always display reps with labels when shown as a single number.
export function formatReps(reps: number): string {
  return `${reps} reps`;
}

// Summary format for a single set: "245lbs x 4 reps".
export function formatSummarySet(weight: number, reps: number): string {
  return `${formatWeightLbs(weight)} x ${formatReps(reps)}`;
}

// Compact overview format for a plan: "3x8 @175lbs".
export function formatOverviewPrescription(sets: number, reps: number, weight: number): string {
  return `${sets}x${reps} @${formatWeightLbs(weight)}`;
}
