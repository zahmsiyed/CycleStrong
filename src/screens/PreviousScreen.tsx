// PreviousScreen.tsx: UI for previous workout summary using AppState.
import React from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { useAppState } from "../state/AppState";

// Previous tab screen showing last workout summary and quick actions.
export function PreviousScreen() {
  // Pull the last workout summary from global state.
  const { lastWorkout } = useAppState();

  // Handler for quick action buttons (placeholder behavior).
  function handleAction(label: string) {
    console.log(`Previous action: ${label}`);
  }

  return (
    <ScrollView
      // Scrollable container to allow content expansion.
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
        Previous
      </Text>

      <Card>
        <Text style={{ fontWeight: "600" }}>Last workout summary</Text>
        <Text style={{ color: colors.muted }}>Date: {lastWorkout?.date_label ?? "—"}</Text>
        <Text style={{ color: colors.muted }}>Name: {lastWorkout?.name ?? "—"}</Text>
        <Text style={{ color: colors.muted }}>
          Volume: {lastWorkout ? `${lastWorkout.volume_lbs} lb` : "—"}
        </Text>
        <Text style={{ color: colors.muted }}>
          Avg RPE: {lastWorkout ? lastWorkout.rpe_avg : "—"}
        </Text>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {(["Repeat", "Start", "Similar"] as const).map((label) => (
          <Pressable
            // Simple action buttons for quick use.
            key={label}
            onPress={() => handleAction(label)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
