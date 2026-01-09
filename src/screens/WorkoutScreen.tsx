// WorkoutScreen.tsx: Workout UI with plan view and session logging view.
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput, Modal } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { formatOverviewPrescription } from "../utils/format";
import { useAppState } from "../state/AppState";
import { listExercisesByIds } from "../db/exercises";
import { buildLocalPlan, getPlanVersionId } from "../planner/localPlanner";
import { getTemplateByKey, WORKOUT_TEMPLATES } from "../planner/workoutTemplates";
import { buildWhyExplanation } from "../why/whyGenerator";
import type {
  CheckIn,
  CompletedSessionSummary,
  ExercisePlan,
  ExerciseLog,
  SetLog,
  WorkoutPlan,
  WorkoutSession,
} from "../types/domain";
import type { Exercise } from "../types/exercise";

// Template key union used by the dropdown selector.
type TemplateKey = (typeof WORKOUT_TEMPLATES)[number]["key"];

// Build a summary from a completed session for the Why screen.
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

// Find the most recent completed session for a given date.
function getCompletedSessionForDate(history: Record<string, WorkoutSession>, date: string) {
  const sessions = Object.values(history).filter((session) => session.date === date && session.status === "completed");
  if (!sessions.length) {
    return undefined;
  }
  return sessions.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
}

// Workout tab screen with today summary and exercise placeholders.
export function WorkoutScreen() {
  // Pull planner state and persistence actions from the app context.
  const {
    checkInByDate,
    selectedDate,
    needsRegen,
    hydrated,
    planByDate,
    lastWorkout,
    activeSessionByDate,
    workoutHistoryByDate,
    setPlan,
    setWhy,
    setNeedsRegen,
    startSessionFromPlan,
    updateActiveSession,
    completeSession,
  } = useAppState();

  // Track the currently selected workout template.
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<TemplateKey>("upper");
  // Track template changes so we can regenerate a plan once per selection.
  const [templateChangeRequested, setTemplateChangeRequested] = useState(false);
  // Toggle the template dropdown modal.
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // Store exercise name lookups keyed by exercise id.
  const [exerciseNameById, setExerciseNameById] = useState<Record<string, Exercise>>({});

  // Track which exercise row is expanded for inline editing.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Store a snapshot of the last saved plan to allow cancel.
  const [planSnapshot, setPlanSnapshot] = useState<WorkoutPlan | null>(null);
  // Local draft values for the expanded exercise inputs.
  const [draft, setDraft] = useState<{ sets: string; reps: string; weight: string }>({
    sets: "",
    reps: "",
    weight: "",
  });

  // Build a safe check-in fallback for planner input.
  // Resolve the selected workout template or fall back to the first entry.
  const activeTemplate = useMemo(() => {
    return getTemplateByKey(selectedTemplateKey) ?? WORKOUT_TEMPLATES[0];
  }, [selectedTemplateKey]);

  const todayCheckIn = useMemo<CheckIn>(() => {
    return (
      checkInByDate[selectedDate] ?? {
        date: selectedDate,
        predicted_phase: "unknown",
        symptoms: ["none"],
      }
    );
  }, [checkInByDate, selectedDate]);

  // Generate a plan when missing, when regeneration is requested, or after a template change.
  useEffect(() => {
    // Avoid generation until hydration completes to prevent overwriting persisted data.
    if (!hydrated || !lastWorkout) {
      return;
    }
    const existing = planByDate[selectedDate];
    const planNeedsMigration = Boolean(
      existing?.exercises?.some((exercise: any) => !("exerciseId" in exercise)),
    );
    const shouldGenerate = !existing || needsRegen || templateChangeRequested || planNeedsMigration;
    if (!shouldGenerate) {
      return;
    }
    // Create a new version id only when regeneration or template change is requested.
    const nextId = getPlanVersionId(
      selectedDate,
      existing?.id,
      needsRegen || templateChangeRequested,
    );
    const result = buildLocalPlan({
      checkIn: todayCheckIn,
      lastWorkout,
      planId: nextId,
      template: activeTemplate,
    });
    // Build why from real inputs and persist alongside the plan.
    const completedSession = getCompletedSessionForDate(workoutHistoryByDate, selectedDate);
    const completedSummary = completedSession ? buildCompletedSummary(completedSession) : undefined;
    const why = buildWhyExplanation({
      checkIn: todayCheckIn,
      plan: result.plan,
      lastWorkout,
      completedSessionForDate: completedSummary,
    });
    setPlan(selectedDate, result.plan);
    setWhy(selectedDate, why);
    setNeedsRegen(false);
    setTemplateChangeRequested(false);
  }, [
    hydrated,
    lastWorkout,
    planByDate,
    needsRegen,
    selectedDate,
    todayCheckIn,
    workoutHistoryByDate,
    activeTemplate,
    templateChangeRequested,
    setPlan,
    setWhy,
    setNeedsRegen,
  ]);

  // Resolve the plan to render (if generated yet).
  const plan = planByDate[selectedDate];
  // Resolve the active session for this date (if any).
  const activeSession = activeSessionByDate[selectedDate];

  // Disable template switching while a session is in progress.
  const isTemplateLocked = Boolean(activeSession);
  const templatePicker = (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        // Modal-based dropdown for choosing a workout template.
        onPress={() => setShowTemplatePicker(true)}
        disabled={isTemplateLocked}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 10,
          backgroundColor: isTemplateLocked ? colors.card : "transparent",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Text style={textStyles.title}>Today: {activeTemplate.name}</Text>
          <Text style={{ ...textStyles.title, fontSize: 20 }}>▼</Text>
        </View>
      </Pressable>

      <Modal
        // Modal keeps the dropdown lightweight and dependency-free.
        visible={showTemplatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <Pressable
          // Tap outside to dismiss the picker.
          onPress={() => setShowTemplatePicker(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "center",
            padding: spacing.md,
          }}
        >
          <View
            // Dropdown content container.
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            {WORKOUT_TEMPLATES.map((template) => (
              <Pressable
                // Select template and trigger deterministic regeneration.
                key={template.key}
                onPress={() => {
                  setSelectedTemplateKey(template.key);
                  setTemplateChangeRequested(true);
                  setShowTemplatePicker(false);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: 10,
                }}
              >
                <Text style={textStyles.body}>{template.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );

  // Align the dropdown selection with any persisted plan template key.
  useEffect(() => {
    if (plan?.template_key && plan.template_key !== selectedTemplateKey && !templateChangeRequested) {
      setSelectedTemplateKey(plan.template_key as TemplateKey);
    }
  }, [plan?.template_key, selectedTemplateKey, templateChangeRequested]);

  // Resolve exercise names from SQLite whenever the plan changes.
  useEffect(() => {
    let isMounted = true;
    if (!plan) {
      setExerciseNameById({});
      return () => {
        isMounted = false;
      };
    }
    const ids = plan.exercises.map((exercise) => exercise.exerciseId);
    listExercisesByIds(ids).then((map) => {
      if (isMounted) {
        setExerciseNameById(map);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [plan]);

  // Build a simple id-to-name map for session creation.
  const exerciseLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(exerciseNameById).forEach((exercise) => {
      map[exercise.id] = exercise.name;
    });
    return map;
  }, [exerciseNameById]);

  // Sanitize numeric plan edits to avoid empty or invalid values.
  function sanitizePlanNumber(value: string, fallback: number, min: number) {
    if (!value.trim()) {
      return fallback;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.max(min, parsed);
  }

  // Sanitize numeric session edits, keeping values non-negative.
  function sanitizeSessionNumber(value: string, fallback: number) {
    if (!value.trim()) {
      return fallback;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.max(0, parsed);
  }

  // Format a timestamp for the beta-friendly freshness label.
  function formatTime(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Parse optional RPE values without crashing on empty input.
  function parseOptionalRpe(value: string, fallback?: number) {
    if (!value.trim()) {
      return undefined;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.max(0, parsed);
  }

  // Expand an exercise row and seed the local draft for editing.
  function handleExpand(exercise: ExercisePlan) {
    // Snapshot the current saved plan to allow cancel.
    if (plan) {
      setPlanSnapshot(plan);
    }
    setExpandedId(exercise.exerciseId);
    setDraft({
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weight: String(exercise.weight_lbs),
    });
  }

  // Collapse the editor without changes to local draft.
  function handleCollapse() {
    setExpandedId(null);
  }

  // Update the plan immediately and persist after each edit.
  function updateExerciseField(exerciseId: string, field: "sets" | "reps" | "weight_lbs", value: string) {
    if (!plan) {
      return;
    }
    const nextExercises = plan.exercises.map((exercise) => {
      if (exercise.exerciseId !== exerciseId) {
        return exercise;
      }
      const min = field === "weight_lbs" ? 0 : 1;
      const nextValue = sanitizePlanNumber(value, exercise[field], min);
      return { ...exercise, [field]: nextValue };
    });
    const nextPlan = { ...plan, exercises: nextExercises };
    // Persist immediately for autosave behavior.
    setPlan(selectedDate, nextPlan);
  }

  // Cancel edits by restoring the last saved snapshot.
  function handleCancel() {
    if (planSnapshot) {
      // Restore plan from the saved snapshot.
      setPlan(selectedDate, planSnapshot);
    }
    handleCollapse();
  }

  // Merge regenerated plan with user edits using id first, then index fallback.
  function mergePlans(freshPlan: WorkoutPlan, existingPlan: WorkoutPlan) {
    // Merge strategy: prefer user edits by matching exercise id.
    const mergedExercises = freshPlan.exercises.map((exercise, index) => {
      const byId = existingPlan.exercises.find((item) => item.exerciseId === exercise.exerciseId);
      const byIndex = existingPlan.exercises[index];
      const source = byId ?? byIndex;
      // Preserve user edits for sets/reps/weight when possible.
      if (source) {
        return {
          ...exercise,
          sets: source.sets,
          reps: source.reps,
          weight_lbs: source.weight_lbs,
        };
      }
      return exercise;
    });
    return { ...freshPlan, exercises: mergedExercises };
  }

  // Handler for deterministic regeneration (overwrites plan + why).
  function handleRegenerate() {
    if (!lastWorkout) {
      return;
    }
    // Regenerate creates a new plan version id (edits keep the old id).
    const nextId = getPlanVersionId(selectedDate, plan?.id, true);
    const result = buildLocalPlan({
      checkIn: todayCheckIn,
      lastWorkout,
      planId: nextId,
      template: activeTemplate,
    });
    // Merge regenerated plan with existing edits using id/index fallbacks.
    const merged = plan ? mergePlans(result.plan, plan) : result.plan;
    // Build why from the merged plan to keep context aligned.
    const completedSession = getCompletedSessionForDate(workoutHistoryByDate, selectedDate);
    const completedSummary = completedSession ? buildCompletedSummary(completedSession) : undefined;
    const why = buildWhyExplanation({
      checkIn: todayCheckIn,
      plan: merged,
      lastWorkout,
      completedSessionForDate: completedSummary,
    });
    setPlan(selectedDate, merged);
    setWhy(selectedDate, why);
    setNeedsRegen(false);
  }

  // Update a full session and persist immediately.
  function saveSession(nextSession: WorkoutSession) {
    updateActiveSession(selectedDate, nextSession);
  }

  // Update one exercise in the active session.
  function updateSessionExercise(
    exerciseId: string,
    updater: (exercise: ExerciseLog) => ExerciseLog,
  ) {
    if (!activeSession) {
      return;
    }
    const nextExercises = activeSession.exercises.map((exercise) =>
      exercise.exerciseId === exerciseId ? updater(exercise) : exercise,
    );
    saveSession({ ...activeSession, exercises: nextExercises });
  }

  // Update a set field (reps, weight, or rpe) in the active session.
  function updateSessionSet(
    exerciseId: string,
    setIndex: number,
    field: "reps" | "weight" | "rpe",
    value: string,
  ) {
    updateSessionExercise(exerciseId, (exercise) => {
      const nextSets: SetLog[] = exercise.sets.map((set, index) => {
        if (index !== setIndex) {
          return set;
        }
        if (field === "rpe") {
          return { ...set, rpe: parseOptionalRpe(value, set.rpe) };
        }
        return { ...set, [field]: sanitizeSessionNumber(value, set[field]) };
      });
      return { ...exercise, sets: nextSets };
    });
  }

  // Toggle pain flag on an exercise entry.
  function togglePainFlag(exerciseId: string) {
    updateSessionExercise(exerciseId, (exercise) => ({
      ...exercise,
      painFlag: !exercise.painFlag,
    }));
  }

  // Update the note for an exercise entry.
  function updateExerciseNote(exerciseId: string, note: string) {
    updateSessionExercise(exerciseId, (exercise) => ({
      ...exercise,
      note,
    }));
  }

  // Add a new set, duplicating the last set's reps and weight.
  function handleAddSet(exerciseId: string) {
    updateSessionExercise(exerciseId, (exercise) => {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      const nextSet: SetLog = lastSet
        ? { reps: lastSet.reps, weight: lastSet.weight, rpe: lastSet.rpe }
        : { reps: 0, weight: 0 };
      return { ...exercise, sets: [...exercise.sets, nextSet] };
    });
  }

  if (!hydrated) {
    return (
      <ScrollView
        // Loading state while hydration completes.
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        {templatePicker}
        <Card>
          <Text style={textStyles.heading}>Loading your plan...</Text>
          <Text style={textStyles.caption}>Just a moment while we sync your local data.</Text>
        </Card>
      </ScrollView>
    );
  }

  if (!plan) {
    return (
      <ScrollView
        // Empty state when no plan is available yet.
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        {templatePicker}
        <Card>
          <Text style={textStyles.heading}>No plan yet</Text>
          <Text style={textStyles.caption}>
            Generate today’s plan to start tracking your workout.
          </Text>
          <Pressable
            // Manual trigger for plan generation when needed.
            onPress={() => setNeedsRegen(true)}
            style={{
              marginTop: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={textStyles.body}>Generate plan</Text>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  if (activeSession) {
    return (
      <ScrollView
        // Scrollable container for session logging UI.
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        {templatePicker}

        <Card>
          <Text style={textStyles.heading}>Session in progress</Text>
          <Text style={textStyles.caption}>{activeSession.title}</Text>
        </Card>

        {activeSession.exercises.map((exercise) => (
          <Card key={exercise.exerciseId}>
            <Text style={textStyles.heading}>{exercise.name}</Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable
                // Simple toggle for logging pain signal.
                onPress={() => togglePainFlag(exercise.exerciseId)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: 8,
                  backgroundColor: exercise.painFlag ? colors.card : "transparent",
                }}
              >
                <Text style={textStyles.caption}>
                  Pain: {exercise.painFlag ? "Yes" : "No"}
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <Text style={textStyles.caption}>Notes</Text>
              <TextInput
                // Autosave notes on change.
                value={exercise.note ?? ""}
                onChangeText={(value) => updateExerciseNote(exercise.exerciseId, value)}
                placeholder="Notes"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.sm,
                  borderRadius: 8,
                  minHeight: 60,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {exercise.sets.map((set, index) => (
                <View key={`${exercise.exerciseId}-set-${index}`} style={{ gap: spacing.xs }}>
                  <Text style={textStyles.caption}>Set {index + 1}</Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View
                      // Weight input wrapper with a persistent unit label.
                      style={{ flex: 1, position: "relative" }}
                    >
                      <TextInput
                        // Autosave weight input.
                        value={String(set.weight)}
                        onChangeText={(value) =>
                          updateSessionSet(exercise.exerciseId, index, "weight", value)
                        }
                        keyboardType="number-pad"
                        placeholder="Weight"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: spacing.xs,
                          paddingRight: 36,
                          borderRadius: 8,
                        }}
                      />
                      <Text
                        // Unit label stays visible while typing.
                        style={{
                          ...textStyles.caption,
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          marginTop: -8,
                        }}
                      >
                        lbs
                      </Text>
                    </View>
                    <View
                      // Reps input wrapper with a persistent unit label.
                      style={{ flex: 1, position: "relative" }}
                    >
                      <TextInput
                        // Autosave reps input.
                        value={String(set.reps)}
                        onChangeText={(value) =>
                          updateSessionSet(exercise.exerciseId, index, "reps", value)
                        }
                        keyboardType="number-pad"
                        placeholder="Reps"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: spacing.xs,
                          paddingRight: 36,
                          borderRadius: 8,
                        }}
                      />
                      <Text
                        // Unit label stays visible while typing.
                        style={{
                          ...textStyles.caption,
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          marginTop: -8,
                        }}
                      >
                        reps
                      </Text>
                    </View>
                    <TextInput
                      // Autosave optional RPE input.
                      value={set.rpe === undefined ? "" : String(set.rpe)}
                      onChangeText={(value) =>
                        updateSessionSet(exercise.exerciseId, index, "rpe", value)
                      }
                      keyboardType="number-pad"
                      placeholder="RPE"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: spacing.xs,
                        borderRadius: 8,
                      }}
                    />
                  </View>
                </View>
              ))}

              <Pressable
                // Add a new set with the last set's numbers.
                onPress={() => handleAddSet(exercise.exerciseId)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: spacing.xs,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={textStyles.caption}>+ Add set</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        <Pressable
          // Complete workout button moves session to history.
          onPress={() => completeSession(selectedDate)}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={textStyles.body}>Complete workout</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      // Scrollable container keeps content accessible on small screens.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      {templatePicker}

      <Card>
        <Text style={textStyles.heading}>
          Suggested intensity: {plan.intensity_adjustment_pct}%
        </Text>
        <Text style={textStyles.caption}>
          Reason: {plan.intensity_reason}
        </Text>
      </Card>

      {/* Safety disclaimer for recommendation copy. */}
      <Text style={textStyles.caption}>
        Not medical advice. Adjust based on pain and consult a professional if needed.
      </Text>

      <Card>
        <Text style={textStyles.heading}>Exercises</Text>
        <View style={{ gap: spacing.xs }}>
          {plan.exercises.map((exercise) => {
            const isExpanded = expandedId === exercise.exerciseId;
            const exerciseName = exerciseNameById[exercise.exerciseId]?.name
              ?? `Missing exercise (id: ${exercise.exerciseId})`;
            const subtitle = exercise.isCardio
              ? "15-30 min steady"
              : formatOverviewPrescription(exercise.sets, exercise.reps, exercise.weight_lbs);
            return (
              <View
                // Exercise row with inline edit controls.
                key={exercise.exerciseId}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.sm,
                  borderRadius: 10,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={textStyles.body}>{exerciseName}</Text>
                    <Text style={textStyles.caption}>
                      {subtitle}
                    </Text>
                  </View>
                  <Pressable
                    // Toggle inline editor for this exercise.
                    onPress={() => (isExpanded ? handleCollapse() : handleExpand(exercise))}
                    style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
                  >
                    <Text style={textStyles.caption}>{isExpanded ? "Close" : "Edit"}</Text>
                  </Pressable>
                </View>

                {isExpanded ? (
                  <View style={{ gap: spacing.sm }}>
                    {/* Inline numeric edits with autosave on change. */}
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text style={textStyles.caption}>Sets</Text>
                        <TextInput
                          // Autosave edits for sets.
                          value={draft.sets}
                          onChangeText={(value) => {
                            setDraft((prev) => ({ ...prev, sets: value }));
                            updateExerciseField(exercise.exerciseId, "sets", value);
                          }}
                          keyboardType="number-pad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: spacing.xs,
                            borderRadius: 8,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text style={textStyles.caption}>Reps</Text>
                        <TextInput
                          // Autosave edits for reps.
                          value={draft.reps}
                          onChangeText={(value) => {
                            setDraft((prev) => ({ ...prev, reps: value }));
                            updateExerciseField(exercise.exerciseId, "reps", value);
                          }}
                          keyboardType="number-pad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: spacing.xs,
                            borderRadius: 8,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text style={textStyles.caption}>Weight</Text>
                        <TextInput
                          // Autosave edits for weight.
                          value={draft.weight}
                          onChangeText={(value) => {
                            setDraft((prev) => ({ ...prev, weight: value }));
                            updateExerciseField(exercise.exerciseId, "weight_lbs", value);
                          }}
                          keyboardType="number-pad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: spacing.xs,
                            borderRadius: 8,
                          }}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Pressable
                        // Revert edits back to last saved plan.
                        onPress={handleCancel}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: spacing.xs,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text style={textStyles.caption}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          // Action button for starting the workout and creating a session.
          onPress={() => {
            startSessionFromPlan(selectedDate, plan, exerciseLabelById);
          }}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={textStyles.body}>Start workout</Text>
        </Pressable>
        <Pressable
          // Deterministic regeneration button.
          onPress={handleRegenerate}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={textStyles.body}>Regenerate</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
