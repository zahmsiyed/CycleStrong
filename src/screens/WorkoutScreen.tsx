// WorkoutScreen.tsx: Workout UI wired to the local planner output with inline edits.
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { useAppState } from "../state/AppState";
import { buildLocalPlan, getPlanVersionId } from "../planner/localPlanner";
import { buildWhyExplanation } from "../why/whyGenerator";
import type { CheckIn, ExercisePlan, WorkoutPlan } from "../types/domain";

// Workout tab screen with today summary and exercise placeholders.
export function WorkoutScreen() {
  // Pull planner state and persistence actions from the app context.
  const {
    checkInByDate,
    selectedDate,
    needsRegen,
    planByDate,
    lastWorkout,
    historyByDate,
    setPlan,
    setWhy,
    setNeedsRegen,
  } = useAppState();

  // Track which exercise row is expanded for inline editing.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track whether the swap list is open for the expanded exercise.
  const [showAlternatives, setShowAlternatives] = useState<boolean>(false);
  // Store a snapshot of the last saved plan to allow cancel.
  const [planSnapshot, setPlanSnapshot] = useState<WorkoutPlan | null>(null);
  // Local draft values for the expanded exercise inputs.
  const [draft, setDraft] = useState<{ sets: string; reps: string; weight: string }>({
    sets: "",
    reps: "",
    weight: "",
  });

  // Build a safe check-in fallback for planner input.
  const todayCheckIn = useMemo<CheckIn>(() => {
    return (
      checkInByDate[selectedDate] ?? {
        date: selectedDate,
        predicted_phase: "unknown",
        symptoms: ["none"],
      }
    );
  }, [checkInByDate, selectedDate]);

  // Generate a plan when missing or when regeneration is requested.
  useEffect(() => {
    if (!lastWorkout) {
      return;
    }
    const existing = planByDate[selectedDate];
    if (!existing || needsRegen) {
      // Create a new version id only when regeneration is requested.
      const nextId = getPlanVersionId(selectedDate, existing?.id, needsRegen);
      const result = buildLocalPlan({ checkIn: todayCheckIn, lastWorkout, planId: nextId });
      // Build why from real inputs and persist alongside the plan.
      const why = buildWhyExplanation({
        checkIn: todayCheckIn,
        plan: result.plan,
        lastWorkout,
        completedSession: historyByDate[selectedDate],
      });
      setPlan(selectedDate, result.plan);
      setWhy(selectedDate, why);
      setNeedsRegen(false);
    }
  }, [
    lastWorkout,
    planByDate,
    needsRegen,
    selectedDate,
    todayCheckIn,
    historyByDate,
    setPlan,
    setWhy,
    setNeedsRegen,
  ]);

  // Resolve the plan to render (if generated yet).
  const plan = planByDate[selectedDate];

  // Helper to parse numeric input while keeping draft text.
  function parseNumber(value: string, fallback: number) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  // Expand an exercise row and seed the local draft for editing.
  function handleExpand(exercise: ExercisePlan) {
    // Snapshot the current saved plan to allow cancel.
    if (plan) {
      setPlanSnapshot(plan);
    }
    setExpandedId(exercise.id);
    setShowAlternatives(false);
    setDraft({
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weight: String(exercise.weight),
    });
  }

  // Collapse the editor without changes to local draft.
  function handleCollapse() {
    setExpandedId(null);
    setShowAlternatives(false);
  }

  // Update the plan immediately and persist after each edit.
  function updateExerciseField(exerciseId: string, field: "sets" | "reps" | "weight", value: string) {
    if (!plan) {
      return;
    }
    const nextExercises = plan.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) {
        return exercise;
      }
      const nextValue = parseNumber(value, exercise[field]);
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

  // Swap exercise name using an alternative while keeping prescription numbers.
  function handleSwap(exercise: ExercisePlan, nextName: string) {
    if (!plan) {
      return;
    }
    // Keep the exercise id stable; only update name and optional original_name.
    const nextExercises = plan.exercises.map((item) => {
      if (item.id !== exercise.id) {
        return item;
      }
      return {
        ...item,
        name: nextName,
        original_name: item.original_name ?? item.name,
      };
    });
    const nextPlan = { ...plan, exercises: nextExercises };
    // Persist swap immediately to keep state consistent.
    setPlan(selectedDate, nextPlan);
    setShowAlternatives(false);
  }

  // Merge regenerated plan with user edits using id first, then index fallback.
  function mergePlans(freshPlan: WorkoutPlan, existingPlan: WorkoutPlan) {
    // Merge strategy: prefer user edits by matching exercise id.
    const mergedExercises = freshPlan.exercises.map((exercise, index) => {
      const byId = existingPlan.exercises.find((item) => item.id === exercise.id);
      const byIndex = existingPlan.exercises[index];
      const source = byId ?? byIndex;
      // Preserve user edits for sets/reps/weight/name when possible.
      if (source) {
        return {
          ...exercise,
          name: source.name,
          sets: source.sets,
          reps: source.reps,
          weight: source.weight,
          original_name: source.original_name ?? exercise.original_name,
        };
      }
      return exercise;
    });
    return { ...freshPlan, exercises: mergedExercises };
  }

  // Handler for workout actions (placeholder behavior).
  function handleAction(label: string) {
    console.log(`Workout action: ${label}`);
  }

  // Handler for deterministic regeneration (overwrites plan + why).
  function handleRegenerate() {
    if (!lastWorkout) {
      return;
    }
    // Regenerate creates a new plan version id (edits keep the old id).
    const nextId = getPlanVersionId(selectedDate, plan?.id, true);
    const result = buildLocalPlan({ checkIn: todayCheckIn, lastWorkout, planId: nextId });
    // Merge regenerated plan with existing edits using id/index fallbacks.
    const merged = plan ? mergePlans(result.plan, plan) : result.plan;
    // Build why from the merged plan to keep context aligned.
    const why = buildWhyExplanation({
      checkIn: todayCheckIn,
      plan: merged,
      lastWorkout,
      completedSession: historyByDate[selectedDate],
    });
    setPlan(selectedDate, merged);
    setWhy(selectedDate, why);
    setNeedsRegen(false);
    console.log("regenerated merged");
  }

  return (
    <ScrollView
      // Scrollable container keeps content accessible on small screens.
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
        Workout
      </Text>

      <Card>
        <Text style={{ fontWeight: "600" }}>
          Today: {plan ? plan.title : "Glutes + Hamstrings"}
        </Text>
        <Text style={{ color: colors.muted }}>
          {plan ? `${plan.duration_min} min • ${plan.equipment}` : "60 min • Barbell + Machines"}
        </Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>
          Suggested intensity: {plan ? `${plan.intensity_adjustment_pct}%` : "—"}
        </Text>
        <Text style={{ color: colors.muted }}>
          {plan ? `Reason: ${plan.intensity_reason}` : "Reason: —"}
        </Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Exercises</Text>
        <View style={{ gap: spacing.xs }}>
          {plan
            ? plan.exercises.map((exercise) => {
                const isExpanded = expandedId === exercise.id;
                return (
                  <View
                    // Exercise row with inline edit controls.
                    key={exercise.id}
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
                        <Text>{exercise.name}</Text>
                        <Text style={{ color: colors.muted }}>
                          {exercise.sets}x{exercise.reps} @ {exercise.weight}
                        </Text>
                      </View>
                      <Pressable
                        // Toggle inline editor for this exercise.
                        onPress={() => (isExpanded ? handleCollapse() : handleExpand(exercise))}
                        style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
                      >
                        <Text style={{ color: colors.muted }}>{isExpanded ? "Close" : "Edit"}</Text>
                      </Pressable>
                    </View>

                    {isExpanded ? (
                      <View style={{ gap: spacing.sm }}>
                        {/* Inline numeric edits with autosave on change. */}
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <View style={{ flex: 1, gap: spacing.xs }}>
                            <Text style={{ color: colors.muted }}>Sets</Text>
                            <TextInput
                              // Autosave edits for sets.
                              value={draft.sets}
                              onChangeText={(value) => {
                                setDraft((prev) => ({ ...prev, sets: value }));
                                updateExerciseField(exercise.id, "sets", value);
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
                            <Text style={{ color: colors.muted }}>Reps</Text>
                            <TextInput
                              // Autosave edits for reps.
                              value={draft.reps}
                              onChangeText={(value) => {
                                setDraft((prev) => ({ ...prev, reps: value }));
                                updateExerciseField(exercise.id, "reps", value);
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
                            <Text style={{ color: colors.muted }}>Weight</Text>
                            <TextInput
                              // Autosave edits for weight.
                              value={draft.weight}
                              onChangeText={(value) => {
                                setDraft((prev) => ({ ...prev, weight: value }));
                                updateExerciseField(exercise.id, "weight", value);
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
                            <Text style={{ color: colors.muted }}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            // Toggle alternative selection list.
                            onPress={() => setShowAlternatives((prev) => !prev)}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: colors.border,
                              paddingVertical: spacing.xs,
                              borderRadius: 8,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: colors.muted }}>
                              {showAlternatives ? "Hide Swap" : "Swap"}
                            </Text>
                          </Pressable>
                        </View>

                        {showAlternatives && exercise.alternatives?.length ? (
                          <View style={{ gap: spacing.xs }}>
                            {/* Inline alternatives list for swapping exercises. */}
                            {exercise.alternatives.map((alt) => (
                              <Pressable
                                // Replace exercise name while preserving prescription.
                                key={alt}
                                onPress={() => handleSwap(exercise, alt)}
                                style={{
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  paddingVertical: spacing.xs,
                                  paddingHorizontal: spacing.sm,
                                  borderRadius: 8,
                                }}
                              >
                                <Text style={{ color: colors.muted }}>{alt}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : ["Back Squat", "Romanian Deadlift", "Hip Thrust", "Leg Curl", "Calf Raise"].map(
                (name) => (
                  <View
                    // Simple list rows for exercise placeholders.
                    key={name}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: spacing.sm,
                      borderRadius: 10,
                    }}
                  >
                    <Text>{name}</Text>
                    <Text style={{ color: colors.muted }}>3x8 @ 175</Text>
                  </View>
                ),
              )}
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          // Action button for starting the workout (no logging yet).
          onPress={() => handleAction("Start workout")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600" }}>Start workout</Text>
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
          <Text style={{ fontWeight: "600" }}>Regenerate</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
