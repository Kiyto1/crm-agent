"""Deal and activity operations (needs the schema from migrate_schema.py).

Like crm_tools.py, these are plain functions. The dashboard calls them
through dashboard_api.py and the assistant calls them as tools, so both
share one implementation.
"""

import sqlite3
from contextlib import closing
from datetime import date

import crm_tools
from crm_tools import CLOSED_STAGES, STALE_AFTER_DAYS, today_riyadh
from migrate_schema import STAGES


# Ways a contact with a customer can be logged.
CHANNELS = ("Phone", "Email", "Meeting", "WhatsApp")


def connect():
    """Open the CRM database. DB_FILE is read at call time so tests can swap it."""

    connection = sqlite3.connect(crm_tools.DB_FILE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


def list_deals(
    stage: str = "",
    owner: str = "",
    stalled_only: bool = False,
) -> dict:
    """List deals with filters, plus a per-stage summary for the Deals page.

    A deal is "stalled" when it is still open and has had no contact for
    STALE_AFTER_DAYS days.
    """

    today = date.fromisoformat(today_riyadh())

    # Only the owner filter is applied in SQL. The stage and stalled filters
    # are applied afterwards so the summary can still show every stage.
    owner = owner.strip()
    where = "WHERE assigned_owner = ?" if owner else ""
    values = (owner,) if owner else ()

    with closing(connect()) as connection:
        rows = connection.execute(
            f"""
            SELECT deal_id, customer_id, full_name, company_name,
                   product_interest, deal_stage, deal_value_sar,
                   assigned_owner, last_contact_date, next_followup_date
            FROM contacts
            {where}
            ORDER BY deal_value_sar DESC
            """,
            values,
        ).fetchall()

    deals = []
    summary = {name: {"stage": name, "count": 0, "value": 0} for name in STAGES}

    for row in rows:
        deal = dict(row)

        if deal["last_contact_date"]:
            last = date.fromisoformat(deal["last_contact_date"][:10])
            deal["days_since_contact"] = (today - last).days
        else:
            deal["days_since_contact"] = None

        is_open = deal["deal_stage"] not in CLOSED_STAGES
        deal["stalled"] = is_open and (
            deal["days_since_contact"] is None
            or deal["days_since_contact"] >= STALE_AFTER_DAYS
        )

        summary[deal["deal_stage"]]["count"] += 1
        summary[deal["deal_stage"]]["value"] += deal["deal_value_sar"] or 0

        deals.append(deal)

    stalled_total = sum(1 for deal in deals if deal["stalled"])

    items = [
        deal
        for deal in deals
        if (not stage.strip() or deal["deal_stage"] == stage.strip())
        and (not stalled_only or deal["stalled"])
    ]

    return {
        "as_of": today.isoformat(),
        "stale_after_days": STALE_AFTER_DAYS,
        "summary": list(summary.values()),
        "stalled_total": stalled_total,
        "total": len(items),
        "items": items,
    }


def get_activities(customer_id: str, limit: int = 30) -> list[dict]:
    """A customer's activity history, newest first."""

    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT activity_id, kind, channel, summary, occurred_at
            FROM activities
            WHERE customer_id = ?
            ORDER BY occurred_at DESC, activity_id DESC
            LIMIT ?
            """,
            (customer_id.strip(), max(1, min(limit, 100))),
        ).fetchall()

    return [dict(row) for row in rows]


def update_deal_stage(customer_id: str, stage: str) -> dict:
    """Move a customer's deal to another stage and record the change.

    Valid stages: new, qualified, demo_scheduled, proposal_sent,
    negotiation, won, lost.
    """

    customer_id = customer_id.strip()
    stage = stage.strip()

    if stage not in STAGES:
        return {"error": f"Unknown stage: {stage}. Use one of: {', '.join(STAGES)}"}

    with closing(connect()) as connection:
        deal = connection.execute(
            "SELECT deal_id, stage FROM deals WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()

        if deal is None:
            return {"error": f"No deal found for customer: {customer_id}"}

        if deal["stage"] == stage:
            return {"error": f"The deal is already in stage {stage}."}

        # Both changes are saved together or not at all.
        with connection:
            connection.execute(
                "UPDATE deals SET stage = ? WHERE deal_id = ?",
                (stage, deal["deal_id"]),
            )
            connection.execute(
                """
                INSERT INTO activities
                    (customer_id, deal_id, kind, summary, occurred_at)
                VALUES (?, ?, 'stage_change', ?, ?)
                """,
                (
                    customer_id,
                    deal["deal_id"],
                    f"Stage changed from {deal['stage']} to {stage}.",
                    today_riyadh(),
                ),
            )

    return {
        "customer_id": customer_id,
        "deal_id": deal["deal_id"],
        "old_stage": deal["stage"],
        "new_stage": stage,
    }


def log_contact(customer_id: str, channel: str, summary: str) -> dict:
    """Record a contact with a customer (phone, email, meeting or WhatsApp).

    This becomes the customer's "last contact", so the deal is no longer
    stalled.
    """

    customer_id = customer_id.strip()
    summary = summary.strip()

    if channel not in CHANNELS:
        return {"error": f"Channel must be one of: {', '.join(CHANNELS)}"}

    if not summary:
        return {"error": "A summary is required."}

    with closing(connect()) as connection:
        deal = connection.execute(
            "SELECT deal_id FROM deals WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()

        if deal is None:
            return {"error": f"No deal found for customer: {customer_id}"}

        with connection:
            cursor = connection.execute(
                """
                INSERT INTO activities
                    (customer_id, deal_id, kind, channel, summary, occurred_at)
                VALUES (?, ?, 'contact', ?, ?, ?)
                """,
                (customer_id, deal["deal_id"], channel, summary, today_riyadh()),
            )

    return {
        "activity_id": cursor.lastrowid,
        "customer_id": customer_id,
        "channel": channel,
        "summary": summary,
        "occurred_at": today_riyadh(),
    }
