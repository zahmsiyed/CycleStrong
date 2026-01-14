// session.ts: Shared utilities for workout session processing.
import type { CompletedSessionSummary, WorkoutSession } from "../types/domain";

// Compute summary stats from a completed session for UI and why context.
export function buildCompletedSummary(session: WorkoutSession): CompletedSessionSummary {
  let totalVolume = 0;
  let totalSets = 0;
  let rpeSum = 0;
  let rpeCount = 0;

  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      totalSets += 1;
      totalVolume += set.reps * set.weight;
      if (typeof set.rpe === "number") {
        rpeSum += set.rpe;
        rpeCount += 1;
      }
    });
  });

  return {
    date: session.date,
    volume_lbs: Math.round(totalVolume),
    sets: totalSets,
    rpe_avg: rpeCount ? Number((rpeSum / rpeCount).toFixed(1)) : 0,
  };
}

// Find the most recent completed session for a given date.
export function getCompletedSessionForDate(
  history: Record<string, WorkoutSession>,
  date: string,
): WorkoutSession | undefined {
  const sessions = Object.values(history).filter(
    (session) => session.date === date && session.status === "completed",
  );
  if (!sessions.length) {
    return undefined;
  }
  return sessions.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
}
