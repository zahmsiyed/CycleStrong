from fastapi import APIRouter
from app.api.v1.routes import rules

api_router = APIRouter()
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
