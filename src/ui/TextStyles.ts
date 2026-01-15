// TextStyles.ts: Shared typography styles for consistent UI copy.

// Theme color shape used by text style factory.
type ThemeColors = {
  text: string;
  muted: string;
};

// Build text styles from the active theme colors.
export function createTextStyles(colors: ThemeColors) {
  return {
    titleLarge: {
      fontSize: 32,
      fontWeight: "700" as const,
      color: colors.text,
    },
    title: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.text,
    },
    heading: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      color: colors.text,
    },
    action: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: colors.text,
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      color: colors.muted,
    },
  };
}
