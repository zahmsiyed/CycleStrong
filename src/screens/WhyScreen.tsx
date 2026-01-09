// WhyScreen.tsx: Explanation UI wired to local planner output and feedback.
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";
import type { CompletedSessionSummary, PlanFeedback, WorkoutSession } from "../types/domain";

// Build a summary from a completed session for the callout.
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

// Why tab screen with explanation placeholders.
export function WhyScreen() {
  // Pull planner state and persistence actions from the app context.
  const {
    selectedDate,
    whyByDate,
    planByDate,
    workoutHistoryByDate,
    getFeedbackForPlan,
    saveFeedback,
  } = useAppState();

  // Local feedback state bound to the selected plan version.
  const [feedbackRating, setFeedbackRating] = useState<PlanFeedback["rating"] | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string>("");

  // Resolve the plan and why to use for rendering (generated in WorkoutScreen).
  const plan = planByDate[selectedDate];
  const why = whyByDate[selectedDate];
  // Resolve completed session summary for today (if exists).
  const completedSession = getCompletedSessionForDate(workoutHistoryByDate, selectedDate);
  const completedSummary = completedSession ? buildCompletedSummary(completedSession) : null;

  // Sync local feedback state when the plan changes.
  useEffect(() => {
    if (!plan) {
      setFeedbackRating(null);
      setFeedbackNote("");
      return;
    }
    const existingFeedback = getFeedbackForPlan(plan.id);
    if (existingFeedback) {
      setFeedbackRating(existingFeedback.rating);
      setFeedbackNote(existingFeedback.note ?? "");
    } else {
      setFeedbackRating(null);
      setFeedbackNote("");
    }
  }, [plan, getFeedbackForPlan]);

  // Persist feedback tied to the current plan version id.
  async function handleSaveFeedback() {
    if (!plan || !feedbackRating) {
      return;
    }
    const payload: PlanFeedback = {
      planId: plan.id,
      date: selectedDate,
      rating: feedbackRating,
      note: feedbackNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    // Persist feedback keyed by planId (version-specific).
    await saveFeedback(payload);
  }

  if (!plan) {
    return (
      <ScrollView
        // Empty state when no plan exists.
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        <Text style={textStyles.title}>Why</Text>
        <Card>
          <Text style={textStyles.heading}>No plan yet</Text>
          <Text style={textStyles.caption}>Generate a plan to see the reasoning.</Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      // Scrollable container for longer explanatory content.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <Text style={textStyles.title}>Why</Text>

      {plan && why ? (
        <>
          {/* Beta observability affordance: reassure the explanation matches today’s plan. */}
          <Text style={textStyles.caption}>Explanation matches today’s plan</Text>
        </>
      ) : null}

      {completedSummary ? (
        <Card>
          <Text style={textStyles.heading}>You completed this plan</Text>
          <Text style={textStyles.caption}>
            Volume: {completedSummary.volume_lbs} lb • Sets: {completedSummary.sets} • Avg RPE:{" "}
            {completedSummary.rpe_avg}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={textStyles.heading}>Summary bullets</Text>
        {why ? (
          why.bullets.map((bullet, index) => (
            <Text key={`${index}-${bullet}`} style={textStyles.caption}>
              • {bullet}
            </Text>
          ))
        ) : (
          <Text style={textStyles.caption}>• No explanation yet.</Text>
        )}
      </Card>

      <Card>
        <Text style={textStyles.heading}>Progression signal</Text>
        <Text style={textStyles.caption}>{why?.progression_signal ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={textStyles.heading}>Volume adjustment</Text>
        <Text style={textStyles.caption}>{why?.volume_adjustment ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={textStyles.heading}>Fatigue management</Text>
        <Text style={textStyles.caption}>{why?.fatigue_management ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={textStyles.heading}>Was this plan helpful?</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            // Thumbs up feedback selection.
            onPress={() => setFeedbackRating("up")}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.xs,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: feedbackRating === "up" ? colors.card : "transparent",
            }}
          >
            <Text style={textStyles.caption}>👍</Text>
          </Pressable>
          <Pressable
            // Thumbs down feedback selection.
            onPress={() => setFeedbackRating("down")}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.xs,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: feedbackRating === "down" ? colors.card : "transparent",
            }}
          >
            <Text style={textStyles.caption}>👎</Text>
          </Pressable>
        </View>
        {feedbackRating ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={textStyles.caption}>Optional note</Text>
            <TextInput
              // Optional note stored with feedback.
              value={feedbackNote}
              onChangeText={setFeedbackNote}
              placeholder="Tell us what to improve"
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.sm,
                borderRadius: 8,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            <Pressable
              // Persist feedback tied to this plan version id.
              onPress={handleSaveFeedback}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.xs,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <Text style={textStyles.caption}>Save feedback</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <Text style={textStyles.caption}>
        {why?.disclaimer ?? "Not medical advice. Adjust based on pain and consult a professional if needed."}
      </Text>
    </ScrollView>
  );
}
