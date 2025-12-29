// Card.tsx: Simple bordered container for section grouping.
import React from "react";
import { View, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme";

// Props for the Card container.
type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

// Reusable card component for consistent section layout.
export function Card({ children, style }: CardProps) {
  return (
    <View
      // Base card styling with optional overrides.
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
