"""
AgentLens Python SDK — Trace your AI agents in 2 lines of code.

Usage:
    from agentlens import AgentLens

    # Initialize (starts a trace session)
    lens = AgentLens(session_name="My Agent Pipeline")

    # Option 1: Wrap your OpenAI client (automatic capture)
    client = lens.wrap_openai(OpenAI())
    response = client.chat.completions.create(...)  # Automatically traced!

    # Option 2: Manual tracing
    lens.trace_llm_call(
        agent_name="Researcher",
        model="gpt-4o",
        prompt="Research this topic...",
        response="Here are the findings...",
        tokens={"prompt_tokens": 150, "completion_tokens": 200, "total_tokens": 350},
    )

    # Option 3: Trace tool/MCP calls
    lens.trace_tool_call(
        agent_name="CodeAgent",
        tool_name="file_read",
        tool_input={"path": "/src/main.py"},
        tool_output="file contents...",
    )

    # End the session
    lens.end()
"""

import time
import uuid
import json
import logging
from typing import Any, Optional
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None  # type: ignore

logger = logging.getLogger("agentlens")

AGENTLENS_DEFAULT_URL = "http://localhost:3000"


class AgentLens:
    """Lightweight trace client for AgentLens."""

    def __init__(
        self,
        session_name: str = "Untitled Session",
        server_url: str = AGENTLENS_DEFAULT_URL,
        session_id: Optional[str] = None,
        auto_end: bool = True,
    ):
        if requests is None:
            raise ImportError(
                "The 'requests' package is required. Install it: pip install requests"
            )

        self.server_url = server_url.rstrip("/")
        self.session_id = session_id or str(uuid.uuid4())
        self.session_name = session_name
        self.auto_end = auto_end
        self._step_count = 0

        logger.info(f"AgentLens session started: {self.session_id}")

    def _send(self, data: dict, action: Optional[str] = None) -> dict:
        """Send data to the AgentLens ingest API."""
        url = f"{self.server_url}/api/ingest"
        if action:
            url += f"?action={action}"
        try:
            resp = requests.post(url, json=data, timeout=5)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"AgentLens send failed: {e}")
            return {"ok": False, "error": str(e)}

    def trace_llm_call(
        self,
        agent_name: str,
        model: str = "unknown",
        prompt: str = "",
        system_prompt: str = "",
        response: str = "",
        provider: str = "openai",
        temperature: Optional[float] = None,
        tokens: Optional[dict] = None,
        duration_ms: Optional[int] = None,
        status: str = "success",
    ) -> dict:
        """Trace an LLM API call."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": agent_name,
            "step_type": "llm_call",
            "status": status,
            "provider": provider,
            "model": model,
            "prompt": prompt,
            "system_prompt": system_prompt,
            "response": response,
            "temperature": temperature,
            "tokens": tokens,
            "duration_ms": duration_ms or 0,
        })

    def trace_tool_call(
        self,
        agent_name: str,
        tool_name: str,
        tool_input: Optional[dict] = None,
        tool_output: Any = None,
        duration_ms: Optional[int] = None,
        status: str = "success",
    ) -> dict:
        """Trace a tool invocation."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": agent_name,
            "step_type": "tool_call",
            "status": status,
            "tool_name": tool_name,
            "tool_input": tool_input or {},
            "tool_output": tool_output,
            "duration_ms": duration_ms or 0,
        })

    def trace_mcp_call(
        self,
        agent_name: str,
        server_name: str,
        tool_name: str,
        params: Optional[dict] = None,
        result: Any = None,
        duration_ms: Optional[int] = None,
        status: str = "success",
    ) -> dict:
        """Trace an MCP tool invocation."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": agent_name,
            "step_type": "mcp_invoke",
            "status": status,
            "mcp_server": server_name,
            "mcp_tool": tool_name,
            "mcp_params": params or {},
            "mcp_result": result,
            "duration_ms": duration_ms or 0,
        })

    def trace_agent_spawn(
        self,
        parent_agent: str,
        spawned_agent: str,
        reason: str = "",
    ) -> dict:
        """Trace spawning a sub-agent."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": parent_agent,
            "step_type": "agent_spawn",
            "spawned_agent": spawned_agent,
            "decision_reason": reason,
            "duration_ms": 0,
        })

    def trace_decision(
        self,
        agent_name: str,
        reason: str,
        duration_ms: Optional[int] = None,
    ) -> dict:
        """Trace a decision point."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": agent_name,
            "step_type": "decision",
            "decision_reason": reason,
            "duration_ms": duration_ms or 0,
        })

    def trace_error(
        self,
        agent_name: str,
        error_message: str,
        error_type: str = "Error",
    ) -> dict:
        """Trace an error."""
        return self._send({
            "session_id": self.session_id,
            "session_name": self.session_name,
            "agent_name": agent_name,
            "step_type": "error",
            "status": "error",
            "error_message": error_message,
            "error_type": error_type,
            "duration_ms": 0,
        })

    def end(self, status: str = "completed") -> dict:
        """End the trace session."""
        result = self._send(
            {"session_id": self.session_id, "status": status},
            action="end",
        )
        logger.info(f"AgentLens session ended: {self.session_id}")
        return result

    # ─── OpenAI Client Wrapper ───────────────────────────────────────────
    def wrap_openai(self, client: Any, agent_name: str = "Agent") -> Any:
        """
        Wrap an OpenAI client to automatically trace all chat completions.

        Usage:
            from openai import OpenAI
            client = lens.wrap_openai(OpenAI(), agent_name="MyAgent")
            response = client.chat.completions.create(model="gpt-4o", messages=[...])
            # ^ This call is automatically traced in AgentLens!
        """
        lens = self
        original_create = client.chat.completions.create

        def traced_create(*args, **kwargs):
            start = time.time()
            try:
                response = original_create(*args, **kwargs)
                duration_ms = int((time.time() - start) * 1000)

                # Extract data from the response
                model = kwargs.get("model", getattr(response, "model", "unknown"))
                messages = kwargs.get("messages", [])
                system_prompt = ""
                user_prompt = ""
                for msg in messages:
                    if msg.get("role") == "system":
                        system_prompt = msg.get("content", "")
                    elif msg.get("role") == "user":
                        user_prompt = msg.get("content", "")

                response_text = ""
                if hasattr(response, "choices") and response.choices:
                    response_text = response.choices[0].message.content or ""

                tokens = None
                if hasattr(response, "usage") and response.usage:
                    tokens = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }

                lens.trace_llm_call(
                    agent_name=agent_name,
                    model=model,
                    prompt=user_prompt,
                    system_prompt=system_prompt,
                    response=response_text,
                    provider="openai",
                    temperature=kwargs.get("temperature"),
                    tokens=tokens,
                    duration_ms=duration_ms,
                )
                return response

            except Exception as e:
                duration_ms = int((time.time() - start) * 1000)
                lens.trace_error(agent_name=agent_name, error_message=str(e))
                raise

        client.chat.completions.create = traced_create
        return client

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        status = "failed" if exc_type else "completed"
        self.end(status=status)
        return False
