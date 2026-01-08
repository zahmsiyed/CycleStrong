// AppState.tsx: Global state container for check-ins, plans, sessions, and regen status.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  kvClear,
  loadCheckInByDate,
  loadJsonByKey,
  saveCheckInByDate,
  saveJsonByKey,
} from "../db/sqlite";
import { ENABLE_DEMO_DATA } from "../config";
import { buildLocalPlan, getPlanVersionId } from "../planner/localPlanner";
import { buildWhyExplanation } from "../why/whyGenerator";
import { initExercisesSchema, seedBuiltInExercisesIfEmpty } from "../db/exercises";
import type {
  CheckIn,
  CompletedSessionSummary,
  ExerciseLog,
  ISODate,
  LastWorkoutSummary,
  PlanFeedback,
  SetLog,
  WhyExplanation,
  WorkoutPlan,
  WorkoutSession,
  WorkoutHistoryByDate,
} from "../types/domain";

// App-level state container shape.
type AppState = {
  checkInByDate: Record<ISODate, CheckIn>;
  selectedDate: ISODate;
  needsRegen: boolean;
  hydrated: boolean;
  lastWorkout: LastWorkoutSummary | null;
  lastWorkoutIsPlaceholder: boolean;
  planByDate: Record<ISODate, WorkoutPlan>;
  whyByDate: Record<ISODate, WhyExplanation>;
  activeSessionByDate: Record<ISODate, WorkoutSession>;
  workoutHistoryByDate: WorkoutHistoryByDate;
  feedbackByPlanId: Record<string, PlanFeedback>;
  setSelectedDate: (date: ISODate) => void;
  upsertCheckIn: (checkIn: CheckIn) => Promise<void>;
  setNeedsRegen: (value: boolean) => void;
  setLastWorkout: (summary: LastWorkoutSummary) => Promise<void>;
  setPlan: (date: ISODate, plan: WorkoutPlan) => Promise<void>;
  setWhy: (date: ISODate, why: WhyExplanation) => Promise<void>;
  startSessionFromPlan: (date: ISODate, plan: WorkoutPlan) => Promise<void>;
  updateActiveSession: (date: ISODate, session: WorkoutSession) => Promise<void>;
  completeSession: (date: ISODate) => Promise<void>;
  getFeedbackForPlan: (planId: string) => PlanFeedback | undefined;
  saveFeedback: (feedback: PlanFeedback) => Promise<void>;
  resetLocalData: () => Promise<void>;
  loadPersistedState: () => Promise<void>;
};

// Context used by screens to read and update app state.
const AppStateContext = createContext<AppState | null>(null);

// Helper to get today's date in YYYY-MM-DD format.
function getTodayISODate(): ISODate {
  // Using toISOString keeps formatting consistent for storage keys.
  return new Date().toISOString().slice(0, 10);
}

// Default last workout summary used to seed the app on first load.
function getDefaultLastWorkout(): LastWorkoutSummary {
  return {
    date_label: "2024-01-08",
    name: "Lower A",
    top_sets: [
      { exercise: "Back Squat", prescription: "3x5 @ 185", note: "solid" },
      { exercise: "Romanian Deadlift", prescription: "3x6 @ 135" },
    ],
    volume_lbs: 12500,
    rpe_avg: 7.5,
    prs: ["Back Squat +5 lb"],
  };
}

// Check whether a summary matches the seeded placeholder.
function isDefaultLastWorkout(summary: LastWorkoutSummary) {
  const seeded = getDefaultLastWorkout();
  return JSON.stringify(summary) === JSON.stringify(seeded);
}

// Build a demo last workout summary for screenshots.
function getDemoLastWorkout(): LastWorkoutSummary {
  return {
    date_label: "2024-02-12",
    name: "Glutes + Hamstrings",
    top_sets: [
      { exercise: "Hip Thrust", prescription: "8 @ 185" },
      { exercise: "Romanian Deadlift", prescription: "6 @ 135" },
      { exercise: "Leg Press", prescription: "10 @ 250" },
    ],
    volume_lbs: 14250,
    rpe_avg: 7.2,
    prs: [],
  };
}

// Build a new workout session from a plan for logging.
function buildSessionFromPlan(date: ISODate, plan: WorkoutPlan): WorkoutSession {
  const now = new Date().toISOString();
  // Pre-create set logs based on planned sets and reps.
  const exercises: ExerciseLog[] = plan.exercises.map((exercise) => {
    const sets: SetLog[] = Array.from({ length: exercise.sets }, () => ({
      reps: exercise.reps,
      weight: exercise.weight,
    }));
    return {
      exerciseId: exercise.id,
      name: exercise.name,
      sets,
    };
  });
  return {
    id: `session_${date}_${plan.id}`,
    date,
    planId: plan.id,
    title: plan.title,
    startedAt: now,
    exercises,
    status: "in_progress",
  };
}

// Compute summary stats from a completed session for UI and why context.
function buildCompletedSummary(session: WorkoutSession): CompletedSessionSummary {
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

// Build a LastWorkoutSummary based on a completed session.
function buildLastWorkoutSummary(session: WorkoutSession): LastWorkoutSummary {
  // Flatten sets so we can pick top sets by volume.
  const allSets: Array<{ exercise: string; reps: number; weight: number; volume: number }> = [];
  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const volume = set.reps * set.weight;
      allSets.push({ exercise: exercise.name, reps: set.reps, weight: set.weight, volume });
    });
  });
  // Sort descending by volume and take the top 3.
  const topSets = allSets
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3)
    .map((set) => ({
      exercise: set.exercise,
      prescription: `${set.reps} @ ${set.weight}`,
    }));

  const summary = buildCompletedSummary(session);

  return {
    date_label: session.date,
    name: session.title,
    top_sets: topSets,
    volume_lbs: summary.volume_lbs,
    rpe_avg: summary.rpe_avg,
    prs: [],
  };
}

// Provider that owns check-in state and persistence.
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // Store all check-ins keyed by ISO date.
  const [checkInByDate, setCheckInByDate] = useState<Record<ISODate, CheckIn>>({});
  // Track the active date used by the Cycle screen.
  const [selectedDate, setSelectedDateState] = useState<ISODate>(getTodayISODate());
  // Flag used to indicate downstream regeneration needs.
  // This is kept in-memory only to avoid stale regeneration on relaunch.
  const [needsRegen, setNeedsRegen] = useState<boolean>(false);
  // Track when hydration is complete to avoid generating before data loads.
  const [hydrated, setHydrated] = useState<boolean>(false);
  // Store the most recent workout summary for planner context.
  const [lastWorkout, setLastWorkoutState] = useState<LastWorkoutSummary | null>(null);
  // Track whether the last workout summary is placeholder data.
  const [lastWorkoutIsPlaceholder, setLastWorkoutIsPlaceholder] = useState<boolean>(false);
  // Store workout plans by date.
  const [planByDate, setPlanByDate] = useState<Record<ISODate, WorkoutPlan>>({});
  // Store why explanations by date.
  const [whyByDate, setWhyByDate] = useState<Record<ISODate, WhyExplanation>>({});
  // Store active workout sessions by date.
  const [activeSessionByDate, setActiveSessionByDate] = useState<Record<ISODate, WorkoutSession>>(
    {},
  );
  // Store completed workout sessions by date.
  const [workoutHistoryByDate, setWorkoutHistoryByDate] = useState<WorkoutHistoryByDate>({});
  // Store feedback by plan version id (planId is the key).
  const [feedbackByPlanId, setFeedbackByPlanId] = useState<Record<string, PlanFeedback>>({});

  // Keep selectedDate stable and valid to avoid undefined date keys.
  const setSelectedDate = useCallback((value: ISODate) => {
    setSelectedDateState((prev) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return getTodayISODate();
      }
      const parsed = new Date(`${trimmed}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return prev;
      }
      return trimmed;
    });
  }, []);

  // Load persisted check-ins, plans, and sessions from SQLite on startup.
  const loadPersistedState = useCallback(async () => {
    try {
      // Initialize the exercise schema and seed built-ins if needed.
      await initExercisesSchema();
      await seedBuiltInExercisesIfEmpty();


      const storedCheckIns = (await loadCheckInByDate()) as Record<ISODate, CheckIn>;
      const storedPlans = await loadJsonByKey<Record<ISODate, WorkoutPlan>>("planByDate", {});
      const storedWhy = await loadJsonByKey<Record<ISODate, WhyExplanation>>("whyByDate", {});
      const storedLastWorkout = await loadJsonByKey<LastWorkoutSummary | null>(
        "lastWorkout",
        null,
      );
      const storedActiveSessions = await loadJsonByKey<Record<ISODate, WorkoutSession>>(
        "activeSessionByDate",
        {},
      );
      const storedHistory = await loadJsonByKey<WorkoutHistoryByDate>("workoutHistoryByDate", {});
      const storedFeedback = await loadJsonByKey<Record<string, PlanFeedback>>(
        "feedbackByPlanId",
        {},
      );
      const demoSeeded = await loadJsonByKey<boolean>("demoSeeded", false);

      setCheckInByDate(storedCheckIns ?? {});
      setPlanByDate(storedPlans ?? {});
      setWhyByDate(storedWhy ?? {});
      setActiveSessionByDate(storedActiveSessions ?? {});
      setWorkoutHistoryByDate(storedHistory ?? {});
      setFeedbackByPlanId(storedFeedback ?? {});

      // Seed demo data once for screenshots when explicitly enabled.
      const hasAnyData =
        Object.keys(storedCheckIns ?? {}).length > 0 ||
        Object.keys(storedPlans ?? {}).length > 0 ||
        Object.keys(storedWhy ?? {}).length > 0 ||
        Object.keys(storedHistory ?? {}).length > 0 ||
        Object.keys(storedActiveSessions ?? {}).length > 0;

      if (ENABLE_DEMO_DATA && !demoSeeded && !hasAnyData) {
        const today = getTodayISODate();
        const demoCheckIn: CheckIn = {
          date: today,
          cycle_day: 12,
          cycle_length: 28,
          predicted_phase: "follicular",
          symptoms: ["none"],
          last_period_start: today,
          typical_bleed_days: 5,
        };
        const demoLastWorkout = getDemoLastWorkout();
        const demoPlanId = getPlanVersionId(today);
        const demoPlan = buildLocalPlan({
          checkIn: demoCheckIn,
          lastWorkout: demoLastWorkout,
          planId: demoPlanId,
        }).plan;
        const demoWhy = buildWhyExplanation({
          checkIn: demoCheckIn,
          plan: demoPlan,
          lastWorkout: demoLastWorkout,
        });

        setCheckInByDate({ [today]: demoCheckIn });
        setPlanByDate({ [today]: demoPlan });
        setWhyByDate({ [today]: demoWhy });
        setLastWorkoutState(demoLastWorkout);
        setLastWorkoutIsPlaceholder(false);

        await saveJsonByKey("checkinByDate", { [today]: demoCheckIn });
        await saveJsonByKey("planByDate", { [today]: demoPlan });
        await saveJsonByKey("whyByDate", { [today]: demoWhy });
        await saveJsonByKey("lastWorkout", demoLastWorkout);
        await saveJsonByKey("demoSeeded", true);
      } else if (storedLastWorkout) {
        // Seed a default last workout summary if none exists.
        setLastWorkoutState(storedLastWorkout);
        // Treat seeded defaults as placeholders when no history exists.
        const hasHistory = Object.keys(storedHistory ?? {}).length > 0;
        setLastWorkoutIsPlaceholder(!hasHistory && isDefaultLastWorkout(storedLastWorkout));
      } else {
        const seeded = getDefaultLastWorkout();
        setLastWorkoutState(seeded);
        setLastWorkoutIsPlaceholder(true);
        await saveJsonByKey("lastWorkout", seeded);
      }
    } finally {
      // Mark hydration complete even if some reads fail.
      setHydrated(true);
    }
  }, []);

  // Insert or update a check-in and persist the full map.
  const upsertCheckIn = useCallback(async (checkIn: CheckIn) => {
    // Use functional updates to keep the callback stable.
    let nextState: Record<ISODate, CheckIn> = {};
    setCheckInByDate((prev) => {
      nextState = { ...prev, [checkIn.date]: checkIn };
      return nextState;
    });
    // Persist after state update to keep async storage consistent.
    await saveCheckInByDate(nextState);
  }, []);

  // Persist the last workout summary and update state.
  const setLastWorkout = useCallback(async (summary: LastWorkoutSummary) => {
    setLastWorkoutState(summary);
    setLastWorkoutIsPlaceholder(false);
    await saveJsonByKey("lastWorkout", summary);
  }, []);

  // Persist the workout plan for a specific date.
  const setPlan = useCallback(async (date: ISODate, plan: WorkoutPlan) => {
    // Use functional updates to keep the callback stable.
    let nextState: Record<ISODate, WorkoutPlan> = {};
    setPlanByDate((prev) => {
      nextState = { ...prev, [date]: plan };
      return nextState;
    });
    // Persist after state update to keep async storage consistent.
    await saveJsonByKey("planByDate", nextState);
  }, []);

  // Persist the why explanation for a specific date.
  const setWhy = useCallback(async (date: ISODate, why: WhyExplanation) => {
    // Use functional updates to keep the callback stable.
    let nextState: Record<ISODate, WhyExplanation> = {};
    setWhyByDate((prev) => {
      nextState = { ...prev, [date]: why };
      return nextState;
    });
    // Persist after state update to keep async storage consistent.
    await saveJsonByKey("whyByDate", nextState);
  }, []);

  // Create and persist a new session derived from a plan.
  const startSessionFromPlan = useCallback(async (date: ISODate, plan: WorkoutPlan) => {
    const session = buildSessionFromPlan(date, plan);
    let nextState: Record<ISODate, WorkoutSession> = {};
    setActiveSessionByDate((prev) => {
      nextState = { ...prev, [date]: session };
      return nextState;
    });
    // Persist the active session map for autosave continuity.
    await saveJsonByKey("activeSessionByDate", nextState);
  }, []);

  // Update an active session and persist immediately.
  const updateActiveSession = useCallback(async (date: ISODate, session: WorkoutSession) => {
    let nextState: Record<ISODate, WorkoutSession> = {};
    setActiveSessionByDate((prev) => {
      nextState = { ...prev, [date]: session };
      return nextState;
    });
    // Persist the active session map on every edit.
    await saveJsonByKey("activeSessionByDate", nextState);
  }, []);

  // Complete a session, move it to history, and update last workout summary.
  const completeSession = useCallback(
    async (date: ISODate) => {
      const currentSession = activeSessionByDate[date];
      if (!currentSession) {
        return;
      }
      const completedSession: WorkoutSession = {
        ...currentSession,
        status: "completed",
        completedAt: new Date().toISOString(),
      };

      let nextActive: Record<ISODate, WorkoutSession> = {};
      let nextHistory: WorkoutHistoryByDate = {};

      setActiveSessionByDate((prev) => {
        nextActive = { ...prev };
        delete nextActive[date];
        return nextActive;
      });
      setWorkoutHistoryByDate((prev) => {
        nextHistory = { ...prev, [date]: completedSession };
        return nextHistory;
      });

      // Persist both maps to keep completed sessions across restarts.
      await saveJsonByKey("activeSessionByDate", nextActive);
      await saveJsonByKey("workoutHistoryByDate", nextHistory);

      // Update last workout summary for the Previous and Why screens.
      const summary = buildLastWorkoutSummary(completedSession);
      await setLastWorkout(summary);
    },
    [activeSessionByDate, setLastWorkout],
  );

  // Retrieve feedback for a given plan version id.
  const getFeedbackForPlan = useCallback(
    (planId: string) => {
      return feedbackByPlanId[planId];
    },
    [feedbackByPlanId],
  );

  // Persist plan feedback keyed by planId for version-specific notes.
  const saveFeedback = useCallback(async (feedback: PlanFeedback) => {
    // Persist feedback by planId to keep versioned notes intact.
    let nextState: Record<string, PlanFeedback> = {};
    setFeedbackByPlanId((prev) => {
      nextState = { ...prev, [feedback.planId]: feedback };
      return nextState;
    });
    // Persist after state update to keep async storage consistent.
    await saveJsonByKey("feedbackByPlanId", nextState);
  }, []);

  // Reset local state and SQLite keys for beta support.
  const resetLocalData = useCallback(async () => {
    const keysToClear = [
      "checkinByDate",
      "planByDate",
      "whyByDate",
      "activeSessionByDate",
      "workoutHistoryByDate",
      "feedbackByPlanId",
      "lastWorkout",
      "demoSeeded",
    ];
    await kvClear(keysToClear);

    const today = getTodayISODate();
    setSelectedDateState(today);
    setCheckInByDate({});
    setPlanByDate({});
    setWhyByDate({});
    setActiveSessionByDate({});
    setWorkoutHistoryByDate({});
    setFeedbackByPlanId({});

    const seeded = getDefaultLastWorkout();
    setLastWorkoutState(seeded);
    setLastWorkoutIsPlaceholder(true);
    await saveJsonByKey("lastWorkout", seeded);

    // Mark regen needed so the next plan is generated cleanly.
    setNeedsRegen(true);
  }, []);

  // Memoize the context value to avoid extra re-renders.
  const value = useMemo<AppState>(
    () => ({
      checkInByDate,
      selectedDate,
      needsRegen,
      hydrated,
      lastWorkout,
      lastWorkoutIsPlaceholder,
      planByDate,
      whyByDate,
      activeSessionByDate,
      workoutHistoryByDate,
      feedbackByPlanId,
      setSelectedDate,
      upsertCheckIn,
      setNeedsRegen,
      setLastWorkout,
      setPlan,
      setWhy,
      startSessionFromPlan,
      updateActiveSession,
      completeSession,
      getFeedbackForPlan,
      saveFeedback,
      resetLocalData,
      loadPersistedState,
    }),
    [
      checkInByDate,
      selectedDate,
      needsRegen,
      hydrated,
      lastWorkout,
      lastWorkoutIsPlaceholder,
      planByDate,
      whyByDate,
      activeSessionByDate,
      workoutHistoryByDate,
      feedbackByPlanId,
      upsertCheckIn,
      getFeedbackForPlan,
      loadPersistedState,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// Hook for accessing the app state context safely.
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
