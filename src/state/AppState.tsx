// AppState.tsx: Global state container for check-ins, plans, and regen status.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { loadCheckInByDate, loadJsonByKey, saveCheckInByDate, saveJsonByKey } from "../db/sqlite";
import type {
  CheckIn,
  CompletedSessionSummary,
  ISODate,
  LastWorkoutSummary,
  PlanFeedback,
  WhyExplanation,
  WorkoutPlan,
} from "../types/domain";

// App-level state container shape.
type AppState = {
  checkInByDate: Record<ISODate, CheckIn>;
  selectedDate: ISODate;
  needsRegen: boolean;
  lastWorkout: LastWorkoutSummary | null;
  planByDate: Record<ISODate, WorkoutPlan>;
  whyByDate: Record<ISODate, WhyExplanation>;
  historyByDate: Record<ISODate, CompletedSessionSummary>;
  feedbackByPlanId: Record<string, PlanFeedback>;
  setSelectedDate: (date: ISODate) => void;
  upsertCheckIn: (checkIn: CheckIn) => Promise<void>;
  setNeedsRegen: (value: boolean) => void;
  setLastWorkout: (summary: LastWorkoutSummary) => Promise<void>;
  setPlan: (date: ISODate, plan: WorkoutPlan) => Promise<void>;
  setWhy: (date: ISODate, why: WhyExplanation) => Promise<void>;
  setHistoryByDate: (history: Record<ISODate, CompletedSessionSummary>) => Promise<void>;
  getFeedbackForPlan: (planId: string) => PlanFeedback | undefined;
  saveFeedback: (feedback: PlanFeedback) => Promise<void>;
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

// Provider that owns check-in state and persistence.
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // Store all check-ins keyed by ISO date.
  const [checkInByDate, setCheckInByDate] = useState<Record<ISODate, CheckIn>>({});
  // Track the active date used by the Cycle screen.
  const [selectedDate, setSelectedDate] = useState<ISODate>(getTodayISODate());
  // Flag used to indicate downstream regeneration needs.
  const [needsRegen, setNeedsRegen] = useState<boolean>(false);
  // Store the most recent workout summary for planner context.
  const [lastWorkout, setLastWorkoutState] = useState<LastWorkoutSummary | null>(null);
  // Store workout plans by date.
  const [planByDate, setPlanByDate] = useState<Record<ISODate, WorkoutPlan>>({});
  // Store why explanations by date.
  const [whyByDate, setWhyByDate] = useState<Record<ISODate, WhyExplanation>>({});
  // Store completed workout summaries by date.
  const [historyByDate, setHistoryByDateState] = useState<Record<ISODate, CompletedSessionSummary>>(
    {},
  );
  // Store feedback by plan version id (planId is the key).
  const [feedbackByPlanId, setFeedbackByPlanId] = useState<Record<string, PlanFeedback>>({});

  // Load persisted check-ins and plans from SQLite on startup.
  const loadPersistedState = useCallback(async () => {
    const storedCheckIns = (await loadCheckInByDate()) as Record<ISODate, CheckIn>;
    const storedPlans = await loadJsonByKey<Record<ISODate, WorkoutPlan>>("planByDate", {});
    const storedWhy = await loadJsonByKey<Record<ISODate, WhyExplanation>>("whyByDate", {});
    const storedLastWorkout = await loadJsonByKey<LastWorkoutSummary | null>("lastWorkout", null);
    const storedHistory = await loadJsonByKey<Record<ISODate, CompletedSessionSummary>>(
      "historyByDate",
      {},
    );
    const storedFeedback = await loadJsonByKey<Record<string, PlanFeedback>>(
      "feedbackByPlanId",
      {},
    );

    setCheckInByDate(storedCheckIns ?? {});
    setPlanByDate(storedPlans ?? {});
    setWhyByDate(storedWhy ?? {});
    setHistoryByDateState(storedHistory ?? {});
    setFeedbackByPlanId(storedFeedback ?? {});

    // Seed a default last workout summary if none exists.
    if (storedLastWorkout) {
      setLastWorkoutState(storedLastWorkout);
    } else {
      const seeded = getDefaultLastWorkout();
      setLastWorkoutState(seeded);
      await saveJsonByKey("lastWorkout", seeded);
    }
  }, []);

  // Insert or update a check-in and persist the full map.
  const upsertCheckIn = useCallback(async (checkIn: CheckIn) => {
    // Use functional updates to keep the callback stable.
    setCheckInByDate((prev) => {
      const next = { ...prev, [checkIn.date]: checkIn };
      saveCheckInByDate(next);
      return next;
    });
  }, []);

  // Persist the last workout summary and update state.
  const setLastWorkout = useCallback(async (summary: LastWorkoutSummary) => {
    setLastWorkoutState(summary);
    await saveJsonByKey("lastWorkout", summary);
  }, []);

  // Persist the workout plan for a specific date.
  const setPlan = useCallback(async (date: ISODate, plan: WorkoutPlan) => {
    // Use functional updates to keep the callback stable.
    setPlanByDate((prev) => {
      const next = { ...prev, [date]: plan };
      saveJsonByKey("planByDate", next);
      return next;
    });
  }, []);

  // Persist the why explanation for a specific date.
  const setWhy = useCallback(async (date: ISODate, why: WhyExplanation) => {
    // Use functional updates to keep the callback stable.
    setWhyByDate((prev) => {
      const next = { ...prev, [date]: why };
      saveJsonByKey("whyByDate", next);
      return next;
    });
  }, []);

  // Persist the completed workout history map.
  const setHistoryByDate = useCallback(
    async (history: Record<ISODate, CompletedSessionSummary>) => {
      setHistoryByDateState(history);
      await saveJsonByKey("historyByDate", history);
    },
    [],
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
    setFeedbackByPlanId((prev) => {
      const next = { ...prev, [feedback.planId]: feedback };
      saveJsonByKey("feedbackByPlanId", next);
      return next;
    });
  }, []);

  // Memoize the context value to avoid extra re-renders.
  const value = useMemo<AppState>(
    () => ({
      checkInByDate,
      selectedDate,
      needsRegen,
      lastWorkout,
      planByDate,
      whyByDate,
      historyByDate,
      feedbackByPlanId,
      setSelectedDate,
      upsertCheckIn,
      setNeedsRegen,
      setLastWorkout,
      setPlan,
      setWhy,
      setHistoryByDate,
      getFeedbackForPlan,
      saveFeedback,
      loadPersistedState,
    }),
    [
      checkInByDate,
      selectedDate,
      needsRegen,
      lastWorkout,
      planByDate,
      whyByDate,
      historyByDate,
      feedbackByPlanId,
      upsertCheckIn,
      setPlan,
      setWhy,
      setLastWorkout,
      setHistoryByDate,
      getFeedbackForPlan,
      saveFeedback,
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
