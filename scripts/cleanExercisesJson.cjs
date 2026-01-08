/* scripts/cleanExercisesJson.cjs
 *
 * Reads ./exercises.json (raw OSS dataset) and writes ./exercises.cleaned.json
 * Applies CycleStrong rules:
 * - Exclude: mobility, stretching, plyometrics, isometrics (except core holds like planks)
 * - Normalize: category, movement_pattern, equipment, muscles
 * - Sanitize: instructions (keep full; remove empty lines; strip simple markup)
 * - Generate stable deterministic ids from name; resolve duplicates with __2, __3...
 *
 * Output shape:
 * { exercises: [ { id, name, category, movement_pattern, equipment,
 *                  primary_muscles, secondary_muscles, instructions,
 *                  is_custom:false } ] }
 */

const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.join(process.cwd(), "exercises.json");
const OUTPUT_PATH = path.join(process.cwd(), "exercises.cleaned.json");

// Allowed enums in our app
const Categories = new Set(["compound", "accessory", "core", "cardio", "other"]);
const MovementPatterns = new Set(["push", "pull", "squat", "hinge", "core", "cardio"]);
const Equipments = new Set(["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"]);

// Exclusion: category and name tokens
const EXCLUDED_CATEGORIES = new Set(["mobility", "stretching", "plyometrics"]);
const EXCLUDED_NAME_SUBSTRINGS = [
  "stretch",
  "mobility",
  "jump",
  "hop",
  "bound",
  "plyo",
  "throw",
  "slam",
  "skip",
  "foam roll",
  "roller",
  "yoga",
];

// Core muscles (for allowing core isometric holds)
const CORE_MUSCLES = new Set(["abdominals", "obliques"]);

// Helpers
function toSlug(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeToken(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function sanitizeInstructionLine(line) {
  // Keep full instructions, but remove obvious garbage/empty lines.
  let s = String(line ?? "").trim();
  if (!s) return "";
  // Strip common list-markup leftovers: "li>", "<li>", "</li>", bullets
  s = s.replace(/^li>\s*/i, "");
  s = s.replace(/^<li>\s*/i, "");
  s = s.replace(/<\/li>\s*$/i, "");
  s = s.replace(/^\*\s+/, "");
  s = s.replace(/^\-\s+/, "");
  return s.trim();
}

function mapEquipment(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "other";

  // exact matches we care about
  if (v === "barbell") return "barbell";
  if (v === "dumbbell") return "dumbbell";
  if (v === "cable") return "cable";
  if (v === "machine") return "machine";
  if (v === "body only") return "bodyweight";

  // anything else (bands, kettlebells, medicine ball, etc.)
  return "other";
}

function shouldExcludeByName(name) {
  const n = String(name || "").toLowerCase();
  return EXCLUDED_NAME_SUBSTRINGS.some((sub) => n.includes(sub));
}

function hasAnyCorePrimary(primaryMuscles) {
  const norm = (primaryMuscles || []).map((m) => normalizeToken(m));
  // Accept either "abdominals"/"obliques" OR already-normalized tokens
  return norm.some((m) => CORE_MUSCLES.has(m) || m === "abdominals" || m === "obliques");
}

function mapCategory({ rawCategory, mechanic, primaryMuscles, name }) {
  const c = String(rawCategory || "").trim().toLowerCase();
  const m = String(mechanic || "").trim().toLowerCase();

  // Cardio explicitly
  if (c === "cardio") return "cardio";

  // Core based on muscles or common name cues
  const primaryNorm = (primaryMuscles || []).map((x) => String(x || "").toLowerCase());
  const nameLc = String(name || "").toLowerCase();
  const coreByName =
    nameLc.includes("plank") ||
    nameLc.includes("crunch") ||
    nameLc.includes("pallof") ||
    nameLc.includes("sit-up") ||
    nameLc.includes("sit up") ||
    nameLc.includes("leg raise") ||
    nameLc.includes("knee raise");

  if (
    primaryNorm.includes("abdominals") ||
    primaryNorm.includes("obliques") ||
    coreByName
  ) {
    return "core";
  }

  // Strength mapping by mechanic
  if (m === "compound") return "compound";
  if (m === "isolation") return "accessory";

  // Everything else goes to other (so we don't force-fit)
  return "other";
}

function deriveMovementPattern({ category, force, name, primaryMuscles }) {
  if (category === "cardio") return "cardio";
  if (category === "core") return "core";

  const n = String(name || "").toLowerCase();
  const f = String(force || "").trim().toLowerCase();

  // squat signals
  if (
    n.includes("squat") ||
    n.includes("leg press") ||
    n.includes("hack squat") ||
    n.includes("front squat")
  ) {
    return "squat";
  }

  // hinge signals
  if (
    n.includes("deadlift") ||
    n.includes("romanian deadlift") ||
    n.includes(" rdl") ||
    n.includes("rdl") ||
    n.includes("good morning") ||
    n.includes("hip thrust")
  ) {
    return "hinge";
  }

  // force hint
  if (f === "push") return "push";
  if (f === "pull") return "pull";

  // name heuristics
  if (n.includes("press") || n.includes("bench") || n.includes("dip") || n.includes("push-up") || n.includes("push up") || n.includes("fly")) {
    return "push";
  }
  if (n.includes("row") || n.includes("pulldown") || n.includes("pull-up") || n.includes("pull up") || n.includes("chin-up") || n.includes("chin up") || n.includes("curl") || n.includes("face pull")) {
    return "pull";
  }

  // muscle heuristic fallback
  const primary = (primaryMuscles || []).map((m) => String(m || "").toLowerCase());
  const looksPull =
    primary.includes("lats") ||
    primary.includes("middle back") ||
    primary.includes("upper back") ||
    primary.includes("lower back") ||
    primary.includes("biceps") ||
    primary.includes("forearms");
  return looksPull ? "pull" : "push";
}

function shouldExcludeExercise(ex) {
  const name = ex?.name || "";
  const rawCategory = String(ex?.category || "").trim().toLowerCase();
  const force = String(ex?.force || "").trim().toLowerCase();
  const primaryMuscles = Array.isArray(ex?.primaryMuscles) ? ex.primaryMuscles : [];

  // 1) excluded categories
  if (EXCLUDED_CATEGORIES.has(rawCategory)) return { exclude: true, reason: "category_excluded" };

  // 2) name substrings
  if (shouldExcludeByName(name)) return { exclude: true, reason: "name_excluded" };

  // 3) static/isometric exclusion, except core holds
  if (force === "static" && !hasAnyCorePrimary(primaryMuscles)) {
    return { exclude: true, reason: "static_non_core" };
  }

  // 4) if raw category suggests stretching/mobility and missed above (extra safety)
  if (rawCategory.includes("stretch") || rawCategory.includes("mobil")) {
    return { exclude: true, reason: "category_text_excluded" };
  }

  return { exclude: false, reason: "" };
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Missing ${INPUT_PATH}. Put exercises.json in repo root.`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(INPUT_PATH, "utf8");
  const parsed = JSON.parse(rawText);

  if (!parsed || !Array.isArray(parsed.exercises)) {
    console.error(`Expected exercises.json shape: { "exercises": [ ... ] }`);
    process.exit(1);
  }

  const source = parsed.exercises;

  const slugCounts = new Map(); // slug -> count
  const output = [];

  let excluded = 0;
  let duplicatesResolved = 0;
  const excludedByReason = {};

  for (const ex of source) {
    const { exclude, reason } = shouldExcludeExercise(ex);
    if (exclude) {
      excluded += 1;
      excludedByReason[reason] = (excludedByReason[reason] || 0) + 1;
      continue;
    }

    const name = String(ex?.name || "").trim();
    if (!name) {
      excluded += 1;
      excludedByReason["missing_name"] = (excludedByReason["missing_name"] || 0) + 1;
      continue;
    }

    // Sanitize + keep full instructions (no truncation)
    const rawInstructions = Array.isArray(ex?.instructions) ? ex.instructions : [];
    const instructions = rawInstructions
      .map(sanitizeInstructionLine)
      .filter((s) => s.length > 0);

    // Normalize muscles
    const primary_muscles = (Array.isArray(ex?.primaryMuscles) ? ex.primaryMuscles : [])
      .map(normalizeToken)
      .filter(Boolean);

    const secondary_muscles = (Array.isArray(ex?.secondaryMuscles) ? ex.secondaryMuscles : [])
      .map(normalizeToken)
      .filter(Boolean);

    // Normalize equipment/category/movement pattern
    const equipment = mapEquipment(ex?.equipment);
    const category = mapCategory({
      rawCategory: ex?.category,
      mechanic: ex?.mechanic,
      primaryMuscles: ex?.primaryMuscles,
      name,
    });

    const movement_pattern = deriveMovementPattern({
      category,
      force: ex?.force,
      name,
      primaryMuscles: ex?.primaryMuscles,
    });

    // Validate enums defensively (should always pass)
    const finalCategory = Categories.has(category) ? category : "other";
    const finalEquipment = Equipments.has(equipment) ? equipment : "other";
    const finalPattern = MovementPatterns.has(movement_pattern) ? movement_pattern : "push";

    // Stable ID + duplicates
    const baseSlug = toSlug(name);
    if (!baseSlug) {
      excluded += 1;
      excludedByReason["bad_slug"] = (excludedByReason["bad_slug"] || 0) + 1;
      continue;
    }

    const prevCount = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, prevCount + 1);

    let id = baseSlug;
    if (prevCount > 0) {
      id = `${baseSlug}__${prevCount + 1}`;
      duplicatesResolved += 1;
    }

    output.push({
      id,
      name,
      category: finalCategory,
      movement_pattern: finalPattern,
      equipment: finalEquipment,
      primary_muscles,
      secondary_muscles,
      instructions,     // full sanitized list (no truncation)
      is_custom: false,
    });
  }

  const cleaned = { exercises: output };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleaned, null, 2), "utf8");

  console.log(`Total source: ${source.length}`);
  console.log(`Excluded: ${excluded}`);
  console.log(`Duplicates resolved: ${duplicatesResolved}`);
  console.log(`Normalized output: ${output.length}`);
  // Optional breakdown (helpful if something looks off)
  // console.log("Excluded by reason:", excludedByReason);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();