from threading import Lock
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from langchain_core.messages import HumanMessage
from langgraph.types import Command
from pydantic import BaseModel, Field, StrictBool

from dashboard_api import router as dashboard_router
from graph_agent import graph
from session_store import (
    save_session_owner,
    require_session_owner,
    get_visitor_sessions,
)


app = FastAPI(title="CRM Agent API")

# Dashboard pages (overview, customers, tasks) use these extra endpoints.
app.include_router(dashboard_router)

# Prevent overlapping requests from changing the shared graph state.
graph_lock = Lock()


class ChatRequest(BaseModel):
    """JSON fields accepted when sending a message."""

    # Limit message size for the public demo.
    message: str = Field(min_length=1, max_length=2000)

    # New conversations do not have a session ID yet.
    session_id: UUID | None = None


class ApprovalRequest(BaseModel):
    """Identify a pending change and provide the user's decision."""

    session_id: UUID
    approval_id: str = Field(min_length=1, max_length=200)

    # Accept only actual JSON true or false.
    approved: StrictBool


def get_visitor_id(request: Request) -> str:
    """Read the visitor identity provided by hosted.py."""

    visitor_id = getattr(request.state, "visitor_id", None)

    # Do not allow conversation access without a browser identity.
    if not visitor_id:
        raise HTTPException(
            status_code=401,
            detail="Open the CRM through the hosted application.",
        )

    return visitor_id


def graph_config(session_id: str) -> dict:
    """Connect this conversation to its LangGraph checkpoint."""

    return {
        "configurable": {
            "thread_id": session_id,
        },
        "recursion_limit": 30,
    }


def pending_approvals(config: dict) -> list:
    """Find approval pauses saved in the conversation."""

    snapshot = graph.get_state(config)

    return [
        pause
        for task in snapshot.tasks
        for pause in task.interrupts
    ]


def format_result(result: dict, session_id: str) -> dict:
    """Prepare an answer or approval proposal for the frontend."""

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
    """Check that the API is running."""

    return {"status": "ok"}


@app.post("/chat")
def chat(
    request: ChatRequest,
    visitor_id: str = Depends(get_visitor_id),
):
    """Send a message to a new or existing conversation."""

    # Depends runs get_visitor_id before this handler.
    # Its returned value becomes visitor_id.
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be blank.",
        )

    with graph_lock:
        if request.session_id:
            # Continuing an existing chat requires ownership.
            session_id = str(request.session_id)

            require_session_owner(
                session_id,
                visitor_id,
            )

        else:
            # The server creates new IDs rather than trusting a supplied ID.
            session_id = str(uuid4())

            # Link this new conversation to the current visitor.
            save_session_owner(
                session_id,
                visitor_id,
            )

        config = graph_config(session_id)

        # Resolve pending approvals before accepting another message.
        if pending_approvals(config):
            raise HTTPException(
                status_code=409,
                detail="Approve or reject the pending change first.",
            )

        # Run the graph with this message and reset the turn's call counter.
        result = graph.invoke(
            {
                "messages": [
                    HumanMessage(content=message),
                ],
                "approved": False,
                "model_calls": 0,
            },
            config=config,
        )

        return format_result(result, session_id)


@app.post("/approve")
def approve(
    request: ApprovalRequest,
    visitor_id: str = Depends(get_visitor_id),
):
    """Approve or reject changes in a conversation owned by this visitor."""

    session_id = str(request.session_id)
    config = graph_config(session_id)

    with graph_lock:
        # A visitor cannot approve changes in someone else's conversation.
        require_session_owner(
            session_id,
            visitor_id,
        )

        pauses = pending_approvals(config)

        # Reject incorrect, expired, or already-used approval IDs.
        if not pauses or pauses[0].id != request.approval_id:
            raise HTTPException(
                status_code=409,
                detail="This approval is no longer pending.",
            )

        # Continue the paused workflow with the user's decision.
        result = graph.invoke(
            Command(resume=request.approved),
            config=config,
        )

        # The graph may finish or request another approval.
        return format_result(result, session_id)


@app.get("/sessions")
def list_sessions(
    visitor_id: str = Depends(get_visitor_id),
):
    """List only this visitor's most recent conversations."""

    with graph_lock:
        # Read the conversation IDs owned by this visitor.
        allowed_sessions = get_visitor_sessions(visitor_id)

        if not allowed_sessions:
            return {"sessions": []}

        sessions = []
        seen = set()

        # Checkpoints are returned newest first.
        # A conversation can have many checkpoints.
        for checkpoint in graph.checkpointer.list(None):
            session_id = checkpoint.config["configurable"]["thread_id"]

            # Exclude conversations owned by other visitors.
            if session_id not in allowed_sessions:
                continue

            # Include each conversation only once.
            if session_id in seen:
                continue

            seen.add(session_id)

            # Skip terminal-only IDs that are not UUIDs.
            try:
                UUID(session_id)
            except (ValueError, TypeError):
                continue

            messages = checkpoint.checkpoint.get(
                "channel_values", {}
            ).get("messages", [])

            # Use the first user message as the conversation title.
            first_question = next(
                (
                    message.text
                    for message in messages
                    if message.type == "human" and message.text
                ),
                None,
            )

            # A checkpoint without a user message has no chat to display.
            if not first_question:
                continue

            sessions.append(
                {
                    "session_id": session_id,
                    "title": first_question[:80],
                    "updated_at": checkpoint.checkpoint["ts"],
                }
            )

            # Keep the sidebar response reasonably small.
            if len(sessions) >= 50:
                break

        return {"sessions": sessions}


@app.get("/sessions/{session_id}")
def get_session(
    session_id: UUID,
    visitor_id: str = Depends(get_visitor_id),
):
    """Restore an owned conversation and any pending approval."""

    session_id = str(session_id)
    config = graph_config(session_id)

    with graph_lock:
        # Check ownership before reading conversation contents.
        require_session_owner(
            session_id,
            visitor_id,
        )

        snapshot = graph.get_state(config)

        if not snapshot.values:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        # Return visible user and assistant messages.
        # Internal tool calls and tool results stay on the backend.
        messages = [
            {
                "id": message.id,
                "role": (
                    "user"
                    if message.type == "human"
                    else "assistant"
                ),
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

        # Restore the approval panel if this conversation was paused.
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