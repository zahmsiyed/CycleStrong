// PreviousScreen.tsx: UI for previous workout summary using AppState.
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";
import { formatSummarySet } from "../utils/format";
import type { WorkoutSession } from "../types/domain";

// Build a quick summary from a completed session.
function summarizeSession(session: WorkoutSession) {
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
    date_label: session.date,
    name: session.title,
    volume_lbs: Math.round(totalVolume),
    rpe_avg: rpeCount ? Number((rpeSum / rpeCount).toFixed(1)) : 0,
  };
}

type PreviousScreenProps = {
  onNavigateToWorkout: () => void;
};

// Previous tab screen showing last workout summary and quick actions.
export function PreviousScreen({ onNavigateToWorkout }: PreviousScreenProps) {
  // Pull the last workout summary and history from global state.
  const { lastWorkout, lastWorkoutIsPlaceholder, selectedDate, workoutHistoryByDate } = useAppState();
  // Local toggle for showing session details.
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const historyCount = Object.keys(workoutHistoryByDate).length;

  // Prefer today's completed session when available.
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaySession = workoutHistoryByDate[todayISO];
  const displaySummary = todaySession ? summarizeSession(todaySession) : lastWorkout;

  // Resolve the completed session for the selected date.
  const session = workoutHistoryByDate[selectedDate];

  // Placeholder label for seeded data.
  const placeholderLabel = lastWorkoutIsPlaceholder ? " (placeholder)" : "";

  if (historyCount === 0) {
    return (
      <ScrollView
        // Empty state when no completed workouts exist yet.
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        <Text style={textStyles.title}>Previous</Text>
        <Card>
          <Text style={textStyles.heading}>No workouts yet</Text>
          <Text style={textStyles.caption}>Start today’s plan to see your history here.</Text>
          <Pressable
            // Navigate to the Workout tab for first-time users.
            onPress={onNavigateToWorkout}
            style={{
              marginTop: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={textStyles.body}>Go to Workout</Text>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      // Scrollable container to allow content expansion.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <Text style={textStyles.title}>Previous</Text>

      <Card>
        <Text style={textStyles.heading}>Last workout summary{placeholderLabel}</Text>
        <Text style={textStyles.caption}>Date: {displaySummary?.date_label ?? "—"}</Text>
        <Text style={textStyles.caption}>Name: {displaySummary?.name ?? "—"}</Text>
        <Text style={textStyles.caption}>
          Volume: {displaySummary ? `${displaySummary.volume_lbs} lb` : "—"}
        </Text>
        <Text style={textStyles.caption}>
          Avg RPE: {displaySummary ? displaySummary.rpe_avg : "—"}
        </Text>
      </Card>

      <Pressable
        // Toggle inline session details for the selected date.
        onPress={() => setShowDetails((prev) => !prev)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={textStyles.body}>{showDetails ? "Hide details" : "View details"}</Text>
      </Pressable>

      {showDetails ? (
        <Card>
          <Text style={textStyles.heading}>Completed session</Text>
          {session ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {session.exercises.map((exercise) => (
                <View key={exercise.exerciseId} style={{ gap: spacing.xs }}>
                  <Text style={textStyles.body}>{exercise.name}</Text>
                  {exercise.sets.map((set, index) => (
                    <Text key={`${exercise.exerciseId}-${index}`} style={textStyles.caption}>
                      Set {index + 1}: {formatSummarySet(set.weight, set.reps)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={textStyles.caption}>No completed session for this date.</Text>
          )}
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {(["Repeat", "Start", "Similar"] as const).map((label) => (
          <Pressable
            // Simple action buttons for quick use.
            key={label}
            onPress={() => undefined}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={textStyles.body}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
