import type { RuleRequest, RuleResponse } from "../types/training";

// For iOS Simulator, localhost works. For physical device, use your machine's LAN IP.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => http<{ status: string }>("/health"),
  rules: (body: RuleRequest) =>
    http<RuleResponse>("/api/v1/rules/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
