// WhyScreen.tsx: Explanation UI wired to local planner output and feedback.
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { useAppState } from "../state/AppState";
import type { PlanFeedback } from "../types/domain";

// Why tab screen with explanation placeholders.
export function WhyScreen() {
  // Pull planner state and persistence actions from the app context.
  const {
    selectedDate,
    whyByDate,
    planByDate,
    historyByDate,
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
  const completedSession = historyByDate[selectedDate];

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

  return (
    <ScrollView
      // Scrollable container for longer explanatory content.
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
        Why
      </Text>

      {completedSession ? (
        <Card>
          <Text style={{ fontWeight: "600" }}>You completed this plan</Text>
          <Text style={{ color: colors.muted }}>
            Volume: {completedSession.volume_lbs} lb • Sets: {completedSession.sets} • Avg RPE: {completedSession.rpe_avg}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontWeight: "600" }}>Summary bullets</Text>
        {why ? (
          why.bullets.map((bullet, index) => (
            <Text key={`${index}-${bullet}`} style={{ color: colors.muted }}>
              • {bullet}
            </Text>
          ))
        ) : (
          <Text style={{ color: colors.muted }}>• No explanation yet.</Text>
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Progression signal</Text>
        <Text style={{ color: colors.muted }}>{why?.progression_signal ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Volume adjustment</Text>
        <Text style={{ color: colors.muted }}>{why?.volume_adjustment ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Fatigue management</Text>
        <Text style={{ color: colors.muted }}>{why?.fatigue_management ?? "—"}</Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Was this plan helpful?</Text>
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
            <Text style={{ color: colors.muted }}>👍</Text>
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
            <Text style={{ color: colors.muted }}>👎</Text>
          </Pressable>
        </View>
        {feedbackRating ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.muted }}>Optional note</Text>
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
              <Text style={{ color: colors.muted }}>Save feedback</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {why?.disclaimer ?? "Not medical advice. Consult a healthcare professional for medical concerns."}
      </Text>
    </ScrollView>
  );
}
