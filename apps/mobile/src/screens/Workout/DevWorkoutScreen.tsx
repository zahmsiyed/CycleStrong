import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { api } from "../../services/api";
import {
  initWorkoutsSchema,
  listWorkouts,
  saveWorkout,
  type WorkoutSummary,
} from "../../db/workouts";
import type { RuleRequest, RuleResponse } from "../../types/training";

type SplitOption = "Upper/Lower" | "Full Body";

const UPPER_LOWER_WORKOUTS = ["Upper A", "Lower A"] as const;
const FULL_BODY_WORKOUTS = ["Full Body A"] as const;

export function DevWorkoutScreen() {
  const [currentDay, setCurrentDay] = useState<number>(4);
  const [cycleLength, setCycleLength] = useState<number>(30);
  const [selectedSplit, setSelectedSplit] = useState<SplitOption>("Upper/Lower");
  const [selectedWorkout, setSelectedWorkout] = useState<string>("Upper A");
  const [exerciseName, setExerciseName] = useState<string>("Back Squat");
  const [cyclePhase, setCyclePhase] = useState<RuleRequest["cycle_phase"]>("follicular");
  const [energyLevel, setEnergyLevel] = useState<string>("3");
  const [difficulty, setDifficulty] =
    useState<RuleRequest["in_workout_difficulty"]>("just_right");
  const [sets, setSets] = useState<Array<{ reps: number; load: number }>>([
    { reps: 5, load: 135 },
    { reps: 5, load: 135 },
    { reps: 5, load: 135 },
  ]);
  const [recommendationText, setRecommendationText] = useState<string>(
    "Based on your cycle day and readiness, reduce load by 5% and add 30s rest.",
  );
  const [adjustments, setAdjustments] = useState<RuleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<WorkoutSummary[]>([]);

  const workoutOptions = useMemo(() => {
    return selectedSplit === "Upper/Lower" ? UPPER_LOWER_WORKOUTS : FULL_BODY_WORKOUTS;
  }, [selectedSplit]);

  useEffect(() => {
    if (!workoutOptions.includes(selectedWorkout as any)) {
      setSelectedWorkout(workoutOptions[0]);
    }
  }, [selectedWorkout, workoutOptions]);

  useEffect(() => {
    let active = true;
    async function initDb() {
      try {
        await initWorkoutsSchema();
        const recent = await listWorkouts(5);
        if (active) {
          setSavedWorkouts(recent);
        }
      } catch (e: any) {
        if (active) {
          setSaveError(e?.message ?? "Failed to initialize database");
        }
      }
    }
    initDb();
    return () => {
      active = false;
    };
  }, []);

  function parseNumber(text: string) {
    const value = Number(text);
    return Number.isNaN(value) ? 0 : value;
  }

  function updateSet(index: number, key: "reps" | "load", value: number) {
    setSets((prev) => prev.map((set, i) => (i === index ? { ...set, [key]: value } : set)));
  }

  function computeLastWorkoutSuccess() {
    const targetReps = 6;
    if (!sets.length) {
      return 0.85;
    }
    const total = sets.reduce((sum, set) => sum + (set.reps >= targetReps ? 1 : 0), 0);
    return total / sets.length;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveStatus(null);
    try {
      await saveWorkout({
        cycle_day: currentDay,
        cycle_length: cycleLength,
        split: selectedSplit,
        workout_name: selectedWorkout,
        exercise_name: exerciseName,
        sets,
        recommendation_text: recommendationText,
      });
      setSaveStatus("Saved!");
      const recent = await listWorkouts(5);
      setSavedWorkouts(recent);
    } catch (e: any) {
      setSaveError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecommendation() {
    setLoading(true);
    setError(null);
    setAdjustments(null);
    try {
      const request: RuleRequest = {
        cycle_phase: cyclePhase,
        energy_level: parseNumber(energyLevel),
        in_workout_difficulty: difficulty,
        last_workout_success: computeLastWorkoutSuccess(),
      };
      const response = await api.rules(request);
      setAdjustments(response);
      const summary = `Load: ${response.load_delta_pct}% | Sets: ${response.set_delta} | Rest: ${response.rest_seconds}s | Deload: ${response.deload ? "yes" : "no"}. Why: ${response.explanation}`;
      setRecommendationText(summary);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Workout (DEV)</Text>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Cycle Day</Text>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>
          {currentDay}/{cycleLength}
        </Text>
        <Text style={{ opacity: 0.7 }}>Alternate example</Text>
        <Text style={{ opacity: 0.7 }}>16/27</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text>Current day</Text>
            <TextInput
              value={String(currentDay)}
              onChangeText={(text) => setCurrentDay(parseNumber(text))}
              keyboardType="number-pad"
              style={{ borderWidth: 1, borderRadius: 8, padding: 10 }}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text>Cycle length</Text>
            <TextInput
              value={String(cycleLength)}
              onChangeText={(text) => setCycleLength(parseNumber(text))}
              keyboardType="number-pad"
              style={{ borderWidth: 1, borderRadius: 8, padding: 10 }}
            />
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Split</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["Upper/Lower", "Full Body"] as const).map((split) => (
            <Pressable
              key={split}
              onPress={() => setSelectedSplit(split)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 999,
                opacity: selectedSplit === split ? 1 : 0.5,
              }}
            >
              <Text>{split}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Cycle phase</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["follicular", "ovulatory", "luteal", "menstrual"] as const).map((phase) => (
            <Pressable
              key={phase}
              onPress={() => setCyclePhase(phase)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 999,
                opacity: cyclePhase === phase ? 1 : 0.5,
              }}
            >
              <Text>{phase}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Energy level (1–5)</Text>
        <TextInput
          value={energyLevel}
          onChangeText={setEnergyLevel}
          keyboardType="number-pad"
          style={{ borderWidth: 1, borderRadius: 8, padding: 10 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>In-workout difficulty</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["too_easy", "just_right", "too_hard"] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setDifficulty(option)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 999,
                opacity: difficulty === option ? 1 : 0.5,
              }}
            >
              <Text>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Workout</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {workoutOptions.map((workout) => (
            <Pressable
              key={workout}
              onPress={() => setSelectedWorkout(workout)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 8,
                opacity: selectedWorkout === workout ? 1 : 0.5,
              }}
            >
              <Text>{workout}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Exercise</Text>
        <TextInput
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="Exercise name"
          style={{ borderWidth: 1, borderRadius: 8, padding: 10 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Sets</Text>
        {sets.map((set, index) => (
          <View
            key={`set-${index}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Text style={{ width: 24 }}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text>Reps</Text>
              <TextInput
                value={String(set.reps)}
                onChangeText={(text) => updateSet(index, "reps", parseNumber(text))}
                keyboardType="number-pad"
                style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text>Load</Text>
              <TextInput
                value={String(set.load)}
                onChangeText={(text) => updateSet(index, "load", parseNumber(text))}
                keyboardType="number-pad"
                style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
              />
            </View>
          </View>
        ))}
      </View>

      {adjustments ? (
        <View style={{ gap: 6, padding: 10, borderWidth: 1, borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>Adjustments</Text>
          <Text>Load delta: {adjustments.load_delta_pct}%</Text>
          <Text>Set delta: {adjustments.set_delta}</Text>
          <Text>Rest seconds: {adjustments.rest_seconds}s</Text>
          <Text>Deload: {adjustments.deload ? "yes" : "no"}</Text>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Recommendation</Text>
        <TextInput
          value={recommendationText}
          onChangeText={setRecommendationText}
          multiline
          placeholder="Recommendation"
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            minHeight: 80,
            textAlignVertical: "top",
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "600" }}>Save (local only)</Text>
        </Pressable>
        <Pressable
          onPress={handleRecommendation}
          disabled={loading}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "600" }}>
            {loading ? "Loading..." : "Get Recommendation"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "crimson" }}>{error}</Text> : null}
      {saveError ? <Text style={{ color: "crimson" }}>{saveError}</Text> : null}
      {saveStatus ? <Text style={{ color: "green" }}>{saveStatus}</Text> : null}

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Recent saves</Text>
        {savedWorkouts.length ? (
          savedWorkouts.map((workout) => (
            <Text key={workout.id}>
              {workout.created_at} — {workout.workout_name}
            </Text>
          ))
        ) : (
          <Text style={{ opacity: 0.6 }}>No saved workouts yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}
