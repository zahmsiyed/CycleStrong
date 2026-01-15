// ThemeProvider.tsx: Global light/dark theme context with persisted preference.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { kvGet, kvSet } from "../db/sqlite";
import { createTextStyles } from "../ui/TextStyles";

// Theme modes supported by the app.
export type ThemeMode = "light" | "dark";

// Theme color tokens shared across UI components.
export type ThemeColors = {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
};

// Light mode palette keeps the current default look.
const lightColors: ThemeColors = {
  background: "#FFFFFF",
  card: "#FAFAFA",
  text: "#111111",
  muted: "#666666",
  border: "#E0E0E0",
  primary: "#111111",
};

// Dark mode palette for low-light viewing.
const darkColors: ThemeColors = {
  background: "#0E0E0E",
  card: "#1A1A1A",
  text: "#F5F5F5",
  muted: "#A0A0A0",
  border: "#2A2A2A",
  primary: "#F5F5F5",
};

// Shape of the theme context value.
type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  textStyles: ReturnType<typeof createTextStyles>;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Theme provider loads and persists the user's preferred mode.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  // Hydrate theme preference from SQLite once at startup.
  useEffect(() => {
    let isMounted = true;
    kvGet<ThemeMode>("themeMode").then((stored) => {
      if (!isMounted) {
        return;
      }
      if (stored === "light" || stored === "dark") {
        setMode(stored);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist theme updates locally to survive restarts.
  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode);
    // Persist without blocking UI updates.
    void kvSet("themeMode", nextMode);
  }, []);

  // Select palette based on current mode.
  const colors = useMemo(() => (mode === "dark" ? darkColors : lightColors), [mode]);
  // Build text styles from the current palette.
  const textStyles = useMemo(() => createTextStyles(colors), [colors]);

  return (
    <ThemeContext.Provider value={{ mode, colors, textStyles, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook for consuming the active theme.
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
