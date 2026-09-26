from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from typing import Optional
from app.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Raptor Hackathon Submission & Judging Platform API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# CORS setup for dev and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "project": "Raptor", "environment": settings.ENVIRONMENT}


# Stubs matching .dogfood.toml and 12_api_specification.md for early verification
@app.get("/api/gallery", tags=["Gallery"])
def get_gallery(q: Optional[str] = None, track: Optional[str] = None, page: int = 1, limit: int = 20):
    return {
        "items": [],
        "page": page,
        "limit": limit,
        "total": 0,
    }


@app.post("/api/projects", tags=["Projects"], status_code=status.HTTP_201_CREATED)
def submit_project(payload: dict):
    # Deadline check logic will be implemented here
    return {"status": "received", "data": payload}


@app.get("/api/judge/scores", tags=["Judging"])
def get_judge_scores(judge: Optional[str] = Query(None)):
    # Role isolation logic will be implemented here
    return {"scores": []}


@app.get("/api/export.csv", response_class=PlainTextResponse, tags=["Exports"])
def export_csv():
    # CSV generation header check
    return "project_id,judge_id,criterion,score\n"
