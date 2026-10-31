"""Meko (MCP) wrapper. Every call is best-effort: failures are logged and
return None, so the app keeps working from `issue_events` if Meko is down.

Run `python -m scripts.list_meko_tools` to see the real tool names and argument
schemas for your account, then adjust the argument names below if needed.
"""
import asyncio
import json
import logging

from config import settings

log = logging.getLogger("rezolv.meko")

TIMEOUT = 25


def enabled() -> bool:
    return bool(settings.meko_api_key)


def _text(result) -> str:
    return "\n".join(getattr(c, "text", "") for c in result.content if getattr(c, "text", None))


async def _with_session(fn):
    from mcp import ClientSession

    try:
        from mcp.client.streamable_http import streamablehttp_client as http_client
    except ImportError:  # newer SDKs
        from mcp.client.streamable_http import streamable_http_client as http_client

    headers = {"Authorization": f"Bearer {settings.meko_api_key}"}
    async with http_client(settings.meko_mcp_url, headers=headers) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            await session.initialize()
            return await fn(session)


def list_tools() -> list:
    async def go(s):
        return (await s.list_tools()).tools

    return asyncio.run(asyncio.wait_for(_with_session(go), TIMEOUT))


def call_tool(name: str, args: dict) -> str | None:
    if not enabled():
        return None
    args = {**args}
    if settings.meko_datapack_id:
        args.setdefault("datapack_id", settings.meko_datapack_id)

    async def go(s):
        res = await s.call_tool(name, args)
        if res.isError:
            raise RuntimeError(_text(res))
        return _text(res)

    try:
        return asyncio.run(asyncio.wait_for(_with_session(go), TIMEOUT))
    except Exception:
        log.exception("Meko %s failed", name)
        return None


# ---------- helpers used by the agents ----------

def create_conversation(issue_code: str) -> str | None:
    out = call_tool("conversation_create", {"title": issue_code, "agent_id": "rezolv"})
    if not out:
        return None
    try:
        data = json.loads(out)
        return str(data.get("id") or data.get("conversation_id") or out)
    except (ValueError, AttributeError):
        return out.strip()


def add_message(conversation_id: str, agent: str, output: str, reasoning: str | None, metadata: dict):
    return call_tool(
        "conversation_add_message",
        {
            "conversation_id": conversation_id,
            "agent_id": agent,
            "input": metadata.get("event_type", "decision"),
            "output": output,
            "reasoning": reasoning or "",
            "metadata": metadata,
        },
    )


def memory_add(agent: str, content: str):
    return call_tool("memory_add", {"agent_id": agent, "content": content})


def memory_search(agent: str, query: str) -> str | None:
    return call_tool("memory_search", {"agent_id": agent, "query": query})
