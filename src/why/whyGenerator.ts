// whyGenerator.ts: Deterministic explanation builder for the Why screen.
import type {
  CheckIn,
  CompletedSessionSummary,
  LastWorkoutSummary,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";
import { getEffectivePhase } from "../utils/checkIn";
import { DEFAULT_SETS, RECOMMENDATION_DISCLAIMER } from "../utils/constants";

// Extract human-readable symptom tags (excluding "none").
function getActiveSymptoms(checkIn: CheckIn) {
  return (checkIn.symptoms ?? []).filter((symptom) => symptom !== "none");
}

// Detect a simple volume reduction signal from the plan.
function hasAccessorySetReduction(plan: WorkoutPlan) {
  // Treat any non-cardio exercise reduced below the default sets as a volume cut.
  return plan.exercises.some((exercise) => !exercise.isCardio && exercise.sets < DEFAULT_SETS);
}

// Build a deterministic WhyExplanation from real inputs.
export function buildWhyExplanation(args: {
  checkIn: CheckIn;
  plan: WorkoutPlan;
  lastWorkout: LastWorkoutSummary;
  completedSessionForDate?: CompletedSessionSummary;
  weightUnit?: WeightUnit;
}): WhyExplanation {
  const { checkIn, plan, lastWorkout, weightUnit = "lbs" } = args;
  // completedSessionForDate is intentionally handled in the UI for a separate callout.
  const phase = getEffectivePhase(checkIn);
  const phaseSource = checkIn.phase_override ? "manual" : "predicted";
  const symptoms = getActiveSymptoms(checkIn);
  const hasSetReduction = hasAccessorySetReduction(plan);

  // Summary bullets include changes, reasons, and a warm-up permission.
  const bullets: string[] = [];
  const intensityPct = plan.intensity_adjustment_pct;

  if (intensityPct < 0) {
    bullets.push(`Adjusted loads by ${intensityPct}% to match today's readiness.`);
  } else if (intensityPct > 0) {
    bullets.push(`Adjusted loads by +${intensityPct}% for a confident day.`);
  } else {
    bullets.push("Kept loads at baseline for a normal training day.");
  }

  bullets.push(`Intensity reason: ${plan.intensity_reason}.`);

  if (hasSetReduction) {
    bullets.push("Reduced one accessory set to keep volume manageable.");
  }

  if (symptoms.length) {
    bullets.push(`Symptoms noted: ${symptoms.join(", ")}.`);
  } else {
    bullets.push("No symptoms reported today.");
  }

  // Always reference phase source (manual vs predicted) for transparency.
  bullets.push(`Phase: ${phase} (${phaseSource}).`);

  bullets.push("If warm-up feels great, add +5 lb to the main lift (max +5 lb).");

  // Progression signal references last workout and today’s intent.
  const topSet = lastWorkout.top_sets[0];
  const topSetLabel = topSet
    ? (topSet.reps !== undefined && topSet.weight_lbs !== undefined
        ? formatSummarySet(topSet.weight_lbs, topSet.reps, weightUnit)
        : topSet.prescription)
    : "";
  const progressionSignal = topSet
    ? (intensityPct < 0
        ? `Holding progression after ${topSet.exercise} (${topSetLabel}) to protect quality.`
        : `Progressing from ${topSet.exercise} (${topSetLabel}) with steady intent.`)
    : "Holding progression with steady intent.";

  // Volume adjustment reflects set reductions when present.
  const volumeAdjustment = hasSetReduction
    ? "Accessory volume was trimmed by one set to support recovery."
    : "Volume is steady; adjustments are focused on load only.";

  // Fatigue management uses phase and symptoms to guide recovery cues.
  const fatigueManagement = (phase === "luteal" || phase === "menstrual")
    ? "Later-cycle recovery can be slower; keep rest honest and prioritize form."
    : "Standard recovery guidance applies; maintain consistent rest and tempo.";

  // Disclaimer is always shown.
  const disclaimer = RECOMMENDATION_DISCLAIMER;

  return {
    bullets,
    progression_signal: progressionSignal,
    volume_adjustment: volumeAdjustment,
    fatigue_management: fatigueManagement,
    disclaimer,
  };
}
