from fastapi import APIRouter
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.repositories import router as repos_router
from app.api.v1.pull_requests import router as prs_router
from app.api.v1.findings import router as findings_router
from app.api.v1.auth import router as auth_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.benchmarks import router as benchmarks_router
from app.api.v1.rag import router as rag_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(webhooks_router)
api_v1_router.include_router(repos_router)
api_v1_router.include_router(prs_router)
api_v1_router.include_router(findings_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(benchmarks_router)
api_v1_router.include_router(rag_router)

__all__ = ["api_v1_router"]

