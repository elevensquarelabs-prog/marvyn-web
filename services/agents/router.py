# -*- coding: utf-8 -*-
"""
LLM Router — the decision-making agent.

Uses Haiku (cheapest, fastest) to classify every incoming message and decide:
  1. Which domain: ads | seo | content | strategy | general
  2. Which model tier: haiku | sonnet | opus
  3. Reasoning: why this routing decision was made

This single cheap call prevents burning Opus tokens on "what's my brand name?"
and ensures complex strategy questions get the most capable model.
"""
import json
from config import get_client, MODELS, MAX_TOKENS

ROUTING_SYSTEM_PROMPT = """You are a routing agent for Marvyn, an AI marketing OS.

Your only job is to classify the user's message and output a JSON routing decision.

DOMAIN CLASSIFICATION:
- "ads"      → questions about Meta, Google, LinkedIn ads, ROAS, CPM, CTR, campaigns, ad spend, conversions from paid
- "seo"      → questions about SEO score, rankings, keywords, organic traffic, site issues, backlinks, competitors
- "content"  → questions about blog posts, social media, content calendar, what to write, content strategy, email
- "strategy" → questions about overall marketing strategy, 30-day plans, what to focus on, performance reviews, comparing periods
- "general"  → everything else (brand settings, general questions, greetings, how things work)

MODEL TIER SELECTION:
- "haiku"  → simple lookups, single data point, greetings, brand info, content calendar checks
- "sonnet" → diagnosis requiring 2-3 tool calls, content generation, analysis with recommendations
- "opus"   → cross-domain reasoning, comparing periods (last 30 days vs this 30 days), full strategy evaluation, complex multi-step investigation

RULES:
- If the user asks to compare time periods or evaluate a strategy → always opus
- If the user asks to generate content (blog, social post) → always sonnet
- If the user asks a simple factual question about one metric → haiku
- Default to sonnet when unsure

Output ONLY valid JSON. No explanation. No markdown.
Format: {"domain": "...", "model": "...", "reason": "one sentence"}"""


async def route(message: str) -> dict:
    """
    Classify the message and return routing decision.
    Returns: {"domain": str, "model": str, "reason": str}
    """
    client = get_client()
    response = await client.chat.completions.create(
        model=MODELS["haiku"],
        max_tokens=150,
        messages=[
            {"role": "system", "content": ROUTING_SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
    )

    raw = response.choices[0].message.content or ""
    try:
        decision = json.loads(raw.strip())
        # Validate fields
        if decision.get("domain") not in ("ads", "seo", "content", "strategy", "general"):
            decision["domain"] = "general"
        if decision.get("model") not in ("haiku", "sonnet", "opus"):
            decision["model"] = "sonnet"
        return decision
    except (json.JSONDecodeError, KeyError):
        return {"domain": "general", "model": "sonnet", "reason": "routing parse failed, defaulting to sonnet"}
