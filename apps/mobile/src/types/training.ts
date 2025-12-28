export type CyclePhase = "follicular" | "ovulatory" | "luteal" | "menstrual";
export type Difficulty = "too_easy" | "just_right" | "too_hard";

export type RuleRequest = {
  cycle_phase: CyclePhase;
  energy_level: number; // 1-5
  last_workout_success: number; // 0-1
  in_workout_difficulty: Difficulty;
};

export type RuleResponse = {
  load_delta_pct: number;   // e.g. +2.5, -5
  set_delta: number;        // e.g. +1, 0, -1
  rep_target: string;       // e.g. "5-8"
  rest_seconds: number;     // e.g. 120
  deload: boolean;
  substitution?: string | null;
  explanation: string;
};
