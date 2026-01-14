// constants.ts: Shared constants used across the planner and explanation system.

// PRD-safe disclaimer used for all recommendation text.
export const RECOMMENDATION_DISCLAIMER =
  "Not medical advice. Adjust based on pain and consult a professional if needed.";

// Volume reduction limit: minimum ratio of sets after reduction (0.8 = 20% max reduction).
export const MIN_VOLUME_RATIO = 0.8;

// Default number of sets used in workout templates (used for volume reduction detection).
export const DEFAULT_SETS = 3;
