// SettingsScreen.tsx: Minimal settings screen with theme toggle and reset control.
import React, { useState } from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { Card } from "../components/Card";
import { spacing } from "../theme";
import { useTheme } from "../theme/ThemeProvider";
import { useAppState } from "../state/AppState";

// Settings screen with a theme selector and a reset action.
export function SettingsScreen({ onDone }: { onDone: () => void }) {
  // Access theme controls and shared styles.
  const { colors, textStyles, mode, setThemeMode } = useTheme();
  // Access the global reset helper and unit preference from app state.
  const { resetLocalData, weightUnit, setWeightUnit } = useAppState();
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
        {/* Theme toggle lives here so the preference feels intentional and explicit. */}
        <Text style={textStyles.heading}>Theme</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          {(["light", "dark"] as const).map((option) => {
            const active = mode === option;
            return (
              <Pressable
                // Theme toggle persists immediately via ThemeProvider.
                key={option}
                onPress={() => setThemeMode(option)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? colors.text : colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  backgroundColor: active ? colors.card : "transparent",
                }}
              >
                <Text
                  style={{
                    ...textStyles.caption,
                    color: active ? colors.text : colors.muted,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {option === "light" ? "Light" : "Dark"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        {/* Weight unit toggle controls display/input conversion without changing storage. */}
        <Text style={textStyles.heading}>Weight units</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          {(["lbs", "kg"] as const).map((unit) => {
            const active = weightUnit === unit;
            return (
              <Pressable
                // Update preferred unit while keeping storage in LBS.
                key={unit}
                onPress={() => setWeightUnit(unit)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? colors.text : colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  backgroundColor: active ? colors.card : "transparent",
                }}
              >
                <Text
                  style={{
                    ...textStyles.caption,
                    color: active ? colors.text : colors.muted,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {unit.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

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
