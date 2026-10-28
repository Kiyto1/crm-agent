import hashlib
import os
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException


PROJECT_ROOT = Path(__file__).resolve().parent.parent
USAGE_FILE = PROJECT_ROOT / "data" / "gemini_usage.sqlite"


class DemoLimitError(HTTPException):
    """Identify limits enforced by our application."""


def reserve_budget(
    bucket: str,
    per_minute: int,
    per_day: int,
    units: int = 1,
):
    """Check and count usage before allowing an operation."""

    now = time.time()

    # Daily counters reset at midnight UTC.
    day_start = (
        datetime.fromtimestamp(now, timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .timestamp()
    )

    USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)

    with closing(sqlite3.connect(USAGE_FILE, timeout=10)) as connection:
        with connection:
            # Prevent simultaneous requests from bypassing the counter.
            connection.execute("BEGIN IMMEDIATE")

            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS gemini_requests (
                    created_at REAL NOT NULL
                )
                """
            )

            # Upgrade the earlier table without deleting its usage records.
            columns = {
                row[1]
                for row in connection.execute(
                    "PRAGMA table_info(gemini_requests)"
                )
            }

            if "bucket" not in columns:
                connection.execute(
                    """
                    ALTER TABLE gemini_requests
                    ADD COLUMN bucket TEXT NOT NULL DEFAULT 'chat'
                    """
                )

            if "units" not in columns:
                connection.execute(
                    """
                    ALTER TABLE gemini_requests
                    ADD COLUMN units INTEGER NOT NULL DEFAULT 1
                    """
                )

            # Each bucket tracks a separate kind of usage.
            minute_count = connection.execute(
                """
                SELECT COALESCE(SUM(units), 0)
                FROM gemini_requests
                WHERE bucket = ? AND created_at >= ?
                """,
                (bucket, now - 60),
            ).fetchone()[0]

            day_count = connection.execute(
                """
                SELECT COALESCE(SUM(units), 0)
                FROM gemini_requests
                WHERE bucket = ? AND created_at >= ?
                """,
                (bucket, day_start),
            ).fetchone()[0]

            if day_count + units > per_day:
                raise DemoLimitError(
                    status_code=429,
                    detail=(
                        "The demo reached its daily limit. "
                        "Please try tomorrow."
                    ),
                )

            if minute_count + units > per_minute:
                raise DemoLimitError(
                    status_code=429,
                    detail=(
                        "The demo is busy. "
                        "Please try again in one minute."
                    ),
                    headers={"Retry-After": "60"},
                )

            # Reserve usage before the operation.
            # Failed attempts count too.
            connection.execute(
                """
                INSERT INTO gemini_requests (
                    created_at, bucket, units
                )
                VALUES (?, ?, ?)
                """,
                (now, bucket, units),
            )

            # Keep today's records and the previous minute.
            connection.execute(
                """
                DELETE FROM gemini_requests
                WHERE created_at < ?
                """,
                (min(day_start, now - 60),),
            )


def require_ai_enabled():
    """Allow the owner to pause AI requests through configuration."""

    if os.getenv("AI_ENABLED", "true").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="The AI demo is temporarily paused.",
        )


def reserve_gemini_call():
    """Limit chat-model call attempts across the entire demo."""

    require_ai_enabled()

    reserve_budget(
        bucket="chat",
        per_minute=8,
        per_day=100,
    )


def reserve_embedding_inputs(count: int):
    """Limit how many texts are sent for embedding."""

    require_ai_enabled()

    reserve_budget(
        bucket="embedding",
        per_minute=80,
        per_day=500,
        units=count,
    )


def reserve_web_request(visitor_id: str, client_ip: str):
    """Limit chat and approval requests before they reach the agent."""

    # Store a hash of the IP rather than its plain-text value.
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    reserve_budget(
        bucket=f"visitor:{visitor_id}",
        per_minute=4,
        per_day=20,
    )

    reserve_budget(
        bucket=f"ip:{ip_hash}",
        per_minute=8,
        per_day=60,
    )

    # Clearing cookies or changing IPs cannot reset this global budget.
    reserve_budget(
        bucket="web-global",
        per_minute=20,
        per_day=60,
    )