// TabBar.tsx: Simple bottom tab bar using local state and Pressables.
import React from "react";
import { View, Text, Pressable } from "react-native";
import { colors, radius, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";

// Tab definition used by the TabBar component.
export type TabItem = {
  key: string;
  label: string;
};

// Props for TabBar to render tabs and handle changes.
type TabBarProps = {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

// Bottom tab bar with a basic active state style.
export function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  return (
    <View
      // Fixed bottom bar container with light border.
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            // Each tab uses Pressable for simple, local navigation.
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              backgroundColor: isActive ? colors.card : "transparent",
            }}
          >
            <Text
              // Active tab text uses stronger contrast.
              style={{
                ...textStyles.caption,
                color: isActive ? colors.text : colors.muted,
                fontWeight: isActive ? "600" : "400",
              }}
            >
              {tab.label}
            </Text>
            {isActive ? (
              <View
                // Underline indicator for the active tab.
                style={{
                  marginTop: spacing.xs,
                  height: 2,
                  width: 24,
                  borderRadius: 2,
                  backgroundColor: colors.text,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
