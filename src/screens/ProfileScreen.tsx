// ProfileScreen.tsx: Read-only profile + workout history overview screen.
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";
import { formatDateLong } from "../utils/date";
import { formatSummarySet } from "../utils/format";
import type { WorkoutSession } from "../types/domain";

// Build a summary from a completed session for list display.
function summarizeSession(session: WorkoutSession) {
  let totalSets = 0;

  // Pick one top set per exercise (highest reps * weight).
  const topSets = session.exercises
    .map((exercise) => {
      const topSet = exercise.sets.reduce((best, set) => {
        const volume = set.reps * set.weight;
        return !best || volume > best.volume ? { reps: set.reps, weight: set.weight, volume } : best;
      }, null as null | { reps: number; weight: number; volume: number });

      if (!topSet) {
        return null;
      }

      return `${exercise.name}: ${formatSummarySet(topSet.weight, topSet.reps)}`;
    })
    .filter((label): label is string => Boolean(label));

  session.exercises.forEach((exercise) => {
    totalSets += exercise.sets.length;
  });

  return {
    date_label: session.date,
    name: session.title,
    total_sets: totalSets,
    total_exercises: session.exercises.length,
    top_sets: topSets,
  };
}

// Profile screen with user header, chart, and full workout history list.
export function ProfileScreen() {
  // Pull completed workout history from global state.
  const { workoutHistoryByDate } = useAppState();
  // Track per-session details toggles locally.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Convert history map to a sorted array (most recent first).
  const sessions = useMemo(() => {
    return Object.values(workoutHistoryByDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [workoutHistoryByDate]);

  // Compute weekly workout counts for a simple bar chart.
  const chartData = useMemo(() => {
    if (sessions.length === 0) {
      return { counts: [], maxCount: 0, labels: [] as string[] };
    }

    // Week bucketing starts at the earliest completed workout date.
    const dates = sessions.map((session) => new Date(`${session.date}T00:00:00`));
    const firstDate = new Date(Math.min(...dates.map((date) => date.getTime())));

    const counts: number[] = [];
    sessions.forEach((session) => {
      const date = new Date(`${session.date}T00:00:00`);
      const diffDays = Math.floor((date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      counts[weekIndex] = (counts[weekIndex] ?? 0) + 1;
    });

    // Fill missing weeks with zeros so labels never skip.
    const maxIndex = counts.length ? counts.length - 1 : 0;
    const filledCounts = Array.from({ length: maxIndex + 1 }, (_, index) => counts[index] ?? 0);

    const maxCount = Math.max(...filledCounts, 0);

    // Use 1-indexed week labels for every bucket.
    const labels = filledCounts.map((_, index) => `W${index + 1}`);

    return { counts: filledCounts, maxCount, labels };
  }, [sessions]);

  // Render a single workout summary card for the list.
  function renderWorkoutItem({ item }: { item: WorkoutSession }) {
    const summary = summarizeSession(item);
    const isExpanded = Boolean(expanded[item.id]);

    return (
      <Card>
        <Text style={textStyles.heading}>{summary.name}</Text>
        <View style={{ gap: 1 }}>
          <Text style={textStyles.caption}>{formatDateLong(summary.date_label)}</Text>
          <Text style={textStyles.caption}>Total exercises: {summary.total_exercises}</Text>
          <Text style={textStyles.caption}>Total sets: {summary.total_sets}</Text>
        </View>
        {summary.top_sets.length ? (
          <View style={{ marginTop: spacing.xs, gap: 1 }}>
            <Text style={textStyles.caption}>Top sets:</Text>
            {summary.top_sets.map((setLabel, index) => (
              <Text key={`${setLabel}-${index}`} style={textStyles.caption}>
                {setLabel}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable
          // Toggle inline details per workout for quick reference.
          onPress={() =>
            setExpanded((prev) => ({
              ...prev,
              [item.id]: !prev[item.id],
            }))
          }
          style={{
            marginTop: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.xs,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={textStyles.action}>{isExpanded ? "Hide details" : "View details"}</Text>
        </Pressable>

        {isExpanded ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {item.exercises.map((exercise) => (
              <View key={exercise.exerciseId} style={{ gap: spacing.xs }}>
                <Text style={textStyles.body}>{exercise.name}</Text>
                {exercise.sets.map((set, index) => {
                  // Only show RPE when a non-zero value was logged.
                  const rpeLabel =
                    typeof set.rpe === "number" && set.rpe > 0 ? ` (RPE ${set.rpe})` : "";
                  return (
                    <Text key={`${exercise.exerciseId}-${index}`} style={textStyles.caption}>
                      Set {index + 1}: {formatSummarySet(set.weight, set.reps)}
                      {rpeLabel}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <FlatList
      // FlatList provides an infinite-scroll foundation without pagination yet.
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={renderWorkoutItem}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          {/* Header row with name and settings button. */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={textStyles.titleLarge}>Zaina</Text>
            <Pressable
              // Placeholder settings button for future use.
              onPress={() => console.log("settings")}
              style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={textStyles.action}>Settings</Text>
            </Pressable>
          </View>

          <Card>
            <Text style={textStyles.heading}>Workout history</Text>
            {chartData.counts.length === 0 ? (
              <Text style={textStyles.caption}>No workouts yet — complete a workout to see trend.</Text>
            ) : (
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View
                    // Y-axis label sits left of the bars, aligned to the chart edge.
                    style={{
                      width: 32,
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: -30,
                      marginLeft: -12,
                    }}
                  >
                    <Text
                      // Rotate label to match standard chart orientation without wrapping.
                      numberOfLines={1}
                      style={{
                        ...textStyles.caption,
                        width: 80,
                        textAlign: "center",
                        transform: [{ rotate: "-90deg" }],
                      }}
                    >
                      Workouts
                    </Text>
                  </View>
                  <View
                    // Plot container keeps labels aligned with the bar area.
                    style={{ flex: 1, alignItems: "stretch" }}
                  >
                    <View
                      // Simple bar chart built with Views (no external libs).
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: spacing.xs,
                        height: 80,
                      }}
                    >
                      {chartData.counts.map((count, index) => {
                        const maxCount = chartData.maxCount || 1;
                        const height = (count / maxCount) * 80;
                        return (
                          <View
                            // Column wrapper keeps count text aligned above each bar.
                            key={`week-${index}`}
                            style={{ width: 20, alignItems: "center" }}
                          >
                            <Text style={textStyles.caption}>{count}</Text>
                            <View
                              // Each bar represents workouts per week bucket.
                              style={{
                                width: 12,
                                height,
                                borderRadius: 6,
                                backgroundColor: colors.text,
                              }}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <View
                      // Nudge tick labels down and align them with each bar.
                      style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs }}
                    >
                      {chartData.labels.map((label, index) => (
                        <Text
                          // Sparse labels to keep the x-axis readable.
                          key={`label-${index}`}
                          numberOfLines={1}
                          style={{
                            ...textStyles.caption,
                            width: 20,
                            textAlign: "center",
                          }}
                        >
                          {label}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
                <View
                  // Center the x-axis label under the full chart block.
                  style={{ alignItems: "center", marginTop: spacing.xs }}
                >
                  <Text style={textStyles.caption}>Week</Text>
                </View>
              </View>
            )}
          </Card>

          <Text style={textStyles.heading}>All workouts</Text>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <Text style={textStyles.caption}>No workouts yet — complete a workout to see your history.</Text>
        </Card>
      }
    />
  );
}
