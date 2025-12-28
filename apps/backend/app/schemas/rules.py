from pydantic import BaseModel, Field
from typing import Literal, Optional

CyclePhase = Literal["follicular", "ovulatory", "luteal", "menstrual"]
Difficulty = Literal["too_easy", "just_right", "too_hard"]

class RuleRequest(BaseModel):
    cycle_phase: CyclePhase
    energy_level: int = Field(ge=1, le=5)
    last_workout_success: float = Field(ge=0, le=1)
    in_workout_difficulty: Difficulty

class RuleResponse(BaseModel):
    load_delta_pct: float
    set_delta: int
    rep_target: str
    rest_seconds: int
    deload: bool
    substitution: Optional[str] = None
    explanation: str
