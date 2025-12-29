// whyGenerator.ts: Deterministic explanation builder for the Why screen.
import type {
  CheckIn,
  CompletedSessionSummary,
  CyclePhase,
  LastWorkoutSummary,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";

// Resolve the effective cycle phase (manual override wins).
function getEffectivePhase(checkIn: CheckIn): CyclePhase {
  return checkIn.phase_override ?? checkIn.predicted_phase;
}

// Extract human-readable symptom tags (excluding "none").
function getActiveSymptoms(checkIn: CheckIn) {
  return (checkIn.symptoms ?? []).filter((symptom) => symptom !== "none");
}

// Detect a simple volume reduction signal from the plan.
function hasAccessorySetReduction(plan: WorkoutPlan) {
  // For MVP we treat Hamstring Curl set reduction as a volume cut signal.
  return plan.exercises.some((exercise) => exercise.id === "hamstring_curl" && exercise.sets < 3);
}

// Build a deterministic WhyExplanation from real inputs.
export function buildWhyExplanation(args: {
  checkIn: CheckIn;
  plan: WorkoutPlan;
  lastWorkout: LastWorkoutSummary;
  completedSession?: CompletedSessionSummary;
}): WhyExplanation {
  const { checkIn, plan, lastWorkout } = args;
  // completedSession is intentionally handled in the UI for a separate callout.
  const phase = getEffectivePhase(checkIn);
  const symptoms = getActiveSymptoms(checkIn);
  const hasSetReduction = hasAccessorySetReduction(plan);

  // Summary bullets include changes, reasons, and a warm-up permission.
  const bullets: string[] = [];
  const intensityPct = plan.intensity_adjustment_pct;

  if (intensityPct < 0) {
    bullets.push(`Adjusted loads by ${intensityPct}% to match today's readiness.`);
  } else {
    bullets.push("Kept loads at baseline for a normal training day.");
  }

  if (hasSetReduction) {
    bullets.push("Reduced one accessory set to lower total volume.");
  }

  if (symptoms.length) {
    bullets.push(`Symptoms noted: ${symptoms.join(", ")}.`);
  } else {
    bullets.push(`Phase context: ${phase} (no reported symptoms).`);
  }

  bullets.push("If warm-up feels great, add +5 lb to the main lift.");

  // Progression signal references last workout and today’s intent.
  const topSet = lastWorkout.top_sets[0];
  const progressionSignal = intensityPct < 0
    ? `Holding progression after ${topSet.exercise} (${topSet.prescription}) to protect quality.`
    : `Progressing from ${topSet.exercise} (${topSet.prescription}) with steady intent.`;

  // Volume adjustment reflects set reductions when present.
  const volumeAdjustment = hasSetReduction
    ? "Accessory volume was trimmed by one set to support recovery."
    : "Volume is steady; adjustments are focused on load only.";

  // Fatigue management uses phase and symptoms to guide recovery cues.
  const fatigueManagement = (phase === "luteal" || phase === "menstrual")
    ? "Later-cycle recovery can be slower; keep rest honest and prioritize form."
    : "Standard recovery guidance applies; maintain consistent rest and tempo.";

  // Disclaimer is always shown.
  const disclaimer = "Not medical advice. Consult a healthcare professional for medical concerns.";

  return {
    bullets,
    progression_signal: progressionSignal,
    volume_adjustment: volumeAdjustment,
    fatigue_management: fatigueManagement,
    disclaimer,
  };
}
