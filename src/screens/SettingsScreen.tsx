// SettingsScreen.tsx: Minimal settings screen with a reset control for beta support.
import React, { useState } from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";

// Settings screen with a single reset action and a back button.
export function SettingsScreen({ onDone }: { onDone: () => void }) {
  // Access the global reset helper from app state.
  const { resetLocalData } = useAppState();
  // Two-step confirmation to avoid accidental data loss.
  const [confirmReset, setConfirmReset] = useState(false);

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await resetLocalData();
    setConfirmReset(false);
    // Navigate back after reset for a clean beta experience.
    onDone();
  }

  return (
    <ScrollView
      // Keep layout consistent with other screens.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={textStyles.titleLarge}>Settings</Text>
        <Pressable
          // Simple back button to return to Profile.
          onPress={onDone}
          style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
        >
          <Text style={textStyles.action}>Done</Text>
        </Pressable>
      </View>

      <Card>
        {/* Reset local data lives here to avoid cluttering the Cycle check-in UI. */}
        <Text style={textStyles.heading}>Reset local data</Text>
        <Text style={textStyles.caption}>
          Clears all local check-ins, plans, workout history, feedback, and exercises cache.
        </Text>
        <Pressable
          // Confirmation toggle for destructive reset.
          onPress={handleReset}
          style={{
            marginTop: spacing.sm,
            borderWidth: 1,
            borderColor: confirmReset ? "#B00020" : colors.border,
            paddingVertical: spacing.sm,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: confirmReset ? "#FDECEC" : "transparent",
          }}
        >
          <Text style={{ color: confirmReset ? "#B00020" : colors.text }}>
            {confirmReset ? "Are you sure? Tap again to reset" : "Reset local data"}
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
