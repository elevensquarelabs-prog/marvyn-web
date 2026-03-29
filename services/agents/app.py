# -*- coding: utf-8 -*-
"""
Marvyn Agent Service — FastAPI app.

Endpoints:
  POST /chat              — main entry point, routes to specialist agent, streams SSE
  POST /strategy/evaluate — trigger a full strategy evaluation for a user
  GET  /memory/{user_id}  — inspect open recommendations and actions for a user
  GET  /health            — healthcheck

The service runs as a separate Python microservice alongside Next.js.
Next.js calls /chat and streams the SSE response through to the frontend.
"""
import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import router as agent_router
from agents import ads, seo, content, strategy, general

app = FastAPI(title="Marvyn Agent Service", version="1.0.0")


# ── Auth ──────────────────────────────────────────────────────────────────────

def _authorized(request: Request) -> bool:
    token = os.environ.get("AGENT_SERVICE_TOKEN", "").strip()
    if not token:
        return False
    header = request.headers.get("Authorization", "").strip()
    return header == f"Bearer {token}"


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    userId: str
    message: str
    history: list[dict] = []   # last N messages from the frontend session
    sessionId: str | None = None


class StrategyEvalRequest(BaseModel):
    userId: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(req: ChatRequest, request: Request):
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 1. Route: decide domain + model tier
    routing = await agent_router.route(req.message)
    domain = routing["domain"]
    model_tier = routing["model"]

    # Build conversation messages for the agent
    messages = [*req.history, {"role": "user", "content": req.message}]

    # 2. Select specialist agent
    agent_runners = {
        "ads":      ads.run,
        "seo":      seo.run,
        "content":  content.run,
        "strategy": strategy.run,
        "general":  general.run,
    }
    run_agent = agent_runners.get(domain, general.run)

    # 3. Stream SSE response
    async def event_stream():
        # Emit routing decision first so UI can show it
        yield _sse({"type": "routing", "domain": domain, "model": model_tier, "reason": routing.get("reason", "")})

        async for event in run_agent(req.userId, model_tier, messages):
            yield _sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/strategy/evaluate")
async def strategy_evaluate(req: StrategyEvalRequest, request: Request):
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="Unauthorized")

    messages = [{
        "role": "user",
        "content": (
            "Run a full strategy evaluation. "
            "Check all open recommendations against current data. "
            "Evaluate what worked, what didn't, and produce next 30-day priorities."
        ),
    }]

    async def event_stream():
        yield _sse({"type": "routing", "domain": "strategy", "model": "opus", "reason": "scheduled strategy evaluation"})
        async for event in strategy.run(req.userId, "opus", messages):
            yield _sse(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@app.get("/memory/{user_id}")
async def get_memory(user_id: str, request: Request):
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="Unauthorized")

    import memory as mem
    return {
        "open_recommendations": mem.get_open_recommendations(user_id),
        "due_recommendations":  mem.get_due_recommendations(user_id),
        "open_actions":         mem.get_open_actions(user_id),
        "recent_diagnoses":     mem.get_recent_diagnoses(user_id, days_back=30),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5050")),
        reload=os.environ.get("ENV", "production") == "development",
    )
