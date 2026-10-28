import asyncio
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from api import app as api_app
from gemini_limits import (
    require_ai_enabled,
    reserve_web_request,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "dist"

load_dotenv(PROJECT_ROOT / ".env")

SESSION_SECRET = os.getenv("SESSION_SECRET", "")

if len(SESSION_SECRET) < 32:
    raise RuntimeError(
        "Set SESSION_SECRET to a random value "
        "of at least 32 characters."
    )

if not (FRONTEND_DIR / "index.html").is_file():
    raise RuntimeError(
        "Run npm --prefix frontend run build first."
    )


class BodyLimit:
    """Reject POST bodies larger than 16 KiB before JSON parsing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Pass other requests through normally.
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
        ):
            return await self.app(scope, receive, send)

        body = bytearray()

        # Read incoming chunks while checking their combined size.
        while True:
            message = await receive()

            if message["type"] == "http.disconnect":
                return

            body.extend(message.get("body", b""))

            if len(body) > 16384:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request is too large."},
                )
                return await response(scope, receive, send)

            if not message.get("more_body", False):
                break

        delivered = False

        async def replay():
            """Pass the checked body to the application once."""

            nonlocal delivered

            if not delivered:
                delivered = True

                return {
                    "type": "http.request",
                    "body": bytes(body),
                    "more_body": False,
                }

            return await receive()

        await self.app(scope, replay, send)


app = FastAPI(
    title="CRM Demo",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# This deployment uses one process.
# Only one chat or approval request can run at a time.
turn_lock = asyncio.Lock()


@app.middleware("http")
async def protect_demo(request: Request, call_next):
    """Identify visitors and check requests before running the agent."""

    if "visitor_id" not in request.session:
        request.session["visitor_id"] = str(uuid4())

    visitor_id = request.session["visitor_id"]

    # api.py uses this identity for ownership checks.
    request.state.visitor_id = visitor_id

    is_turn = (
        request.method == "POST"
        and request.url.path in (
            "/api/chat",
            "/api/approve",
        )
    )

    if is_turn:
        content_type = request.headers.get(
            "content-type", ""
        ).split(";")[0]

        if content_type != "application/json":
            return JSONResponse(
                status_code=415,
                content={"detail": "Send application/json."},
            )

        # Reject browser requests originating from another site.
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "Cross-site requests are not allowed."
                },
            )

        # Reject extra AI work instead of building a long request queue.
        if turn_lock.locked():
            return JSONResponse(
                status_code=503,
                content={
                    "detail": (
                        "Another demo request is running. "
                        "Please try shortly."
                    )
                },
                headers={"Retry-After": "10"},
            )

    try:
        if is_turn:
            async with turn_lock:
                require_ai_enabled()

                # Use the client address supplied by the server.
                # Do not read arbitrary X-Forwarded-For headers here.
                client_ip = (
                    request.client.host
                    if request.client
                    else "unknown"
                )

                reserve_web_request(
                    visitor_id,
                    client_ip,
                )

                response = await call_next(request)

        else:
            response = await call_next(request)

    except HTTPException as error:
        response = JSONResponse(
            status_code=error.status_code,
            content={"detail": error.detail},
            headers=error.headers,
        )

    # Avoid caching private conversation responses.
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"

    return response


# This must wrap protect_demo so request.session is available.
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="crm.visitor",
    max_age=7 * 24 * 60 * 60,
    same_site="strict",
    https_only=(
        os.getenv("COOKIE_SECURE", "false").lower() == "true"
    ),
)

# Check body size before other request processing.
app.add_middleware(BodyLimit)


@app.get("/health")
def health():
    """Let the hosting service check that the server is running."""

    return {"status": "ok"}


# Frontend requests such as /api/chat reach your existing API.
app.mount("/api", api_app)

app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)


@app.get("/{path:path}")
def serve_frontend(path: str):
    """Serve React without exposing backend files."""

    if path == "api" or path.startswith(("api/", "assets/")):
        raise HTTPException(
            status_code=404,
            detail="Not found.",
        )

    requested_file = (FRONTEND_DIR / path).resolve()

    if (
        requested_file.is_relative_to(FRONTEND_DIR.resolve())
        and requested_file.is_file()
    ):
        return FileResponse(requested_file)

    return FileResponse(FRONTEND_DIR / "index.html")