# -*- coding: utf-8 -*-
"""
SEO Agent.

Diagnostic chain:
  1. Always start with get_seo_report
  2. If score < 70 or issues are high → get_keyword_rankings to check dropping positions
  3. If competitor/gap question → run_competitor_analysis
  4. Save diagnosis, metric snapshots, and recommendations to memory
"""
import json
from collections.abc import AsyncGenerator

import memory
from bridge import call_tool
from agents.base import react_loop

SYSTEM_PROMPT = """You are Marvyn's SEO Agent — a specialist in organic search performance.

DIAGNOSTIC CHAIN — follow this exactly:
1. Always call get_seo_report first — never skip this
2. Review score, issues by severity, and keyword data
   - If score < 70 OR critical/high issue count > 3 → call get_keyword_rankings to check if positions are dropping
   - If the user asks about competitors or content gaps → call run_competitor_analysis
   - If organic traffic looks flat → call get_analytics_summary to confirm
3. After investigation:
   - Call save_diagnosis with what you found
   - Call save_metric_snapshot for seo_score, top_keyword_position, organic_clicks
   - Call save_recommendation for each specific fix (with metric + check_in_days)

MEMORY CONTEXT: If previous diagnoses exist, compare current score/issues to past findings.
Tell the user exactly what changed: "Your score was 58 last month, it's now 63 — the meta tag
fixes helped but you still have 4 broken internal links."

FINAL ANSWER FORMAT:
- Current score and trend vs last check (if available)
- Top 3 issues ranked by impact, with specific fix for each
- Keyword opportunity: one keyword where you're in position 8–20 that you can push to top 5
- What you saved to memory"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_seo_report",
            "description": "Get the latest SEO audit: score, issues by severity, keyword data, recommendations. Always call this first.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_keyword_rankings",
            "description": "Get GSC keyword rankings: clicks, impressions, CTR, position. Call after get_seo_report if score < 70 or issues are high.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "number"},
                    "sort_by": {"type": "string", "enum": ["clicks", "impressions", "position"]},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_analytics_summary",
            "description": "Get organic traffic summary from GSC. Call if organic traffic appears flat or dropping.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_competitor_analysis",
            "description": "Deep competitor SEO comparison. Call when user asks about competitors or content gaps.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_past_recommendations",
            "description": "Fetch past SEO recommendations. Call at the start to see what was previously flagged.",
            "parameters": {"type": "object", "properties": {"days_back": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metric_history",
            "description": "Get historical values for a metric (e.g. seo_score, organic_clicks) to show trend.",
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
            "name": "save_diagnosis",
            "description": "Save SEO diagnosis to memory. Always call after completing investigation.",
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
            "description": "Snapshot a key metric (seo_score, organic_clicks, top_keyword_position).",
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
            "description": "Save a specific SEO recommendation. Marvyn checks back after check_in_days.",
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
            "name": "save_action",
            "description": "Save an immediate SEO action item.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": ["action"],
            },
        },
    },
]


async def _execute_tool(user_id: str, tool_name: str, args: dict) -> dict:
    if tool_name == "get_past_recommendations":
        recs = memory.get_open_recommendations(user_id, domain="seo")
        return {"summary": f"{len(recs)} open SEO recommendations", "content": json.dumps(recs)}
    if tool_name == "get_metric_history":
        history = memory.get_metric_history(user_id, args["metric_name"], args.get("days_back", 90))
        return {"summary": f"{len(history)} data points for {args['metric_name']}", "content": json.dumps(history)}
    if tool_name == "save_diagnosis":
        memory.save_diagnosis(user_id, "seo", args["summary"])
        return {"summary": "SEO diagnosis saved", "content": "ok"}
    if tool_name == "save_metric_snapshot":
        memory.save_metric_snapshot(user_id, "seo", args["metric_name"], float(args["metric_value"]))
        return {"summary": f"Snapshot saved: {args['metric_name']}={args['metric_value']}", "content": "ok"}
    if tool_name == "save_recommendation":
        rec_id = memory.save_recommendation(
            user_id=user_id, domain="seo", text=args["text"],
            metric_name=args.get("metric_name"), metric_value=args.get("metric_value"),
            check_in_days=int(args.get("check_in_days", 30)),
        )
        return {"summary": f"Recommendation saved", "content": rec_id}
    if tool_name == "save_action":
        memory.save_action(user_id, "seo", args["action"], args.get("priority", "medium"))
        return {"summary": "Action saved", "content": "ok"}
    return await call_tool(user_id, tool_name, args)


async def run(user_id: str, model_tier: str, messages: list[dict]) -> AsyncGenerator[dict, None]:
    mem_context = memory.load_session_context(user_id)
    system = f"{SYSTEM_PROMPT}\n\n{mem_context}" if mem_context else SYSTEM_PROMPT
    async for event in react_loop(
        user_id=user_id, model_tier=model_tier, system_prompt=system,
        messages=messages, tools=TOOLS, tool_executor=_execute_tool,
    ):
        yield event
