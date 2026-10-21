from threading import Lock
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from langchain_core.messages import HumanMessage
from langgraph.types import Command
from pydantic import BaseModel, Field

from graph_agent import graph


app = FastAPI(title="CRM Agent API")

# Prevent overlapping requests from changing graph state.
graph_lock = Lock()


class ChatRequest(BaseModel):
    """Expected JSON fields for a chat request."""

    message: str = Field(min_length=1)
    session_id: UUID | None = None


class ApprovalRequest(BaseModel):
    """Identify a pending proposal and provide the user's decision."""

    session_id: UUID
    approval_id: str
    approved: bool


def graph_config(session_id: str) -> dict:
    """Connect an API session to its LangGraph conversation."""

    return {
        "configurable": {"thread_id": session_id},
        "recursion_limit": 30,
    }


def pending_approvals(config: dict) -> list:
    """Read pending approval pauses from the graph checkpoint."""

    snapshot = graph.get_state(config)

    return [
        pause
        for task in snapshot.tasks
        for pause in task.interrupts
    ]


def format_result(result: dict, session_id: str) -> dict:
    """Return either a final answer or an approval proposal."""

    pauses = result.get("__interrupt__", ())

    if pauses:
        pause = pauses[0]

        return {
            "session_id": session_id,
            "status": "approval_required",
            "approval_id": pause.id,
            "changes": pause.value["changes"],
        }

    return {
        "session_id": session_id,
        "status": "completed",
        "answer": result["messages"][-1].text,
    }


@app.get("/health")
def health():
    """Check that the API server is running."""

    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest):
    """Send a message to a new or existing conversation."""

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be blank.",
        )

    # Generate a conversation ID if none was supplied.
    session_id = str(request.session_id or uuid4())
    config = graph_config(session_id)

    with graph_lock:
        # Resolve pending changes before accepting another message.
        if pending_approvals(config):
            raise HTTPException(
                status_code=409,
                detail="Approve or reject the pending change first.",
            )

        result = graph.invoke(
            {
                "messages": [HumanMessage(content=message)],
                "approved": False,
                "model_calls": 0,
            },
            config=config,
        )

        return format_result(result, session_id)


@app.post("/approve")
def approve(request: ApprovalRequest):
    """Approve or reject pending database changes."""

    session_id = str(request.session_id)
    config = graph_config(session_id)

    with graph_lock:
        pauses = pending_approvals(config)

        # Reject expired, incorrect, or repeated approval requests.
        if not pauses or pauses[0].id != request.approval_id:
            raise HTTPException(
                status_code=409,
                detail="This approval is no longer pending.",
            )

        # Resume the graph with the user's decision.
        result = graph.invoke(
            Command(resume=request.approved),
            config=config,
        )

        # A resumed turn may finish or request another approval.
        return format_result(result, session_id)

@app.get("/sessions")
def list_sessions():
    """List the most recent saved conversations."""

    with graph_lock:
        sessions = []
        seen = set()

        # Checkpoints are returned newest first.
        for checkpoint in graph.checkpointer.list(None):
            session_id = checkpoint.config["configurable"]["thread_id"]

            if session_id in seen:
                continue

            seen.add(session_id)

            # The API uses UUIDs; skip terminal-only conversation IDs.
            try:
                UUID(session_id)
            except (ValueError, TypeError):
                continue

            messages = checkpoint.checkpoint.get(
                "channel_values", {}
            ).get("messages", [])

            first_question = next(
                (
                    message.text
                    for message in messages
                    if message.type == "human" and message.text
                ),
                None,
            )

            if not first_question:
                continue

            sessions.append(
                {
                    "session_id": session_id,
                    "title": first_question[:80],
                    "updated_at": checkpoint.checkpoint["ts"],
                }
            )

            if len(sessions) >= 50:
                break

        return {"sessions": sessions}


@app.get("/sessions/{session_id}")
def get_session(session_id: UUID):
    """Restore a conversation and any pending approval."""

    session_id = str(session_id)
    config = graph_config(session_id)

    with graph_lock:
        snapshot = graph.get_state(config)

        if not snapshot.values:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        # Return visible messages, excluding internal tool requests/results.
        messages = [
            {
                "id": message.id,
                "role": "user" if message.type == "human" else "assistant",
                "content": message.text,
            }
            for message in snapshot.values.get("messages", [])
            if message.type in ("human", "ai")
            and message.text
            and not getattr(message, "tool_calls", None)
        ]

        result = {
            "session_id": session_id,
            "status": "completed",
            "messages": messages,
        }

        pauses = [
            pause
            for task in snapshot.tasks
            for pause in task.interrupts
        ]

        if pauses:
            pause = pauses[0]

            result.update(
                {
                    "status": "approval_required",
                    "approval_id": pause.id,
                    "changes": pause.value["changes"],
                }
            )

        return result