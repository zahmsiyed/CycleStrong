// CycleScreen.tsx: Cycle check-in UI with local persistence via AppState.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";
import type { CheckIn, CyclePhase, SymptomTag } from "../types/domain";

// Cycle tab screen with real inputs and a check-in save action.
export function CycleScreen() {
  // Pull check-ins and actions from the global state container.
  const {
    checkInByDate,
    selectedDate,
    setSelectedDate,
    upsertCheckIn,
    setNeedsRegen,
    resetLocalData,
  } = useAppState();
  // Local draft state to avoid persisting on every keystroke.
  const [draft, setDraft] = useState<CheckIn>({
    date: selectedDate,
    predicted_phase: "unknown",
    symptoms: [],
  });
  // Local toggle for manual phase override controls.
  const [showManualPhase, setShowManualPhase] = useState<boolean>(false);
  // Local confirm toggle for data reset actions.
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  // Beta-safe confirmation copy for successful updates.
  const [showUpdatedNotice, setShowUpdatedNotice] = useState<boolean>(false);
  // Track the timeout so we can clean it up between updates.
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild the draft whenever the selected date or stored data changes.
  useEffect(() => {
    const stored = checkInByDate[selectedDate];
    setDraft(
      stored ?? {
        date: selectedDate,
        predicted_phase: "unknown",
        symptoms: [],
      },
    );
    // Reset manual phase controls based on stored data.
    setShowManualPhase(Boolean(stored?.phase_override));
  }, [checkInByDate, selectedDate]);

  // Clear any pending confirmation timeout on unmount.
  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  // Clamp numeric inputs to a safe range.
  function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  // Helper for optional numeric inputs with clamping.
  function parseClampedNumber(value: string, min: number, max: number) {
    if (!value.trim()) {
      return undefined;
    }
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return undefined;
    }
    return clampNumber(numberValue, min, max);
  }

  // Helper to parse an ISO date string safely.
  function parseISODate(dateString?: string) {
    if (!dateString) {
      return null;
    }
    const date = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Inline validation for last period start input.
  const lastPeriodError = useMemo(() => {
    if (!draft.last_period_start) {
      return null;
    }
    return parseISODate(draft.last_period_start) ? null : "Invalid date";
  }, [draft.last_period_start]);

  // Predict the cycle day based on last period start and cycle length.
  const predictedDay = useMemo(() => {
    const startDate = parseISODate(draft.last_period_start);
    const rawCycleLength = draft.cycle_length;
    if (!startDate || !rawCycleLength || lastPeriodError) {
      return null;
    }
    const cycleLength = clampNumber(rawCycleLength, 20, 40);
    const selected = parseISODate(selectedDate);
    if (!selected) {
      return null;
    }
    const diffMs = selected.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return null;
    }
    // Cycle day is calculated as a modulo over the cycle length.
    return (diffDays % cycleLength) + 1;
  }, [draft.last_period_start, draft.cycle_length, selectedDate, lastPeriodError]);

  // Predict the phase based on the simple MVP day-range heuristic.
  const predictedPhase = useMemo(() => {
    if (!predictedDay) {
      return null;
    }
    // Phase prediction ranges are fixed for MVP.
    if (predictedDay >= 1 && predictedDay <= 5) {
      return "menstrual" as CyclePhase;
    }
    if (predictedDay >= 6 && predictedDay <= 13) {
      return "follicular" as CyclePhase;
    }
    if (predictedDay >= 14 && predictedDay <= 16) {
      return "ovulatory" as CyclePhase;
    }
    return "luteal" as CyclePhase;
  }, [predictedDay]);

  // Determine which phase to display (manual override wins).
  const activePhase = draft.phase_override ?? predictedPhase ?? "unknown";
  const phaseLabel = draft.phase_override ? "(manual)" : "(predicted)";

  // Toggle a symptom chip and enforce the "none" rule.
  function toggleSymptom(symptom: SymptomTag) {
    setDraft((prev) => {
      const current = prev.symptoms ?? [];
      // "none" is mutually exclusive with all other symptoms.
      if (symptom === "none") {
        return { ...prev, symptoms: ["none"] };
      }
      const withoutNone = current.filter((item) => item !== "none");
      const exists = withoutNone.includes(symptom);
      const next = exists
        ? withoutNone.filter((item) => item !== symptom)
        : [...withoutNone, symptom];
      return { ...prev, symptoms: next };
    });
  }

  // Manual phase controls toggle behavior (clear override if disabled).
  function toggleManualPhaseControls() {
    setShowManualPhase((prev) => {
      const next = !prev;
      if (!next) {
        // Clearing override reverts the UI to predicted phase.
        setDraft((current) => ({ ...current, phase_override: undefined }));
      }
      return next;
    });
  }

  // Save the check-in, mark regen as needed.
  async function handleUpdate() {
    // Persist predicted values into the stored check-in for planner use.
    const payload: CheckIn = {
      ...draft,
      date: selectedDate,
      cycle_day: predictedDay ?? undefined,
      predicted_phase: predictedPhase ?? "unknown",
    };
    await upsertCheckIn(payload);
    setNeedsRegen(true);

    // Beta observability affordance: confirm update briefly.
    setShowUpdatedNotice(true);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setShowUpdatedNotice(false);
    }, 2000);
  }

  // Reset local data with a simple confirmation toggle.
  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await resetLocalData();
    setConfirmReset(false);
  }

  const hasCycleDetails = Boolean(
    draft.last_period_start || draft.cycle_length || draft.typical_bleed_days,
  );

  return (
    <ScrollView
      // Scrollable container to keep layout flexible.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <Text style={textStyles.title}>Cycle</Text>

      <Card>
        {/* Cycle day and phase display block. */}
        <Text style={textStyles.heading}>
          Day {predictedDay ?? "—"} of {draft.cycle_length ?? "—"} • Phase: {activePhase} {phaseLabel}
        </Text>
        {/* Selected date control for switching the active check-in date. */}
        <View style={{ gap: spacing.xs }}>
          <Text style={textStyles.caption}>Selected date (YYYY-MM-DD)</Text>
          <TextInput
            // Date input used to change the active check-in date.
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.sm,
              borderRadius: 10,
            }}
          />
        </View>
        <Pressable
          // Toggle manual override controls when the prediction is inaccurate.
          onPress={toggleManualPhaseControls}
          style={{ paddingVertical: spacing.xs }}
        >
          <Text style={textStyles.caption}>Edit if inaccurate</Text>
        </Pressable>
        {showManualPhase ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {(["follicular", "ovulatory", "luteal", "menstrual"] as const).map((phase) => (
              <Pressable
                // Manual phase override buttons.
                key={phase}
                onPress={() => setDraft((prev) => ({ ...prev, phase_override: phase }))}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  backgroundColor: draft.phase_override === phase ? colors.card : "transparent",
                }}
              >
                <Text style={textStyles.caption}>{phase}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        {/* Cycle detail inputs (optional). */}
        <Text style={textStyles.heading}>Cycle details</Text>
        {!hasCycleDetails ? (
          <Text style={textStyles.caption}>
            Optional: add cycle details to improve recommendations.
          </Text>
        ) : null}
        <View style={{ gap: spacing.sm }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={textStyles.caption}>Last period start (YYYY-MM-DD)</Text>
            <TextInput
              // Text input for ISO date.
              value={draft.last_period_start ?? ""}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, last_period_start: value }))}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.sm,
                borderRadius: 10,
              }}
            />
            {lastPeriodError ? (
              <Text style={{ color: "#B00020", fontSize: 12 }}>{lastPeriodError}</Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={textStyles.caption}>Cycle length</Text>
            <TextInput
              // Numeric input for cycle length (clamped to 20-40 days).
              value={draft.cycle_length?.toString() ?? ""}
              onChangeText={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  cycle_length: parseClampedNumber(value, 20, 40),
                }))
              }
              keyboardType="number-pad"
              placeholder="28"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.sm,
                borderRadius: 10,
              }}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={textStyles.caption}>Typical bleed days</Text>
            <TextInput
              // Numeric input for typical bleed days (clamped to 2-10 days).
              value={draft.typical_bleed_days?.toString() ?? ""}
              onChangeText={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  typical_bleed_days: parseClampedNumber(value, 2, 10),
                }))
              }
              keyboardType="number-pad"
              placeholder="5"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.sm,
                borderRadius: 10,
              }}
            />
          </View>
        </View>
      </Card>

      <Card>
        {/* Symptom selection chips (with "none" exclusivity). */}
        <Text style={textStyles.heading}>Symptoms (today)</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {(["low_energy", "cramps", "bloating", "headache", "none"] as const).map(
            (symptom) => {
              const active = draft.symptoms?.includes(symptom);
              return (
                <Pressable
                  // Chip button for symptom toggles.
                  key={symptom}
                  onPress={() => toggleSymptom(symptom)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: 999,
                    backgroundColor: active ? colors.card : "transparent",
                  }}
                >
                  <Text style={textStyles.caption}>{symptom}</Text>
                </Pressable>
              );
            },
          )}
        </View>
      </Card>

      <Pressable
        // Primary action button for saving the check-in and flagging regen.
        onPress={handleUpdate}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={textStyles.body}>Update & regenerate plan</Text>
      </Pressable>

      {showUpdatedNotice ? (
        <Text style={textStyles.caption}>Updated — today’s plan refreshed</Text>
      ) : null}

      <Card>
        {/* Reset local data control for beta support. */}
        <Text style={textStyles.heading}>Reset local data</Text>
        <Text style={textStyles.caption}>
          Clears all local check-ins, plans, workout history, and feedback.
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
