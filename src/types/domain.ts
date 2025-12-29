// domain.ts: Shared domain types for check-ins, plans, and explanations.

// ISO date string format used across the app.
export type ISODate = string;

// Symptom tags supported by the Cycle check-in.
export type SymptomTag = "low_energy" | "cramps" | "bloating" | "headache" | "none";

// Cycle phases supported by the planner.
export type CyclePhase = "follicular" | "ovulatory" | "luteal" | "menstrual" | "unknown";

// Check-in model stored per day.
export type CheckIn = {
  date: ISODate;
  cycle_day?: number;
  cycle_length?: number;
  predicted_phase: CyclePhase;
  phase_override?: CyclePhase;
  symptoms: SymptomTag[];
  // Optional cycle details used for prediction inputs.
  last_period_start?: string;
  typical_bleed_days?: number;
};

// Individual exercise plan for a workout.
export type ExercisePlan = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  alternatives?: string[];
  // Optional original name stored when swapping exercises.
  original_name?: string;
};

// Structured workout plan created by the local planner.
export type WorkoutPlan = {
  id: string;
  date: ISODate;
  title: string;
  duration_min: number;
  equipment: string;
  intensity_adjustment_pct: number;
  intensity_reason: string;
  exercises: ExercisePlan[];
};

// Summary of the last workout for progression context.
export type LastWorkoutSummary = {
  date_label: string;
  name: string;
  top_sets: Array<{ exercise: string; prescription: string; note?: string }>;
  volume_lbs: number;
  rpe_avg: number;
  prs: string[];
};

// Summary of a completed workout session for a given date.
export type CompletedSessionSummary = {
  date: ISODate;
  volume_lbs: number;
  sets: number;
  rpe_avg: number;
};

// Structured explanation used on the Why screen.
export type WhyExplanation = {
  bullets: string[];
  progression_signal: string;
  volume_adjustment: string;
  fatigue_management: string;
  disclaimer: string;
};

// Feedback tied to a specific plan version id and date.
export type PlanFeedback = {
  planId: string;
  date: ISODate;
  rating: "up" | "down";
  note?: string;
  createdAt: string;
};
