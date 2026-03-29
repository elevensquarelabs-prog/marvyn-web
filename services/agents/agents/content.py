# -*- coding: utf-8 -*-
"""
Content Agent.

Handles content strategy, blog generation, social posts, content calendar.
Chain: analytics → competitor gaps → generate with brand context.
"""
import json
from collections.abc import AsyncGenerator

import memory
from bridge import call_tool
from agents.base import react_loop

SYSTEM_PROMPT = """You are Marvyn's Content Agent — a specialist in content strategy and creation.

WORKFLOW:
- For "what should I create" or strategy questions:
  1. Call get_analytics_summary to see what content is currently driving traffic
  2. Call get_competitor_insights to find keyword/topic gaps
  3. Call get_brand_context to align tone and audience
  4. Recommend 3 specific content pieces with title, target keyword, and expected impact
  5. Save recommendations to memory

- For content generation requests:
  1. Call get_brand_context first (always — for tone, USP, audience)
  2. Generate the content using generate_blog_post or generate_social_post
  3. Save what was created to memory

- For content calendar questions:
  1. Call get_content_calendar
  2. Identify gaps, suggest what to fill them with

MEMORY CONTEXT: If previous recommendations exist, check get_analytics_summary to see if
past content suggestions were followed and whether they drove traffic. Close the loop.

FINAL ANSWER: Be specific — not "write about SEO" but "write a 1,500-word post targeting
'best CRM for SaaS startups' — you're in position 14 for this keyword with 0 published content."
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_analytics_summary",
            "description": "Get organic traffic and content performance. Call first for strategy questions.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_competitor_insights",
            "description": "Get competitor content and keyword gaps. Call after analytics to find what to create.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_brand_context",
            "description": "Get brand tone, USP, audience. Always call before generating content.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_content_calendar",
            "description": "Get scheduled, pending, and published content. Call for pipeline questions.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_blog_post",
            "description": "Generate and save a blog post draft.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "target_keyword": {"type": "string"},
                    "tone": {"type": "string"},
                },
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_social_post",
            "description": "Generate and save a social media post draft.",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["linkedin", "facebook", "instagram"]},
                    "topic": {"type": "string"},
                    "tone": {"type": "string"},
                },
                "required": ["platform", "topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_recommendation",
            "description": "Save a content recommendation. Marvyn checks back after check_in_days.",
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
            "description": "Save an immediate content action item.",
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
    if tool_name == "save_recommendation":
        rec_id = memory.save_recommendation(
            user_id=user_id, domain="content", text=args["text"],
            metric_name=args.get("metric_name"), metric_value=args.get("metric_value"),
            check_in_days=int(args.get("check_in_days", 30)),
        )
        return {"summary": "Recommendation saved", "content": rec_id}
    if tool_name == "save_action":
        memory.save_action(user_id, "content", args["action"], args.get("priority", "medium"))
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
