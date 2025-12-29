// TabBar.tsx: Simple bottom tab bar using local state and Pressables.
import React from "react";
import { View, Text, Pressable } from "react-native";
import { colors, radius, spacing } from "../theme";

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
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
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
                color: isActive ? colors.text : colors.muted,
                fontWeight: isActive ? "600" : "400",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
