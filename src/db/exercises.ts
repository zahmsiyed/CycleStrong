// exercises.ts: Relational exercise database helpers (schema + CRUD + seeding).
import { getDb, initDb } from "./sqlite";
import exercisesCleaned from "../../exercises.cleaned.json";
import type {
  Exercise,
  ExerciseInsert,
  ExerciseCategory,
  MovementPattern,
  Equipment,
} from "../types/exercise";

// Filters used for listing exercises.
type ExerciseFilters = {
  category?: ExerciseCategory;
  movement_pattern?: MovementPattern;
  equipment?: Equipment;
  is_custom?: boolean;
  name?: string;
};

// Generate a lightweight UUID without external dependencies.
function generateId() {
  // This is sufficient for local-only usage; can be replaced with a stronger UUID later.
  return `ex_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Safely parse JSON arrays stored as strings.
function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as string[];
  }
}

// Convert a database row into an Exercise object.
function mapRow(row: any): Exercise {
  const primaryMuscles = parseJsonArray(row.primary_muscles || "[]");
  const secondaryMuscles = parseJsonArray(row.secondary_muscles || "[]");
  const instructions = parseJsonArray(row.instructions || "[]");

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    movement_pattern: row.movement_pattern,
    equipment: row.equipment,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
    instructions,
    is_custom: Boolean(row.is_custom),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Check whether a specific column exists on a table.
async function hasColumn(tableName: string, columnName: string) {
  const db = await getDb();
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return columns.some((column) => column.name === columnName);
}

// Initialize exercise tables and indexes if they do not exist.
export async function initExercisesSchema(): Promise<void> {
  // Ensure the base database is ready before creating new tables.
  await initDb();
  const db = await getDb();
  // Exercises table keeps core metadata and muscle groups as JSON arrays.
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, movement_pattern TEXT NOT NULL, equipment TEXT NOT NULL, primary_muscles TEXT NOT NULL, secondary_muscles TEXT NOT NULL, instructions TEXT NOT NULL, is_custom INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);",
  );
  // Alternatives table supports ranked, many-to-many swaps.
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS exercise_alternatives (exercise_id TEXT NOT NULL, alternative_id TEXT NOT NULL, rank INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (exercise_id, alternative_id));",
  );

  // Migrate older installs by adding new columns safely.
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(exercises);");
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("instructions")) {
    await db.execAsync("ALTER TABLE exercises ADD COLUMN instructions TEXT NOT NULL DEFAULT '[]'; ");
  }

  // Helpful indexes for filtering and fast lookups.
  await db.execAsync("CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);");
  await db.execAsync("CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);");
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_exercises_movement_pattern ON exercises(movement_pattern);",
  );
  await db.execAsync("CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);");
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_exercise_alternatives_exercise ON exercise_alternatives(exercise_id);",
  );
}

// Seed built-in exercises once (keeps custom exercises intact).
export async function seedBuiltInExercisesIfEmpty(): Promise<void> {
  await initExercisesSchema();
  const db = await getDb();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM exercises WHERE is_custom = 0;",
  );
  const count = row?.count ?? 0;
  if (count > 0) {
    return;
  }

  // Load the normalized built-ins (already validated) from the cleaned dataset.
  const builtIns = Array.isArray(exercisesCleaned.exercises)
    ? exercisesCleaned.exercises
    : [];

  if (builtIns.length === 0) {
    return;
  }

  const includeDescription = await hasColumn("exercises", "description");

  // Insert built-ins inside a transaction for consistency.
  await db.execAsync("BEGIN;");
  try {
    for (const exercise of builtIns as ExerciseInsert[]) {
      const now = new Date().toISOString();
      const columns = [
        "id",
        "name",
        "category",
        "movement_pattern",
        "equipment",
        "primary_muscles",
        "secondary_muscles",
        "instructions",
        "is_custom",
        "created_at",
        "updated_at",
      ];
      const values: Array<string | number> = [
        exercise.id ?? generateId(),
        exercise.name,
        exercise.category,
        exercise.movement_pattern,
        exercise.equipment,
        JSON.stringify(exercise.primary_muscles ?? []),
        JSON.stringify(exercise.secondary_muscles ?? []),
        JSON.stringify(exercise.instructions ?? []),
        0,
        now,
        now,
      ];

      if (includeDescription) {
        columns.splice(7, 0, "description");
        values.splice(7, 0, "");
      }

      const placeholders = columns.map(() => "?").join(", ");
      await db.runAsync(
        `INSERT INTO exercises (${columns.join(", ")}) VALUES (${placeholders});`,
        values,
      );
    }
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

// List exercises with optional filters and case-insensitive name search.
export async function listExercises(filters: ExerciseFilters = {}): Promise<Exercise[]> {
  await initExercisesSchema();
  const db = await getDb();

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.category) {
    where.push("category = ?");
    params.push(filters.category);
  }
  if (filters.movement_pattern) {
    where.push("movement_pattern = ?");
    params.push(filters.movement_pattern);
  }
  if (filters.equipment) {
    where.push("equipment = ?");
    params.push(filters.equipment);
  }
  if (typeof filters.is_custom === "boolean") {
    where.push("is_custom = ?");
    params.push(filters.is_custom ? 1 : 0);
  }
  if (filters.name) {
    // Case-insensitive search for partial matches.
    where.push("LOWER(name) LIKE ?");
    params.push(`%${filters.name.toLowerCase()}%`);
  }

  const sql = `SELECT * FROM exercises${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY name ASC;`;
  const rows = await db.getAllAsync(sql, params);
  return rows.map(mapRow);
}

// Fetch a map of exercises by id for quick lookup.
export async function listExercisesByIds(ids: string[]): Promise<Record<string, Exercise>> {
  await initExercisesSchema();
  if (!ids.length) {
    return {};
  }
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db.getAllAsync(`SELECT * FROM exercises WHERE id IN (${placeholders});`, ids);
  const map: Record<string, Exercise> = {};
  rows.forEach((row: any) => {
    const exercise = mapRow(row);
    map[exercise.id] = exercise;
  });
  return map;
}

// Fetch a single exercise by id.
export async function getExerciseById(id: string): Promise<Exercise | null> {
  await initExercisesSchema();
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT * FROM exercises WHERE id = ?;", [id]);
  return row ? mapRow(row) : null;
}

// Create a new exercise record.
export async function createExercise(input: ExerciseInsert): Promise<Exercise> {
  await initExercisesSchema();
  const db = await getDb();

  const now = new Date().toISOString();
  const id = input.id ?? generateId();
  const instructions = input.instructions ?? [];
  const includeDescription = await hasColumn("exercises", "description");

  const columns = [
    "id",
    "name",
    "category",
    "movement_pattern",
    "equipment",
    "primary_muscles",
    "secondary_muscles",
    "instructions",
    "is_custom",
    "created_at",
    "updated_at",
  ];
  const values: Array<string | number> = [
    id,
    input.name,
    input.category,
    input.movement_pattern,
    input.equipment,
    JSON.stringify(input.primary_muscles ?? []),
    JSON.stringify(input.secondary_muscles ?? []),
    JSON.stringify(instructions),
    (input.is_custom ?? true) ? 1 : 0,
    input.created_at ?? now,
    input.updated_at ?? now,
  ];

  if (includeDescription) {
    columns.splice(7, 0, "description");
    values.splice(7, 0, "");
  }

  const placeholders = columns.map(() => "?").join(", ");
  await db.runAsync(`INSERT INTO exercises (${columns.join(", ")}) VALUES (${placeholders});`, values);

  const created = await getExerciseById(id);
  if (!created) {
    throw new Error("Failed to create exercise");
  }
  return created;
}

// Update an exercise by id with partial updates.
export async function updateExercise(
  id: string,
  patch: Partial<ExerciseInsert>,
): Promise<Exercise> {
  await initExercisesSchema();
  const db = await getDb();

  const fields: string[] = [];
  const params: Array<string | number> = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    params.push(patch.name);
  }
  if (patch.category !== undefined) {
    fields.push("category = ?");
    params.push(patch.category);
  }
  if (patch.movement_pattern !== undefined) {
    fields.push("movement_pattern = ?");
    params.push(patch.movement_pattern);
  }
  if (patch.equipment !== undefined) {
    fields.push("equipment = ?");
    params.push(patch.equipment);
  }
  if (patch.primary_muscles !== undefined) {
    fields.push("primary_muscles = ?");
    params.push(JSON.stringify(patch.primary_muscles));
  }
  if (patch.secondary_muscles !== undefined) {
    fields.push("secondary_muscles = ?");
    params.push(JSON.stringify(patch.secondary_muscles));
  }
  if (patch.instructions !== undefined) {
    fields.push("instructions = ?");
    params.push(JSON.stringify(patch.instructions));
  }
  if (patch.is_custom !== undefined) {
    fields.push("is_custom = ?");
    params.push(patch.is_custom ? 1 : 0);
  }

  // Always update timestamp to reflect changes.
  fields.push("updated_at = ?");
  params.push(new Date().toISOString());

  if (!fields.length) {
    const existing = await getExerciseById(id);
    if (!existing) {
      throw new Error("Exercise not found");
    }
    return existing;
  }

  params.push(id);
  await db.runAsync(`UPDATE exercises SET ${fields.join(", ")} WHERE id = ?;`, params);

  const updated = await getExerciseById(id);
  if (!updated) {
    throw new Error("Exercise not found after update");
  }
  return updated;
}

// Delete an exercise and its alternative links.
export async function deleteExercise(id: string): Promise<void> {
  await initExercisesSchema();
  const db = await getDb();
  // Remove alternative links pointing to this exercise.
  await db.runAsync("DELETE FROM exercise_alternatives WHERE exercise_id = ? OR alternative_id = ?;", [
    id,
    id,
  ]);
  await db.runAsync("DELETE FROM exercises WHERE id = ?;", [id]);
}

// Replace all alternatives for a given exercise.
export async function setAlternatives(
  exerciseId: string,
  alternatives: Array<{ alternativeId: string; rank?: number }>,
): Promise<void> {
  await initExercisesSchema();
  const db = await getDb();
  // Clear existing alternatives for the exercise.
  await db.runAsync("DELETE FROM exercise_alternatives WHERE exercise_id = ?;", [exerciseId]);

  // Insert ranked alternatives in order.
  for (const [index, alt] of alternatives.entries()) {
    await db.runAsync(
      "INSERT INTO exercise_alternatives (exercise_id, alternative_id, rank) VALUES (?, ?, ?);",
      [exerciseId, alt.alternativeId, alt.rank ?? index],
    );
  }
}

// Fetch alternatives for an exercise, ordered by rank.
export async function getAlternatives(exerciseId: string): Promise<Exercise[]> {
  await initExercisesSchema();
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT e.* FROM exercise_alternatives ea JOIN exercises e ON e.id = ea.alternative_id WHERE ea.exercise_id = ? ORDER BY ea.rank ASC;",
    [exerciseId],
  );
  return rows.map(mapRow);
}
