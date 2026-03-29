# -*- coding: utf-8 -*-
"""
OpenRouter model configuration and LLM client.

Three tiers — model is chosen by the router based on task complexity:
  haiku  → classification, simple lookups, brand context, content calendar
  sonnet → diagnosis chains, content generation, multi-step analysis
  opus   → strategy evaluation, cross-domain reasoning, 30-day comparisons
"""
import os
from openai import AsyncOpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Default policy:
# - MiniMax for cheap routing + day-to-day diagnosis
# - Claude Opus only for the heaviest strategy work
MODELS = {
    "haiku":  os.environ.get("AGENT_MODEL_HAIKU", "minimax/minimax-m2.5"),
    "sonnet": os.environ.get("AGENT_MODEL_SONNET", "minimax/minimax-m2.5"),
    "opus":   os.environ.get("AGENT_MODEL_OPUS", "anthropic/claude-opus-4-6"),
}

# Max output tokens per tier
MAX_TOKENS = {
    "haiku":  1500,
    "sonnet": 4000,
    "opus":   6000,
}


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=OPENROUTER_BASE_URL,
        default_headers={
            "HTTP-Referer": os.environ.get("MARVYN_BASE_URL", "http://localhost:3000"),
            "X-Title": "Marvyn Marketing OS",
        },
    )
