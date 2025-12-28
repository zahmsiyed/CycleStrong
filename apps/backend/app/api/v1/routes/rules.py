from fastapi import APIRouter
from app.schemas.rules import RuleRequest, RuleResponse
from app.services.rule_engine import adjust

router = APIRouter()

@router.post("/adjust", response_model=RuleResponse)
def adjust_training(req: RuleRequest):
    return adjust(req)
