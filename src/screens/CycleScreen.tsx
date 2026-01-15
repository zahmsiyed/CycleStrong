// CycleScreen.tsx: Cycle check-in UI with local persistence via AppState.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, TextInput, Modal, Platform } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";
import { textStyles } from "../ui/TextStyles";
import { useAppState } from "../state/AppState";
import { predictPhaseFromDay } from "../utils/cycle";
import { formatDateFull } from "../utils/date";
import type { CheckIn, CyclePhase, SymptomTag } from "../types/domain";

// Cycle tab screen with real inputs and a check-in save action.
export function CycleScreen() {
  // Pull check-ins and actions from the global state container.
  const {
    checkInByDate,
    selectedDate,
    upsertCheckIn,
    setNeedsRegen,
  } = useAppState();
  // Local draft state to avoid persisting on every keystroke.
  const [draft, setDraft] = useState<CheckIn>({
    date: selectedDate,
    predicted_phase: "unknown",
    symptoms: ["none"],
  });
  // Local toggle for manual phase override controls.
  const [showManualPhase, setShowManualPhase] = useState<boolean>(false);
  // Local UI state for the date picker modal.
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  // Local draft date while the iOS inline picker is open.
  const [pickerDraftDate, setPickerDraftDate] = useState<Date | null>(null);
  // Track if we've already saved this draft to avoid duplicate saves.
  const lastSavedDraftRef = useRef<string>("");

  // Rebuild the draft whenever the selected date or stored data changes.
  useEffect(() => {
    const stored = checkInByDate[selectedDate];
    
    // Find the most recent check-in with cycle details to copy them if current date doesn't have them.
    let cycleDetailsSource: CheckIn | undefined = stored;
    if (!stored || (!stored.last_period_start && !stored.cycle_length && !stored.typical_bleed_days)) {
      // Find the most recent check-in that has cycle details.
      const checkInsWithDetails = Object.values(checkInByDate).filter(
        (checkIn) => checkIn.last_period_start || checkIn.cycle_length || checkIn.typical_bleed_days,
      );
      if (checkInsWithDetails.length > 0) {
        // Sort by date descending and take the most recent.
        cycleDetailsSource = checkInsWithDetails.sort((a, b) => b.date.localeCompare(a.date))[0];
      }
    }
    
    // Merge stored check-in with cycle details from source if needed.
    const mergedCheckIn: CheckIn = stored
      ? {
          ...stored,
          // Copy cycle details from source if current check-in doesn't have them.
          last_period_start: stored.last_period_start ?? cycleDetailsSource?.last_period_start,
          cycle_length: stored.cycle_length ?? cycleDetailsSource?.cycle_length,
          typical_bleed_days: stored.typical_bleed_days ?? cycleDetailsSource?.typical_bleed_days,
        }
      : {
          date: selectedDate,
          predicted_phase: "unknown",
          symptoms: ["none"],
          // Copy cycle details from most recent check-in if available.
          last_period_start: cycleDetailsSource?.last_period_start,
          cycle_length: cycleDetailsSource?.cycle_length,
          typical_bleed_days: cycleDetailsSource?.typical_bleed_days,
        };
    
    setDraft(mergedCheckIn);
    // Reset manual phase controls based on stored data.
    setShowManualPhase(Boolean(stored?.phase_override));
    // Reset saved ref when date changes to allow saving new date's check-in.
    lastSavedDraftRef.current = "";
  }, [checkInByDate, selectedDate]);


  // Clamp numeric inputs to a safe range.
  function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  // Helper for optional numeric inputs without clamping (clamp on blur/save instead).
  function parseOptionalNumber(value: string) {
    if (!value.trim()) {
      return undefined;
    }
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return undefined;
    }
    return numberValue;
  }

  // Helper to parse an ISO date string safely.
  function parseISODate(dateString?: string) {
    if (!dateString) {
      return null;
    }
    const date = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Format an ISO date for display in the row (no Date objects in AppState).
  function formatDateForDisplay(iso?: string) {
    const parsed = parseISODate(iso);
    if (!parsed) {
      return "Select date";
    }
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }

  // Convert a Date object to YYYY-MM-DD for storage.
  function toISODateString(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
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
    return predictPhaseFromDay(predictedDay);
  }, [predictedDay]);

  // Determine which phase to display (manual override wins).
  const activePhase = draft.phase_override ?? predictedPhase ?? "unknown";
  const phaseLabel = draft.phase_override ? "(manual)" : "(predicted)";

  // Auto-save check-in whenever draft changes (debounced to avoid excessive saves).
  const autoSaveCheckIn = useCallback(async () => {
    const draftKey = JSON.stringify({
      date: selectedDate,
      symptoms: draft.symptoms,
      phase_override: draft.phase_override,
      last_period_start: draft.last_period_start,
      cycle_length: draft.cycle_length,
      typical_bleed_days: draft.typical_bleed_days,
    });
    
    // Skip if we've already saved this exact state.
    if (draftKey === lastSavedDraftRef.current) {
      return;
    }
    
    lastSavedDraftRef.current = draftKey;
    
    // Persist predicted values into the stored check-in.
    const clampedCycleLength =
      draft.cycle_length !== undefined ? clampNumber(draft.cycle_length, 20, 40) : undefined;
    const clampedBleedDays =
      draft.typical_bleed_days !== undefined
        ? clampNumber(draft.typical_bleed_days, 2, 10)
        : undefined;
    const payload: CheckIn = {
      ...draft,
      date: selectedDate,
      cycle_length: clampedCycleLength,
      typical_bleed_days: clampedBleedDays,
      cycle_day: predictedDay ?? undefined,
      predicted_phase: predictedPhase ?? "unknown",
    };
    await upsertCheckIn(payload);
    // Trigger workout plan regeneration when check-in data changes.
    setNeedsRegen(true);
  }, [draft, selectedDate, predictedDay, predictedPhase, upsertCheckIn, setNeedsRegen]);

  // Auto-save when draft changes (debounced).
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoSaveCheckIn();
    }, 500); // 500ms debounce to avoid saving on every keystroke
    
    return () => clearTimeout(timeoutId);
  }, [autoSaveCheckIn]);

  // Toggle a symptom chip and enforce the "none" rule.
  function toggleSymptom(symptom: SymptomTag) {
    setDraft((prev) => {
      const current = prev.symptoms ?? [];
      // "none" is mutually exclusive with all other symptoms.
      if (symptom === "none") {
        return { ...prev, symptoms: ["none"] };
      }
      const withoutNone = current.filter((item) => item !== "none");
      const isSelected = withoutNone.includes(symptom);
      const next = isSelected
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

  // Handle phase override selection with immediate save.
  function handlePhaseOverride(phase: CyclePhase) {
    setDraft((prev) => ({ ...prev, phase_override: phase }));
  }

  // Open the date picker modal and seed the draft date.
  function openDatePicker() {
    // We keep Date objects local to the picker UI only.
    const parsed = parseISODate(draft.last_period_start);
    setPickerDraftDate(parsed ?? new Date());
    setShowDatePicker(true);
  }

  // Close the date picker without persisting changes.
  function closeDatePicker() {
    setShowDatePicker(false);
  }

  // Commit the currently selected picker date to the draft state (auto-saves).
  function commitDatePickerSelection(date: Date | null) {
    if (!date) {
      return;
    }
    // Prevent future dates because cycle calculations assume a past start.
    const safeDate = date > new Date() ? new Date() : date;
    setDraft((prev) => ({
      ...prev,
      last_period_start: toISODateString(safeDate),
    }));
    // Reset saved ref to allow immediate save of date change.
    lastSavedDraftRef.current = "";
  }

  // Handle picker changes per-platform for a safe modal UX.
  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      // Android returns "dismissed" when canceling the native dialog.
      if (event.type === "dismissed") {
        setShowDatePicker(false);
        return;
      }
      commitDatePickerSelection(selected ?? null);
      setShowDatePicker(false);
      return;
    }
    // iOS inline picker keeps the modal open; update draft only.
    if (selected) {
      setPickerDraftDate(selected);
    }
  }


  const hasCycleDetails = Boolean(
    draft.last_period_start || draft.cycle_length || draft.typical_bleed_days,
  );

  return (
    <ScrollView
      // Scrollable container to keep layout flexible.
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <Text style={textStyles.titleLarge}>{formatDateFull(selectedDate)}</Text>

      <Card>
        {/* Cycle day and phase display block. */}
        <Text style={textStyles.heading}>
          Day {predictedDay ?? "—"} of {draft.cycle_length ?? "—"} • Phase: {activePhase} {phaseLabel}
        </Text>
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
                onPress={() => handlePhaseOverride(phase)}
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
            <Text style={textStyles.caption}>Last period start</Text>
            <Pressable
              // Pressable row opens a small modal calendar picker.
              onPress={openDatePicker}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.sm,
                borderRadius: 10,
              }}
            >
              <Text style={textStyles.body}>{formatDateForDisplay(draft.last_period_start)}</Text>
            </Pressable>
            {lastPeriodError ? (
              <Text style={{ color: "#B00020", fontSize: 12 }}>{lastPeriodError}</Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={textStyles.caption}>Cycle length</Text>
            <TextInput
              // Numeric input for cycle length (clamp on blur to avoid auto-jumps while typing).
              value={draft.cycle_length?.toString() ?? ""}
              onChangeText={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  cycle_length: parseOptionalNumber(value),
                }))
              }
              onBlur={() =>
                setDraft((prev) => ({
                  ...prev,
                  cycle_length:
                    prev.cycle_length !== undefined
                      ? clampNumber(prev.cycle_length, 20, 40)
                      : undefined,
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
              // Numeric input for typical bleed days (clamp on blur to avoid auto-jumps while typing).
              value={draft.typical_bleed_days?.toString() ?? ""}
              onChangeText={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  typical_bleed_days: parseOptionalNumber(value),
                }))
              }
              onBlur={() =>
                setDraft((prev) => ({
                  ...prev,
                  typical_bleed_days:
                    prev.typical_bleed_days !== undefined
                      ? clampNumber(prev.typical_bleed_days, 2, 10)
                      : undefined,
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
          {([
            { tag: "low_energy" as const, label: "Low energy" },
            { tag: "cramps" as const, label: "Cramps" },
            { tag: "bloating" as const, label: "Bloating" },
            { tag: "headache" as const, label: "Headache" },
            { tag: "none" as const, label: "None" },
          ]).map(({ tag, label }) => {
            const active = draft.symptoms?.includes(tag);
            return (
              <Pressable
                // Chip button for symptom toggles.
                key={tag}
                onPress={() => toggleSymptom(tag)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? colors.text : colors.border,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  backgroundColor: active ? "#E0E0E0" : "transparent",
                }}
              >
                <Text
                  style={{
                    ...textStyles.caption,
                    color: active ? colors.text : colors.muted,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Modal
        // Lightweight modal calendar picker to avoid error-prone text input.
        transparent
        animationType="fade"
        visible={showDatePicker}
        onRequestClose={closeDatePicker}
      >
        <View
          // Simple dim backdrop for a "popup" feel.
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "center",
            padding: spacing.md,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable onPress={closeDatePicker}>
                <Text style={textStyles.caption}>Cancel</Text>
              </Pressable>
              <Pressable
                // iOS requires an explicit "Done" to commit the inline selection.
                onPress={() => {
                  commitDatePickerSelection(pickerDraftDate);
                  closeDatePicker();
                }}
              >
                <Text style={textStyles.caption}>Done</Text>
              </Pressable>
            </View>
            {showDatePicker ? (
              <DateTimePicker
                // Calendar picker: keeps logic local and stores ISO string in state.
                value={pickerDraftDate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "calendar"}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
