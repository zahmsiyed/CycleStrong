// sqlite.ts: Minimal SQLite helper for persisting app state as JSON.
import * as SQLite from "expo-sqlite";

// Database name for local-only app data.
const DB_NAME = "cyclestrong.db";
const db = SQLite.openDatabase(DB_NAME);

// Parameter type for SQL queries.
type SqlParams = Array<string | number | null>;

// Execute a SQL statement and resolve the result.
function executeSql(sql: string, params: SqlParams = []) {
  return new Promise<SQLite.SQLResultSet>((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return false;
          },
        );
      },
      (error) => reject(error),
    );
  });
}

// Initialize the key-value table for app state persistence.
async function initDb() {
  await executeSql(
    "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
  );
}

// Read a value from the key-value table.
async function getItem(key: string) {
  await initDb();
  const result = await executeSql("SELECT value FROM kv WHERE key = ?;", [key]);
  const row = result.rows.item(0) as { value?: string } | undefined;
  return row?.value ?? null;
}

// Write a value to the key-value table.
async function setItem(key: string, value: string) {
  await initDb();
  await executeSql("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);", [key, value]);
}

// Persist JSON data for an arbitrary key.
export async function saveJsonByKey(key: string, payload: unknown) {
  await setItem(key, JSON.stringify(payload));
}

// Load JSON data for an arbitrary key (or return a fallback).
export async function loadJsonByKey<T>(key: string, fallback: T) {
  const raw = await getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Persist the entire check-in map as JSON in SQLite.
export async function saveCheckInByDate(payload: Record<string, unknown>) {
  await saveJsonByKey("checkinByDate", payload);
}

// Load the entire check-in map from SQLite (or return empty).
export async function loadCheckInByDate() {
  return loadJsonByKey<Record<string, unknown>>("checkinByDate", {});
}
