# -*- coding: utf-8 -*-
"""
Strategy Agent — the most intelligent agent in the system.

This is what makes Marvyn genuinely agentic for VCs:
- Pulls all current data across every domain
- Loads past recommendations from memory
- Loads metric history to see trends
- Evaluates: did last month's plan work?
- Builds next month's priorities based on evidence
- Compares period vs period with real numbers

Uses Opus by default (routed there for strategy/comparison questions).
"""
import json
from collections.abc import AsyncGenerator

import memory
from bridge import call_tool
from agents.base import react_loop

SYSTEM_PROMPT = """You are Marvyn's Strategy Agent — the most senior analyst in the system.

You have access to all data sources AND the memory of everything Marvyn has previously
diagnosed and recommended. Your job is to think across domains.

STRATEGY EVALUATION WORKFLOW (for "how did last month go" / "what should I focus on next month"):
1. Call get_open_actions to see what action items are still open
2. Call get_past_recommendations (all domains) to see what was recommended
3. Call get_metric_history for the key metrics from past recommendations to evaluate outcomes
4. Call get_seo_report, get_meta_ads_performance, get_google_ads_performance, get_analytics_summary
   to get current state across all channels
5. Compare current metrics to the values stored in past recommendations
6. Explicitly evaluate: "I recommended X because metric was Y. It is now Z. That's a W% change."
7. Build next period's priorities based on what worked, what didn't, and what's still broken
8. Save new recommendations and metric snapshots

PERIOD COMPARISON WORKFLOW (for "last 30 days vs previous 30 days"):
1. Fetch ads data for both periods (use days=30 vs days=60 and compare)
2. Fetch metric history from memory for trend context
3. Call get_seo_report and get_keyword_rankings to check organic trend
4. Produce side-by-side comparison with % change for each key metric

MEMORY IS YOUR ADVANTAGE:
- You know what Marvyn told this user last time
- You know what metrics looked like then vs now
- You can say "Last month I flagged your Meta ROAS at 1.4x — it's now 1.9x, improving but still below 2x"
- This is what separates Marvyn from every other tool

FINAL ANSWER FORMAT:
- Performance scorecard: key metrics vs last period (with % change)
- Recommendation evaluation: what worked, what didn't
- Next 30-day priorities: top 3, ranked by expected impact
- What you saved to memory"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_open_actions",
            "description": "Get all open action items across all domains. Call at the start of strategy evaluation.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_past_recommendations",
            "description": "Get all open recommendations. Pass domain=null to get all domains.",
            "parameters": {
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "enum": ["ads", "seo", "content", "strategy"]},
                    "days_back": {"type": "number"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metric_history",
            "description": "Get historical values for a specific metric to evaluate trends and recommendation outcomes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_name": {"type": "string"},
                    "days_back": {"type": "number"},
                },
                "required": ["metric_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_meta_ads_performance",
            "description": "Fetch Meta Ads performance for the period.",
            "parameters": {"type": "object", "properties": {"days": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_google_ads_performance",
            "description": "Fetch Google Ads performance for the period.",
            "parameters": {"type": "object", "properties": {"days": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_seo_report",
            "description": "Get the latest SEO audit.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_analytics_summary",
            "description": "Get organic traffic and content performance.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_brand_context",
            "description": "Get brand goals and business model. Call if you need conversion context.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_diagnosis",
            "description": "Save the strategy evaluation summary to memory.",
            "parameters": {
                "type": "object",
                "properties": {"summary": {"type": "string"}},
                "required": ["summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_metric_snapshot",
            "description": "Snapshot a key metric for future comparison.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_name": {"type": "string"},
                    "metric_value": {"type": "number"},
                },
                "required": ["metric_name", "metric_value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_recommendation",
            "description": "Save a new strategic recommendation with metric to check back on.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "metric_name": {"type": "string"},
                    "metric_value": {"type": "number"},
                    "check_in_days": {"type": "number"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "evaluate_recommendation",
            "description": "Mark a past recommendation as evaluated with an outcome. Call after comparing old vs current metric.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recommendation_id": {"type": "string"},
                    "outcome": {"type": "string", "description": "What happened — e.g. 'ROAS improved from 1.4x to 1.9x, partially successful'"},
                },
                "required": ["recommendation_id", "outcome"],
            },
        },
    },
]


async def _execute_tool(user_id: str, tool_name: str, args: dict) -> dict:
    if tool_name == "get_open_actions":
        actions = memory.get_open_actions(user_id)
        return {"summary": f"{len(actions)} open actions", "content": json.dumps(actions)}
    if tool_name == "get_past_recommendations":
        domain = args.get("domain")
        recs = memory.get_open_recommendations(user_id, domain=domain)
        return {"summary": f"{len(recs)} open recommendations", "content": json.dumps(recs)}
    if tool_name == "get_metric_history":
        history = memory.get_metric_history(user_id, args["metric_name"], args.get("days_back", 90))
        return {"summary": f"{len(history)} data points for {args['metric_name']}", "content": json.dumps(history)}
    if tool_name == "save_diagnosis":
        memory.save_diagnosis(user_id, "strategy", args["summary"])
        return {"summary": "Strategy evaluation saved", "content": "ok"}
    if tool_name == "save_metric_snapshot":
        memory.save_metric_snapshot(user_id, "strategy", args["metric_name"], float(args["metric_value"]))
        return {"summary": f"Snapshot saved: {args['metric_name']}", "content": "ok"}
    if tool_name == "save_recommendation":
        rec_id = memory.save_recommendation(
            user_id=user_id, domain="strategy", text=args["text"],
            metric_name=args.get("metric_name"), metric_value=args.get("metric_value"),
            check_in_days=int(args.get("check_in_days", 30)),
        )
        return {"summary": "Recommendation saved", "content": rec_id}
    if tool_name == "evaluate_recommendation":
        memory.evaluate_recommendation(args["recommendation_id"], args["outcome"])
        return {"summary": "Recommendation evaluated", "content": "ok"}
    return await call_tool(user_id, tool_name, args)


async def run(user_id: str, model_tier: str, messages: list[dict]) -> AsyncGenerator[dict, None]:
    mem_context = memory.load_session_context(user_id)
    system = f"{SYSTEM_PROMPT}\n\n{mem_context}" if mem_context else SYSTEM_PROMPT
    async for event in react_loop(
        user_id=user_id, model_tier=model_tier, system_prompt=system,
        messages=messages, tools=TOOLS, tool_executor=_execute_tool,
    ):
        yield event
