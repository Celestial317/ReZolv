"""Meko (MCP) wrapper. Every call is best-effort: failures are logged and
return None, so the app keeps working from `issue_events` if Meko is down.

Tool arguments follow the live schemas (`python -m scripts.list_meko_tools`):
  * conversation_create(title, agent_id, datapack_id) -> {"id": ...}
  * conversation_add_message(conversation_id, input, output, agent_id, reasoning, metadata: JSON string)
  * memory_add(text, conversation_id, agent_id, metadata: JSON string)
  * memory_search(query, conversation_id, agent_id, limit)   (searches across agents)
Memory calls need a conversation_id for tracing; we keep one shared "rezolv-memory" conversation.
"""
import asyncio
import json
import logging
import threading
from pathlib import Path

from config import settings

log = logging.getLogger("rezolv.meko")

TIMEOUT = 25
CACHE_FILE = Path(__file__).resolve().parent / ".cache" / "meko.json"
# Tools that take a datapack_id argument.
_DATAPACK_TOOLS = {"knowledgebase_search", "conversation_create", "conversation_add_message", "memory_add", "memory_search", "context_search"}
_lock = threading.Lock()


def enabled() -> bool:
    return bool(settings.meko_api_key)


def _text(result) -> str:
    return "\n".join(getattr(c, "text", "") for c in result.content if getattr(c, "text", None))


async def _with_session(fn):
    from mcp import ClientSession

    headers = {"Authorization": f"Bearer {settings.meko_api_key}"}
    try:  # mcp >= 2: headers go on the HTTP client
        from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

        transport = streamable_http_client(settings.meko_mcp_url, http_client=create_mcp_http_client(headers=headers))
    except ImportError:  # older SDKs
        from mcp.client.streamable_http import streamablehttp_client

        transport = streamablehttp_client(settings.meko_mcp_url, headers=headers)
    async with transport as streams:
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
    args = {k: v for k, v in args.items() if v is not None}
    if settings.meko_datapack_id and name in _DATAPACK_TOOLS:
        args.setdefault("datapack_id", settings.meko_datapack_id)

    async def go(s):
        res = await s.call_tool(name, args)
        out = _text(res)
        if res.is_error if hasattr(res, "is_error") else res.isError:
            raise RuntimeError(out)
        try:  # Meko reports some failures as a normal result with an "error" key
            data = json.loads(out)
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"{data['error']}: {data.get('detail', '')}")
        except ValueError:
            pass
        return out

    for attempt in (1, 2):  # one retry: the MCP session setup occasionally drops
        try:
            return asyncio.run(asyncio.wait_for(_with_session(go), TIMEOUT))
        except BaseException as e:  # noqa: BLE001  (TaskGroup raises ExceptionGroup)
            inner = getattr(e, "exceptions", None)
            detail = "; ".join(repr(x)[:160] for x in inner) if inner else str(e)[:200]
            if attempt == 2 or isinstance(e, (KeyboardInterrupt, SystemExit)):
                log.warning("Meko %s failed: %s", name, detail)
    return None


def _id_of(out: str | None) -> str | None:
    if not out:
        return None
    try:
        data = json.loads(out)
        return str(data.get("id") or data.get("conversation_id"))
    except (ValueError, AttributeError):
        return out.strip()


# ---------- conversations (one per issue, holds its decision trace) ----------

def create_conversation(issue_code: str) -> str | None:
    return _id_of(call_tool("conversation_create", {"title": issue_code, "agent_id": "rezolv"}))


def add_message(conversation_id: str, agent: str, output: str, reasoning: str | None, metadata: dict):
    return call_tool(
        "conversation_add_message",
        {
            "conversation_id": conversation_id,
            "agent_id": "rezolv",  # must match the conversation's agent; the real agent goes in input/metadata
            "input": f"{agent}: {metadata.get('event_type', 'decision')}",
            "output": output,
            "reasoning": reasoning or "",
            "metadata": json.dumps({**metadata, "agent": agent}),
        },
    )


# ---------- shared memory (playbooks, routing hints) ----------

def _memory_conversation() -> str | None:
    """One long-lived conversation that memory calls hang off. Created on first use."""
    with _lock:
        try:
            cid = json.loads(CACHE_FILE.read_text()).get(settings.meko_datapack_id or "default")
            if cid:
                return cid
        except Exception:
            pass
        cid = _id_of(call_tool("conversation_create", {"title": "rezolv-memory", "agent_id": "rezolv"}))
        if cid:
            try:
                CACHE_FILE.parent.mkdir(exist_ok=True)
                try:
                    cache = json.loads(CACHE_FILE.read_text())
                except Exception:
                    cache = {}
                cache[settings.meko_datapack_id or "default"] = cid
                CACHE_FILE.write_text(json.dumps(cache))
            except Exception:
                log.warning("could not cache the Meko memory conversation id")
        return cid


def memory_add(agent: str, content: str):
    cid = _memory_conversation()
    if not cid:
        return None
    return call_tool("memory_add", {"text": content, "conversation_id": cid, "agent_id": agent})


def memory_search(agent: str, query: str) -> str | None:
    cid = _memory_conversation()
    if not cid:
        return None
    out = call_tool("memory_search", {"query": query, "conversation_id": cid, "agent_id": agent, "limit": 3})
    return _readable(out)


def _readable(out: str | None) -> str | None:
    """Flatten a Meko search result to plain text for the agents (empty result -> None)."""
    if not out:
        return None
    try:
        data = json.loads(out)
    except ValueError:
        return out.strip() or None
    items = data.get("results", data) if isinstance(data, dict) else data
    if not items:
        return None
    if isinstance(items, list):
        texts = [str(i.get("memory") or i.get("text") or i.get("content") or "") if isinstance(i, dict) else str(i)
                 for i in items]
        return " | ".join(t for t in texts if t) or None
    return str(items)
