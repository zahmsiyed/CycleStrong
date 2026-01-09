// workoutTemplates.ts: Hardcoded workout templates with ordered exercise ids.

// Template item shape used for plan generation.
export type TemplateItem = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight_lbs: number;
  // Cardio flag keeps these items out of load/volume adjustments.
  isCardio?: boolean;
};

// Workout template definition.
export type WorkoutTemplate = {
  key: "upper" | "lower" | "core_cardio";
  name: string;
  items: TemplateItem[];
};

// Default prescriptions used for strength/core items.
const DEFAULT_SETS = 3;
const DEFAULT_REPS = 8;
const DEFAULT_WEIGHT = 175;

// Built-in templates used by the Workout screen dropdown.
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    key: "upper",
    name: "Upper",
    items: [
      { exerciseId: "barbell_bench_press_medium_grip", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "seated_cable_rows", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "dumbbell_shoulder_press", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "medium_grip_lat_pulldown", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "side_lateral_raise", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "triceps_pushdown", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "dumbbell_bicep_curl", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
    ],
  },
  {
    key: "lower",
    name: "Lower",
    items: [
      { exerciseId: "barbell_squat", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "romanian_deadlift", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "leg_press", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "dumbbell_lunges", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "seated_leg_curl", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "standing_calf_raises", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
    ],
  },
  {
    key: "core_cardio",
    name: "Core + Cardio",
    items: [
      { exerciseId: "hanging_leg_raise", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "cable_crunch", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "hyperextensions_back_extensions", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "plank", sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight_lbs: DEFAULT_WEIGHT },
      { exerciseId: "walking_treadmill", sets: 1, reps: 1, weight_lbs: 0, isCardio: true },

    ],
  },
];

// Helper to fetch a template by key.
export function getTemplateByKey(key: WorkoutTemplate["key"]) {
  return WORKOUT_TEMPLATES.find((template) => template.key === key);
}
