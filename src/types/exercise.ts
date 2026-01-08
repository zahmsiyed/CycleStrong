// exercise.ts: Shared exercise domain types for the on-device database.

// Exercise category for filtering and UI grouping.
export type ExerciseCategory = "compound" | "accessory" | "core" | "cardio" | "other";

// Movement pattern helps drive planner logic and swaps.
export type MovementPattern = "push" | "pull" | "squat" | "hinge" | "core" | "cardio";

// Equipment is used for filters and availability checks.
export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "other";

// Exercise record stored in SQLite.
export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  movement_pattern: MovementPattern;
  equipment: Equipment;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};

// Insert type for new exercises (id/timestamps are optional or generated).
export type ExerciseInsert = Omit<Exercise, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
