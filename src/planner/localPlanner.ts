// localPlanner.ts: Deterministic local planner with guardrails for MVP safety.
import type {
  CheckIn,
  CyclePhase,
  ExercisePlan,
  LastWorkoutSummary,
  SymptomTag,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";

// Hard safety bounds for intensity adjustments.
const INTENSITY_MIN = -15;
const INTENSITY_MAX = 5;

// Accessory exercise ids eligible for conservative set reductions.
const ACCESSORY_IDS = new Set(["hamstring_curl", "glute_med_cable"]);

// PRD-safe disclaimer used for all recommendation text.
const RECOMMENDATION_DISCLAIMER =
  "Not medical advice. Adjust based on pain and consult a professional if needed.";

// Helper to round weights to the nearest 5 pounds.
function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}

// Helper to clamp a number within a safe range.
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Helper to resolve the effective phase (override wins).
function getEffectivePhase(checkIn: CheckIn): CyclePhase {
  return checkIn.phase_override ?? checkIn.predicted_phase;
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
    weight: Math.max(0, exercise.weight),
  };
}

// Reduce one accessory set if allowed by total volume limits.
function applyAccessoryReduction(exercises: ExercisePlan[]) {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  // Only reduce one set if we stay within the 20% reduction limit.
  const canReduce = totalSets > 0 && (totalSets - 1) / totalSets >= 0.8;
  if (!canReduce) {
    return exercises;
  }
  let reduced = false;
  return exercises.map((exercise) => {
    if (reduced) {
      return exercise;
    }
    if (ACCESSORY_IDS.has(exercise.id) && exercise.sets > 1) {
      reduced = true;
      return { ...exercise, sets: exercise.sets - 1 };
    }
    return exercise;
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
}) {
  const { checkIn, lastWorkout, planId } = args;
  const phase = getEffectivePhase(checkIn);
  const lowEnergy = hasSymptom(checkIn, "low_energy");
  const cramps = hasSymptom(checkIn, "cramps");

  // Determine intensity adjustment rules based on phase and symptoms.
  let intensityPct = 0;
  let intensityReason = "baseline";
  if (lowEnergy && ((phase === "luteal" || phase === "menstrual") || cramps)) {
    intensityPct = -10;
    intensityReason = "symptoms: low energy";
  } else if (phase === "luteal" || phase === "menstrual") {
    intensityPct = -5;
    intensityReason = "phase: later-cycle";
  }
  // Enforce absolute safety bounds for intensity.
  intensityPct = clamp(intensityPct, INTENSITY_MIN, INTENSITY_MAX);

  // Base workout template for MVP (deterministic).
  const exercises: ExercisePlan[] = [
    {
      id: "hip_thrust",
      name: "Hip Thrust",
      sets: 3,
      reps: 5,
      weight: 175,
      alternatives: ["Glute Bridge", "Smith Hip Thrust"],
    },
    {
      id: "romanian_deadlift",
      name: "Romanian Deadlift",
      sets: 3,
      reps: 5,
      weight: 175,
      alternatives: ["DB RDL", "Light Good Morning"],
    },
    {
      id: "leg_press",
      name: "Leg Press",
      sets: 3,
      reps: 5,
      weight: 175,
      alternatives: ["Hack Squat", "Goblet Squat"],
    },
    {
      id: "hamstring_curl",
      name: "Hamstring Curl",
      sets: 3,
      reps: 5,
      weight: 175,
      alternatives: ["Nordic (assisted)", "Band Curl"],
    },
    {
      id: "glute_med_cable",
      name: "Glute Med Cable",
      sets: 2,
      reps: 5,
      weight: 175,
      alternatives: ["Band Lateral Walk", "Hip Abduction"],
    },
  ];

  // Apply intensity adjustments by modifying weights only.
  const adjustedExercises = exercises.map((exercise) => {
    const adjustedWeight = roundToNearestFive(exercise.weight * (1 + intensityPct / 100));
    return { ...exercise, weight: Math.max(0, adjustedWeight) };
  });

  // Apply symptom-based accessory set reduction with a 20% cap.
  const reducedExercises = (lowEnergy || cramps)
    ? applyAccessoryReduction(adjustedExercises)
    : adjustedExercises;

  // Sanitize prescriptions to avoid zero/negative values.
  const finalExercises = reducedExercises.map((exercise) => sanitizePrescription(exercise));

  // Build the structured workout plan.
  const plan: WorkoutPlan = {
    id: planId,
    date: checkIn.date,
    // Track generation time for beta-safe plan freshness UI.
    generatedAt: new Date().toISOString(),
    title: "Glutes + Hamstrings",
    duration_min: 60,
    equipment: "Barbell + Machines",
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
