# -*- coding: utf-8 -*-
"""
Base ReAct agent loop.

All specialist agents share this loop:
  1. Build messages (system + memory context + history + user message)
  2. Call LLM with tools
  3. If tool_calls → execute → append results → loop
  4. If text response → stream it → done

Memory writes happen inside each specialist agent's tool execution.
"""
import json
from collections.abc import AsyncGenerator
from typing import Any

from config import get_client, MODELS, MAX_TOKENS

MAX_ITERATIONS = 8


async def react_loop(
    *,
    user_id: str,
    model_tier: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    tool_executor,  # async callable(user_id, tool_name, tool_args) -> dict
) -> AsyncGenerator[dict, None]:
    """
    Core ReAct loop. Yields SSE-compatible event dicts:
      {"type": "tool_call",   "tool": str, "label": str}
      {"type": "tool_result", "tool": str, "summary": str}
      {"type": "delta",       "content": str}
      {"type": "done",        "model": str, "iterations": int}
    """
    client = get_client()
    model = MODELS.get(model_tier, MODELS["sonnet"])
    max_tokens = MAX_TOKENS.get(model_tier, 4000)

    loop_messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]

    for iteration in range(MAX_ITERATIONS):
        is_last = iteration == MAX_ITERATIONS - 1

        response = await client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=loop_messages,
            tools=tools if not is_last else [],
            tool_choice="auto" if not is_last else None,
        )

        msg = response.choices[0].message
        loop_messages.append(msg.model_dump(exclude_unset=False))

        if msg.tool_calls and not is_last:
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    tool_args = {}

                label = _tool_label(tool_name)
                yield {"type": "tool_call", "tool": tool_name, "label": label}

                try:
                    result = await tool_executor(user_id, tool_name, tool_args)
                    summary = result.get("summary", f"{tool_name} completed")
                    content = result.get("content", json.dumps(result))
                except Exception as e:
                    summary = f"Error: {e}"
                    content = f"Tool {tool_name} failed: {e}"

                yield {"type": "tool_result", "tool": tool_name, "summary": summary}

                loop_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": content,
                })
        else:
            # Final text response — stream in chunks
            text = msg.content or ""
            chunk_size = 20
            for i in range(0, len(text), chunk_size):
                yield {"type": "delta", "content": text[i:i + chunk_size]}
            yield {"type": "done", "model": model, "iterations": iteration + 1}
            return

    # Fallback if we hit max iterations without a text response
    yield {"type": "delta", "content": "I reached my analysis limit. Here is what I found so far."}
    yield {"type": "done", "model": model, "iterations": MAX_ITERATIONS}


def _tool_label(name: str) -> str:
    labels = {
        "get_meta_ads_performance":   "Fetching Meta Ads data…",
        "get_google_ads_performance": "Fetching Google Ads data…",
        "get_ga4_analytics":          "Analysing GA4 conversion data…",
        "get_clarity_insights":       "Reading Clarity UX behaviour…",
        "get_seo_report":             "Reading SEO report…",
        "get_keyword_rankings":       "Fetching keyword rankings…",
        "get_competitor_insights":    "Analysing competitors…",
        "run_competitor_analysis":    "Running competitor analysis…",
        "get_analytics_summary":      "Fetching analytics…",
        "get_brand_context":          "Loading brand context…",
        "get_content_calendar":       "Loading content calendar…",
        "generate_blog_post":         "Writing blog post draft…",
        "generate_social_post":       "Writing social post draft…",
        "get_past_recommendations":   "Checking past recommendations…",
        "get_metric_history":         "Loading metric history…",
        "get_open_actions":           "Loading open action items…",
        "save_recommendation":        "Saving recommendation…",
        "save_diagnosis":             "Saving diagnosis…",
        "save_metric_snapshot":       "Saving metric snapshot…",
        "save_action":                "Saving action item…",
    }
    return labels.get(name, f"Running {name}…")
