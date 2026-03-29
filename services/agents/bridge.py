# -*- coding: utf-8 -*-
"""
Bridge — calls Marvyn's Next.js internal API to execute tools.

The Python agents don't replicate data fetching logic. They call back to
Marvyn's existing tool executors (ads, SEO, GA4, Clarity, etc.) via HTTP.
"""
import os
import httpx

TIMEOUT = 60.0


def _base_url() -> str:
    return os.environ["MARVYN_BASE_URL"].rstrip("/")


def _secret() -> str:
    return os.environ["AGENT_SHARED_SECRET"]


async def call_tool(user_id: str, tool: str, args: dict | None = None) -> dict:
    """
    Call a Marvyn tool via the internal bridge API.
    Returns the tool result as a dict with 'summary' and 'content' keys.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{_base_url()}/api/internal/agent/tool",
            headers={"x-marvyn-agent-secret": _secret()},
            json={"userId": user_id, "tool": tool, "args": args or {}},
        )
        response.raise_for_status()
        return response.json()
