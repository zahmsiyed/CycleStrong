from app.schemas.rules import RuleRequest, RuleResponse

def adjust(req: RuleRequest) -> RuleResponse:
    # Simple MVP rule set (deterministic + explainable)
    load_delta = 0.0
    set_delta = 0
    rep_target = "5-8"
    rest_seconds = 120
    deload = False
    explanation_bits = []

    # Phase-based defaults
    if req.cycle_phase in ("luteal", "menstrual"):
        rest_seconds = 150
        explanation_bits.append("Later-phase default: slightly more rest.")
    else:
        rest_seconds = 120

    # Energy rules
    if req.energy_level <= 2:
        load_delta -= 5.0
        set_delta -= 1
        explanation_bits.append("Low energy: reduce load and volume.")
    elif req.energy_level >= 4:
        load_delta += 2.5
        explanation_bits.append("High energy: small load increase.")

    # Performance rules
    if req.last_workout_success < 0.7:
        load_delta -= 2.5
        explanation_bits.append("Last session struggled: back off slightly.")

    # In-workout difficulty
    if req.in_workout_difficulty == "too_hard":
        load_delta -= 2.5
        set_delta = min(set_delta, 0) - 1
        explanation_bits.append("Felt too hard: reduce load/sets.")
    elif req.in_workout_difficulty == "too_easy":
        load_delta += 2.5
        explanation_bits.append("Felt too easy: nudge load up.")

    # Simple deload trigger (conservative MVP)
    if req.energy_level <= 2 and req.last_workout_success < 0.7:
        deload = True
        explanation_bits.append("Low energy + poor performance: suggest deload.")

    explanation = " ".join(explanation_bits) or "Baseline adjustment."

    return RuleResponse(
        load_delta_pct=round(load_delta, 2),
        set_delta=set_delta,
        rep_target=rep_target,
        rest_seconds=rest_seconds,
        deload=deload,
        substitution=None,
        explanation=explanation,
    )
