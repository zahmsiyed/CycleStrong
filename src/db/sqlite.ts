// sqlite.ts: Async SQLite helper for Expo SDK 51+ using the new API.
import * as SQLite from "expo-sqlite";

// Database name for local-only app data.
const DB_NAME = "cyclestrong.db";

// Cache the async database open so we avoid reopening per call.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Open the database using the SDK 51 async API (no top-level init).
export async function getDb() {
  if (!dbPromise) {
    // SDK 51+ requires openDatabaseAsync; openDatabase is not available.
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

// Initialize the key-value table for app state persistence.
export async function initDb() {
  const db = await getDb();
  // Enable WAL for better concurrency on mobile.
  await db.execAsync("PRAGMA journal_mode=WAL;");
  // Create a simple key-value table if it does not exist.
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);",
  );
  // Migrate older installs that created kv without updated_at.
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(kv);");
  const hasUpdatedAt = columns.some((column) => column.name === "updated_at");
  if (!hasUpdatedAt) {
    // Default value avoids NOT NULL issues on existing rows.
    await db.execAsync("ALTER TABLE kv ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';");
  }
}

// Read JSON data from the key-value table.
export async function kvGet<T>(key: string): Promise<T | null> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?;", [
    key,
  ]);
  if (!row?.value) {
    return null;
  }
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

// Write JSON data into the key-value table.
export async function kvSet<T>(key: string, value: T): Promise<void> {
  await initDb();
  const db = await getDb();
  // Store JSON with a timestamp to simplify debugging and migrations.
  const updatedAt = new Date().toISOString();
  await db.runAsync("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?);", [
    key,
    JSON.stringify(value),
    updatedAt,
  ]);
}

// Delete a key from the key-value table.
export async function kvDelete(key: string): Promise<void> {
  await initDb();
  const db = await getDb();
  // Remove a stored key for reset or cleanup actions.
  await db.runAsync("DELETE FROM kv WHERE key = ?;", [key]);
}

// Delete a set of keys from the key-value table.
export async function kvClear(keys: string[]): Promise<void> {
  // Sequential deletion keeps the logic simple and consistent.
  for (const key of keys) {
    await kvDelete(key);
  }
}

// Persist JSON data for an arbitrary key.
export async function saveJsonByKey(key: string, payload: unknown) {
  // Serialize JSON explicitly to keep storage consistent.
  await kvSet(key, payload);
}

// Load JSON data for an arbitrary key (or return a fallback).
export async function loadJsonByKey<T>(key: string, fallback: T) {
  const data = await kvGet<T>(key);
  return data ?? fallback;
}

// Persist the entire check-in map as JSON in SQLite.
export async function saveCheckInByDate(payload: Record<string, unknown>) {
  await saveJsonByKey("checkinByDate", payload);
}

// Load the entire check-in map from SQLite (or return empty).
export async function loadCheckInByDate() {
  return loadJsonByKey<Record<string, unknown>>("checkinByDate", {});
}
