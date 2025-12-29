import { executeSql, init } from "./sqlite";

export type WorkoutSet = {
  reps: number;
  load: number;
};

export type WorkoutSavePayload = {
  cycle_day: number;
  cycle_length: number;
  split: string;
  workout_name: string;
  exercise_name: string;
  sets: WorkoutSet[];
  recommendation_text: string;
};

export type WorkoutSummary = {
  id: string;
  created_at: string;
  workout_name: string;
};

function createId() {
  return `workout_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function initWorkoutsSchema() {
  await init();
}

export async function saveWorkout(payload: WorkoutSavePayload) {
  const id = createId();
  const createdAt = new Date().toISOString();
  await executeSql(
    `INSERT INTO workouts (
      id,
      created_at,
      cycle_day,
      cycle_length,
      split,
      workout_name,
      exercise_name,
      sets_json,
      recommendation_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      createdAt,
      payload.cycle_day,
      payload.cycle_length,
      payload.split,
      payload.workout_name,
      payload.exercise_name,
      JSON.stringify(payload.sets),
      payload.recommendation_text,
    ],
  );
  return { id, created_at: createdAt };
}

export async function listWorkouts(limit = 50) {
  const result = await executeSql(
    "SELECT id, created_at, workout_name FROM workouts ORDER BY created_at DESC LIMIT ?;",
    [limit],
  );
  return result.rows._array as WorkoutSummary[];
}
