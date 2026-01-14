// localPlanner.ts: Deterministic local planner with guardrails for MVP safety.
import type {
  CheckIn,
  ExercisePlan,
  LastWorkoutSummary,
  SymptomTag,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";
import type { WorkoutTemplate } from "./workoutTemplates";
import { getEffectivePhase } from "../utils/checkIn";
import { MIN_VOLUME_RATIO, RECOMMENDATION_DISCLAIMER } from "../utils/constants";

// Hard safety bounds for intensity adjustments.
const INTENSITY_MIN = -15;
const INTENSITY_MAX = 5;

// Helper to round weights to the nearest 5 pounds.
function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}

// Helper to clamp a number within a safe range.
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Helper to determine whether a symptom tag is present (ignoring "none").
function hasSymptom(checkIn: CheckIn, symptom: SymptomTag) {
  const list = checkIn.symptoms ?? [];
  return list.includes(symptom) && !list.includes("none");
}

// Clamp prescriptions to safe minimums.
function sanitizePrescription(exercise: ExercisePlan): ExercisePlan {
  return {
    ...exercise,
    sets: Math.max(1, Math.floor(exercise.sets)),
    reps: Math.max(1, Math.floor(exercise.reps)),
    weight_lbs: Math.max(0, exercise.weight_lbs),
  };
}

// Reduce one accessory-leaning set if allowed by total volume limits.
function applyAccessoryReduction(exercises: ExercisePlan[]) {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  // Only reduce one set if we stay within the volume reduction limit.
  const canReduce = totalSets > 0 && (totalSets - 1) / totalSets >= MIN_VOLUME_RATIO;
  if (!canReduce) {
    return exercises;
  }

  // Prefer reducing the last non-cardio movement (more likely an accessory).
  const reverseIndex = [...exercises].reverse().findIndex((exercise) => !exercise.isCardio && exercise.sets > 1);
  if (reverseIndex < 0) {
    return exercises;
  }
  const targetIndex = exercises.length - 1 - reverseIndex;

  return exercises.map((exercise, index) => {
    if (index !== targetIndex) {
      return exercise;
    }
    return { ...exercise, sets: exercise.sets - 1 };
  });
}

// Generate a deterministic plan id that supports versioning by date.
export function getPlanVersionId(date: string, existingId?: string, forceNew?: boolean) {
  const prefix = `plan_${date}_v`;
  // If we're not forcing a new version, reuse the existing id.
  if (!forceNew && existingId) {
    return existingId;
  }
  // Parse an existing version suffix when possible.
  let nextVersion = 1;
  if (existingId && existingId.startsWith(prefix)) {
    const raw = existingId.slice(prefix.length);
    const current = Number(raw);
    if (!Number.isNaN(current) && current > 0) {
      nextVersion = current + 1;
    }
  }
  return `${prefix}${nextVersion}`;
}

// Build a deterministic workout plan and why explanation for today.
export function buildLocalPlan(args: {
  checkIn: CheckIn;
  lastWorkout: LastWorkoutSummary;
  planId: string;
  template: WorkoutTemplate;
}) {
  const { checkIn, lastWorkout, planId, template } = args;
  const phase = getEffectivePhase(checkIn);
  const lowEnergy = hasSymptom(checkIn, "low_energy");
  const cramps = hasSymptom(checkIn, "cramps");

  // Determine intensity adjustment rules based on phase and symptoms.
  const isLaterCycle = phase === "luteal" || phase === "menstrual";
  const hasSevereSymptoms = lowEnergy && (isLaterCycle || cramps);

  let intensityPct = 0;
  let intensityReason = "baseline";
  if (hasSevereSymptoms) {
    intensityPct = -10;
    intensityReason = "symptoms: low energy";
  } else if (isLaterCycle) {
    intensityPct = -5;
    intensityReason = "phase: later-cycle";
  }
  // Enforce absolute safety bounds for intensity.
  intensityPct = clamp(intensityPct, INTENSITY_MIN, INTENSITY_MAX);

  // Base workout template uses exercise ids; names are resolved via SQLite at render time.
  const exercises: ExercisePlan[] = template.items.map((item) => ({
    exerciseId: item.exerciseId,
    sets: item.sets,
    reps: item.reps,
    weight_lbs: item.weight_lbs,
    isCardio: item.isCardio,
  }));

  // Apply intensity adjustments by modifying weights only on non-cardio exercises.
  const adjustedExercises = exercises.map((exercise) => {
    if (exercise.isCardio) {
      return exercise;
    }
    const adjustedWeight = roundToNearestFive(exercise.weight_lbs * (1 + intensityPct / 100));
    return { ...exercise, weight_lbs: Math.max(0, adjustedWeight) };
  });

  // Apply symptom-based accessory set reduction with volume limit.
  const reducedExercises = (lowEnergy || cramps)
    ? applyAccessoryReduction(adjustedExercises)
    : adjustedExercises;

  // Sanitize prescriptions to avoid zero/negative values.
  const finalExercises = reducedExercises.map((exercise) => sanitizePrescription(exercise));

  // Build the structured workout plan.
  const plan: WorkoutPlan = {
    id: planId,
    date: checkIn.date,
    template_key: template.key,
    title: template.name,
    duration_min: 60,
    equipment: "Mixed Equipment",
    intensity_adjustment_pct: intensityPct,
    intensity_reason: intensityReason,
    exercises: finalExercises,
  };

  // Create explanation bullets that reference what changed and why.
  const bullets: string[] = [];
  if (intensityPct < 0) {
    bullets.push(`Adjusted loads by ${intensityPct}% to match readiness.`);
  } else if (intensityPct > 0) {
    bullets.push(`Adjusted loads by +${intensityPct}% for a confident day.`);
  } else {
    bullets.push("Kept loads at baseline for a normal training day.");
  }

  if (lowEnergy || cramps) {
    bullets.push("Reduced one accessory set due to reported symptoms.");
  }

  bullets.push(`Reason: ${intensityReason} during ${phase} phase.`);
  bullets.push("If warm-up feels great, add +5 lb to the main lift (max +5 lb).");

  // Build progression signal based on last workout context.
  const topSet = lastWorkout.top_sets[0];
  const progressionSignal = intensityPct < 0
    ? `Holding progression after ${topSet.exercise} (${topSet.prescription}) to keep quality high.`
    : `Progressing from ${topSet.exercise} (${topSet.prescription}) with steady intent.`;

  // Describe any volume adjustment.
  const volumeAdjustment = (lowEnergy || cramps)
    ? "Reduced one accessory set to lower total volume today."
    : "Volume is held steady; only load intensity was adjusted.";

  // Explain fatigue management for later-cycle or symptom days.
  const fatigueManagement = (phase === "luteal" || phase === "menstrual" || cramps)
    ? "Later-cycle recovery can be slower; prioritize warm-up quality and longer rests."
    : "Standard recovery guidance applies; keep rest consistent between sets.";

  // Structured why explanation output.
  const why: WhyExplanation = {
    bullets,
    progression_signal: progressionSignal,
    volume_adjustment: volumeAdjustment,
    fatigue_management: fatigueManagement,
    disclaimer: RECOMMENDATION_DISCLAIMER,
  };

  return { plan, why };
}
