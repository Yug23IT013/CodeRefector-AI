import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import init_db
from app.api.v1.router import api_v1_router
from app.mcp.server import mcp_server

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("coderefactor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    logger.info("Initializing CodeRefactor AI database...")
    init_db()
    logger.info("Database initialized successfully.")
    yield
    # Shutdown
    logger.info("Shutting down CodeRefactor AI service.")


app = FastAPI(
    title="CodeRefactor AI",
    description="Automated PR Review & Analysis Platform with AST static analysis, Claude AI reviews, and GitHub posting.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for Vite React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 routes
app.include_router(api_v1_router)

# Mount MCP Server-Sent Events (SSE) application for remote AI agents and IDEs
app.mount("/mcp", mcp_server.sse_app())


@app.get("/health", tags=["Health"])
def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": "coderefactor-ai",
        "version": "1.0.0",
        "database": "connected",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to CodeRefactor AI — Automated PR Review & Analysis Platform",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0",
    }
