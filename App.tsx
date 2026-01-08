// App.tsx: Entry point with in-app tab navigation and global app state.
import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, View } from "react-native";
import { TabBar, type TabItem } from "./src/components/TabBar";
import { CycleScreen } from "./src/screens/CycleScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { WhyScreen } from "./src/screens/WhyScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { colors } from "./src/theme";
import { AppStateProvider, useAppState } from "./src/state/AppState";

// Tab keys used to control which screen is visible.
type TabKey = "cycle" | "workout" | "why" | "profile";

// App shell that handles tab state and screen rendering.
function AppShell() {
  // Local state controls the active tab and visible screen.
  const [activeTab, setActiveTab] = useState<TabKey>("workout");

  // Stable tab list for the TabBar component.
  const tabs = useMemo<TabItem[]>(
    () => [
      { key: "cycle", label: "Cycle" },
      { key: "workout", label: "Workout" },
      { key: "why", label: "Why" },
      { key: "profile", label: "Profile" },
    ],
    [],
  );

  // Render the active screen without navigation libraries.
  function renderScreen() {
    switch (activeTab) {
      case "cycle":
        return <CycleScreen />;
      case "workout":
        return <WorkoutScreen />;
      case "why":
        return <WhyScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <WorkoutScreen />;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>{renderScreen()}</View>
      <TabBar tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />
    </SafeAreaView>
  );
}

// Initializes persisted app state on startup.
function AppInitializer() {
  const { loadPersistedState } = useAppState();

  useEffect(() => {
    // Load SQLite-backed state once when the app mounts.
    loadPersistedState();
  }, [loadPersistedState]);

  return <AppShell />;
}

// Root app wraps everything in the global AppStateProvider.
export default function App() {
  return (
    <AppStateProvider>
      <AppInitializer />
    </AppStateProvider>
  );
}
