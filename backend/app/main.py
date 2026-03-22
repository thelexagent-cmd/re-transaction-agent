"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, documents, transactions

app = FastAPI(
    title="Real Estate Transaction Agent API",
    description="Backend API for the Real Estate Transaction Agent — Phase 0.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(documents.router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    """Health check — returns 200 when the API is running."""
    return {"status": "ok"}
