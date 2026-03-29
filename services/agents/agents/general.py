# -*- coding: utf-8 -*-
"""
General Agent — handles everything that doesn't fit a specialist domain.
Uses Haiku or Sonnet depending on routing decision.
"""
from collections.abc import AsyncGenerator

import memory
from bridge import call_tool
from agents.base import react_loop

SYSTEM_PROMPT = """You are Marvyn, an AI marketing OS.

You have access to the user's brand context, content calendar, alerts, and the ability to
update brand information. For data-heavy questions about ads, SEO, or strategy, let the user
know those are handled by specialist agents and they can ask directly.

Be concise, helpful, and actionable."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_brand_context",
            "description": "Get brand details, goals, and connected platforms.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_content_calendar",
            "description": "Get scheduled, pending, and published content.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Get recent proactive alerts and notifications.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_brand_info",
            "description": "Update a brand profile field.",
            "parameters": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": ["name", "product", "audience", "tone", "usp", "websiteUrl", "avoidWords", "currency"]},
                    "value": {"type": "string"},
                },
                "required": ["field", "value"],
            },
        },
    },
]


async def _execute_tool(user_id: str, tool_name: str, args: dict) -> dict:
    return await call_tool(user_id, tool_name, args)


async def run(user_id: str, model_tier: str, messages: list[dict]) -> AsyncGenerator[dict, None]:
    mem_context = memory.load_session_context(user_id)
    system = f"{SYSTEM_PROMPT}\n\n{mem_context}" if mem_context else SYSTEM_PROMPT
    async for event in react_loop(
        user_id=user_id, model_tier=model_tier, system_prompt=system,
        messages=messages, tools=TOOLS, tool_executor=_execute_tool,
    ):
        yield event
