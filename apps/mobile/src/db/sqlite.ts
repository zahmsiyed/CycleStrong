import * as SQLite from "expo-sqlite";

const DB_NAME = "cyclestrong.db";
const db = SQLite.openDatabase(DB_NAME);

type SqlParams = Array<string | number | null>;

export function executeSql(sql: string, params: SqlParams = []) {
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

export async function init() {
  await executeSql(
    `CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      cycle_day INTEGER NOT NULL,
      cycle_length INTEGER NOT NULL,
      split TEXT NOT NULL,
      workout_name TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      sets_json TEXT NOT NULL,
      recommendation_text TEXT NOT NULL
    );`,
  );
}
