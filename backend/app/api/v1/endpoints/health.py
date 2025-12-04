"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health() -> dict[str, str]:
    """Health check endpoint for API v1."""
    return {"status": "healthy", "version": "v1"}
