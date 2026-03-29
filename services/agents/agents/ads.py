# -*- coding: utf-8 -*-
"""
Ads Diagnosis Agent.

Diagnostic chain:
  1. Fetch Meta and/or Google Ads data
  2. If ROAS < 2x or conversions low → fetch GA4 to check traffic vs landing page
  3. If GA4 shows bounce > 60% or low engagement → fetch Clarity for UX friction
  4. Synthesise: what is performing, where is the leak, one specific fix
  5. Save diagnosis + recommendations + metric snapshots to memory
"""
import json
from collections.abc import AsyncGenerator

import memory
from bridge import call_tool
from agents.base import react_loop

SYSTEM_PROMPT = """You are Marvyn's Ads Diagnosis Agent — a specialist in paid media performance.

You have access to tools to fetch real data and to write findings to memory so you remember them next session.

DIAGNOSTIC CHAIN — follow this exactly:
1. Call get_meta_ads_performance AND/OR get_google_ads_performance (both if both are connected)
2. Review ROAS, conversions, CPA, CTR
   - If ROAS < 2x OR conversions are lower than expected → call get_ga4_analytics
   - If ROAS >= 2x and conversion volume is healthy → skip GA4
3. Review GA4 session quality and conversion rate by channel and landing page
   - If bounce rate > 60% OR landing page conversion rate < 2% → call get_clarity_insights
   - Otherwise skip Clarity
4. Once you have enough data:
   - Call save_diagnosis with a clear summary of what you found
   - Call save_metric_snapshot for the key metrics you read (meta_roas, google_roas, bounce_rate, etc.)
   - Call save_recommendation for each specific fix you recommend (with metric_name and check_in_days)
   - Call save_action for immediate actions the user should take

MEMORY CONTEXT: If the session context shows previous diagnoses or open recommendations, explicitly
compare current data to those past findings. Tell the user what changed since last time.

FINAL ANSWER FORMAT:
- What is performing well
- Where the leak is (specific, with numbers)
- Root cause (traffic quality / landing page / creative / audience / budget)
- One specific fix with expected impact
- What you saved to memory for follow-up"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_meta_ads_performance",
            "description": "Fetch Meta Ads spend, ROAS, CPM, CTR, top campaigns. Call this first for any Meta/Facebook/Instagram ads question.",
            "parameters": {"type": "object", "properties": {"days": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_google_ads_performance",
            "description": "Fetch Google Ads spend, ROAS, conversions, top campaigns. Call this first for any Google Ads question.",
            "parameters": {"type": "object", "properties": {"days": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ga4_analytics",
            "description": "Fetch GA4 sessions, conversions, bounce rate by channel and landing page. Call ONLY if ROAS is below 2x or conversion volume is low.",
            "parameters": {"type": "object", "properties": {"days": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_clarity_insights",
            "description": "Fetch Clarity UX data: rage clicks, dead clicks, scroll depth. Call ONLY if GA4 shows bounce > 60% or low landing page conversion.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_brand_context",
            "description": "Fetch brand details and business model. Call if you need conversion context or business model to interpret the data.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_past_recommendations",
            "description": "Fetch past recommendations made for this user in the ads domain. Call at the start to check what was previously flagged.",
            "parameters": {"type": "object", "properties": {"days_back": {"type": "number"}}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metric_history",
            "description": "Get historical values for a metric (e.g. meta_roas, bounce_rate) to show trend.",
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
            "description": "Save the diagnosis summary to memory. Always call this after completing the investigation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "One-paragraph summary of what you found"},
                },
                "required": ["summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_metric_snapshot",
            "description": "Snapshot a key metric value right now. Call for each important metric you read.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_name": {"type": "string", "description": "e.g. meta_roas, google_roas, meta_cpa, bounce_rate"},
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
            "description": "Save a specific recommendation. Marvyn will check back after check_in_days to see if it worked.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "The specific recommendation"},
                    "metric_name": {"type": "string", "description": "The metric to check when evaluating this recommendation"},
                    "metric_value": {"type": "number", "description": "Current value of that metric"},
                    "check_in_days": {"type": "number", "description": "How many days until Marvyn checks if this worked (default 30)"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_action",
            "description": "Save an immediate action item for the user.",
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
    """Execute a tool — either via Marvyn bridge or local memory."""
    if tool_name == "get_past_recommendations":
        recs = memory.get_open_recommendations(user_id, domain="ads")
        return {
            "summary": f"{len(recs)} open recommendations",
            "content": json.dumps(recs),
        }
    if tool_name == "get_metric_history":
        history = memory.get_metric_history(
            user_id,
            args["metric_name"],
            args.get("days_back", 90),
        )
        return {
            "summary": f"{len(history)} data points for {args['metric_name']}",
            "content": json.dumps(history),
        }
    if tool_name == "save_diagnosis":
        memory.save_diagnosis(user_id, "ads", args["summary"])
        return {"summary": "Diagnosis saved", "content": "ok"}
    if tool_name == "save_metric_snapshot":
        memory.save_metric_snapshot(user_id, "ads", args["metric_name"], float(args["metric_value"]))
        return {"summary": f"Snapshot saved: {args['metric_name']}={args['metric_value']}", "content": "ok"}
    if tool_name == "save_recommendation":
        rec_id = memory.save_recommendation(
            user_id=user_id,
            domain="ads",
            text=args["text"],
            metric_name=args.get("metric_name"),
            metric_value=args.get("metric_value"),
            check_in_days=int(args.get("check_in_days", 30)),
        )
        return {"summary": f"Recommendation saved (ID: {rec_id})", "content": "ok"}
    if tool_name == "save_action":
        action_id = memory.save_action(user_id, "ads", args["action"], args.get("priority", "medium"))
        return {"summary": f"Action saved (ID: {action_id})", "content": "ok"}
    # All other tools → Marvyn bridge
    return await call_tool(user_id, tool_name, args)


async def run(
    user_id: str,
    model_tier: str,
    messages: list[dict],
) -> AsyncGenerator[dict, None]:
    mem_context = memory.load_session_context(user_id)
    system = SYSTEM_PROMPT
    if mem_context:
        system = f"{SYSTEM_PROMPT}\n\n{mem_context}"

    async for event in react_loop(
        user_id=user_id,
        model_tier=model_tier,
        system_prompt=system,
        messages=messages,
        tools=TOOLS,
        tool_executor=_execute_tool,
    ):
        yield event
