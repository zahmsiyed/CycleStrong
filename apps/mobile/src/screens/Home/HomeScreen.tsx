import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { api } from "../../services/api";
import type { RuleRequest, RuleResponse } from "../../types/training";

export function HomeScreen() {
  const [health, setHealth] = useState<string>("Checking backend...");
  const [energy, setEnergy] = useState<string>("3");
  const [phase, setPhase] = useState<RuleRequest["cycle_phase"]>("follicular");
  const [result, setResult] = useState<RuleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health()
      .then((r) => setHealth(r.status))
      .catch(() => setHealth("Backend not reachable (start FastAPI at :8000)"));
  }, []);

  async function runRules() {
    setError(null);
    setResult(null);
    try {
      const req: RuleRequest = {
        cycle_phase: phase,
        energy_level: Number(energy),
        last_workout_success: 0.85,
        in_workout_difficulty: "just_right",
      };
      const res = await api.rules(req);
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>CycleStrong</Text>
      <Text style={{ opacity: 0.8 }}>Backend: {health}</Text>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Rule Engine Test</Text>

        <Text>Cycle phase</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["follicular", "ovulatory", "luteal", "menstrual"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPhase(p)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderRadius: 999,
                opacity: phase === p ? 1 : 0.6,
              }}
            >
              <Text>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Text>Energy level (1–5)</Text>
        <TextInput
          value={energy}
          onChangeText={setEnergy}
          keyboardType="number-pad"
          style={{ borderWidth: 1, borderRadius: 8, padding: 10 }}
        />

        <Pressable
          onPress={runRules}
          style={{ padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" }}
        >
          <Text style={{ fontWeight: "600" }}>Get adjustments</Text>
        </Pressable>

        {error ? <Text style={{ color: "crimson" }}>{error}</Text> : null}

        {result ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            <Text style={{ fontWeight: "700" }}>Adjustment</Text>
            <Text>Load delta: {result.load_delta_pct}%</Text>
            <Text>Set delta: {result.set_delta}</Text>
            <Text>Rep target: {result.rep_target}</Text>
            <Text>Rest seconds: {result.rest_seconds}</Text>
            <Text>Deload: {result.deload ? "yes" : "no"}</Text>
            <Text style={{ opacity: 0.8 }}>Why: {result.explanation}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
