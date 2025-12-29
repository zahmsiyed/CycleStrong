// localPlanner.ts: Deterministic local planner for workout and explanation generation.
import type {
  CheckIn,
  CyclePhase,
  ExercisePlan,
  LastWorkoutSummary,
  SymptomTag,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";

// Helper to round weights to the nearest 5 pounds.
function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
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

  // Base workout template for MVP (deterministic).
  const exercises: ExercisePlan[] = [
    {
      id: "hip_thrust",
      name: "Hip Thrust",
      sets: 3,
      reps: 8,
      weight: 175,
      alternatives: ["Glute Bridge", "Smith Hip Thrust"],
    },
    {
      id: "romanian_deadlift",
      name: "Romanian Deadlift",
      sets: 3,
      reps: 6,
      weight: 125,
      alternatives: ["DB RDL", "Light Good Morning"],
    },
    {
      id: "leg_press",
      name: "Leg Press",
      sets: 3,
      reps: 10,
      weight: 250,
      alternatives: ["Hack Squat", "Goblet Squat"],
    },
    {
      id: "hamstring_curl",
      name: "Hamstring Curl",
      sets: 3,
      reps: 12,
      weight: 70,
      alternatives: ["Nordic (assisted)", "Band Curl"],
    },
    {
      id: "glute_med_cable",
      name: "Glute Med Cable",
      sets: 2,
      reps: 15,
      weight: 25,
      alternatives: ["Band Lateral Walk", "Hip Abduction"],
    },
  ];

  // Apply intensity adjustments by modifying weights only.
  const adjustedExercises = exercises.map((exercise) => {
    const adjustedWeight = roundToNearestFive(exercise.weight * (1 + intensityPct / 100));
    return { ...exercise, weight: adjustedWeight };
  });

  // If -10%, reduce one accessory set (Hamstring Curl 3 -> 2).
  const finalExercises = adjustedExercises.map((exercise) => {
    if (intensityPct === -10 && exercise.id === "hamstring_curl") {
      return { ...exercise, sets: 2 };
    }
    return exercise;
  });

  // Build the structured workout plan.
  const plan: WorkoutPlan = {
    id: planId,
    date: checkIn.date,
    title: "Glutes + Hamstrings",
    duration_min: 60,
    equipment: "Barbell + Machines",
    intensity_adjustment_pct: intensityPct,
    intensity_reason: intensityReason,
    exercises: finalExercises,
  };

  // Create explanation bullets that reference what changed and why.
  const bullets: string[] = [];
  if (intensityPct === -10) {
    bullets.push("Reduced loads by 10% and trimmed one accessory set.");
  } else if (intensityPct === -5) {
    bullets.push("Reduced loads by 5% to match the current phase.");
  } else {
    bullets.push("Kept loads at baseline for a normal training day.");
  }

  if (intensityPct < 0) {
    bullets.push(`Reason: ${intensityReason} during ${phase} phase.`);
  } else {
    bullets.push(`Reason: baseline status with phase = ${phase}.`);
  }

  bullets.push("If warm-up feels great, add +5 lb to the main lift.");

  // Build progression signal based on last workout context.
  const topSet = lastWorkout.top_sets[0];
  const progressionSignal = intensityPct < 0
    ? `Holding progression after ${topSet.exercise} (${topSet.prescription}) to keep quality high.`
    : `Progressing from ${topSet.exercise} (${topSet.prescription}) with steady intent.`;

  // Describe any volume adjustment.
  const volumeAdjustment = intensityPct === -10
    ? "Reduced one accessory set (Hamstring Curl) to lower total volume today."
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
    disclaimer: "Not medical advice. Consult a healthcare professional for medical concerns.",
  };

  return { plan, why };
}
