import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"


def search_contacts(query: str) -> list[dict]:
    """Find contacts by name or company."""

    query = query.strip()
    if not query:
        return []

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Match literal search text in either field.
        cursor = connection.execute(
            """
            SELECT customer_id, full_name, company_name,
                   job_title, assigned_owner, deal_stage
            FROM contacts
            WHERE instr(lower(full_name), lower(?)) > 0
               OR instr(lower(company_name), lower(?)) > 0
            """,
            (query, query),
        )

        return [dict(row) for row in cursor.fetchall()]


def get_contact_details(customer_id: str) -> dict:
    """Return a contact's complete record using their unique ID."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        contact = connection.execute(
            "SELECT * FROM contacts WHERE customer_id = ?",
            (customer_id.strip(),),
        ).fetchone()

        if contact is None:
            return {"error": f"Contact not found: {customer_id}"}

        return dict(contact)


def get_contact_tasks(customer_id: str) -> list[dict]:
    """List all tasks in the tasks table for an exact customer ID."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Include both open and completed tasks, earliest due first.
        cursor = connection.execute(
            """
            SELECT task_id, customer_id, title,
                   due_date, status, created_at
            FROM tasks
            WHERE customer_id = ?
            ORDER BY due_date ASC, task_id ASC
            """,
            (customer_id.strip(),),
        )

        return [dict(row) for row in cursor.fetchall()]


def get_overdue_followups(as_of_date: str) -> dict:
    """Return open contact follow-ups and tasks due before YYYY-MM-DD."""

    reference_date = date.fromisoformat(as_of_date.strip()).isoformat()

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Combine original contact follow-ups with separately created tasks.
        # source identifies where each result comes from.
        cursor = connection.execute(
            """
            SELECT
                'contacts' AS source,
                NULL AS task_id,
                customer_id,
                full_name,
                assigned_owner,
                next_followup_date,
                next_action
            FROM contacts
            WHERE task_status = 'Open'
              AND date(next_followup_date) < date(?)

            UNION ALL

            SELECT
                'tasks' AS source,
                t.task_id,
                t.customer_id,
                c.full_name,
                c.assigned_owner,
                t.due_date AS next_followup_date,
                t.title AS next_action
            FROM tasks AS t
            JOIN contacts AS c
              ON c.customer_id = t.customer_id
            WHERE t.status = 'Open'
              AND date(t.due_date) < date(?)

            ORDER BY next_followup_date ASC
            """,
            (reference_date, reference_date),
        )

        # Calculate the exact total before sending results to Gemini.
        items = [dict(row) for row in cursor.fetchall()]

        return {
            "as_of_date": reference_date,
            "total": len(items),
            "items": items,
        }


def create_task(customer_id: str, title: str, due_date: str) -> dict:
    """Create a customer task with a title and YYYY-MM-DD due date."""

    customer_id = customer_id.strip()
    title = title.strip()

    if not customer_id or not title:
        return {"error": "Customer ID and task title are required."}

    # Invalid dates raise ValueError before anything is saved.
    due_date = date.fromisoformat(due_date.strip()).isoformat()

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        customer = connection.execute(
            "SELECT customer_id FROM contacts WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()

        if customer is None:
            return {"error": f"Contact not found: {customer_id}"}

        # Commit the insert on success; roll back on failure.
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO tasks (customer_id, title, due_date)
                VALUES (?, ?, ?)
                """,
                (customer_id, title, due_date),
            )

        return {
            "task_id": cursor.lastrowid,
            "customer_id": customer_id,
            "title": title,
            "due_date": due_date,
            "status": "Open",
        }


def complete_task(task_id: int) -> dict:
    """Mark a task in the tasks table as completed using its task ID."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Check the task exists before updating it.
        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()

        if task is None:
            return {"error": f"Task not found: {task_id}"}

        # Repeating completion leaves an already completed task unchanged.
        with connection:
            connection.execute(
                "UPDATE tasks SET status = 'Completed' WHERE task_id = ?",
                (task_id,),
            )

        result = dict(task)
        result["status"] = "Completed"
        return result

def add_note(customer_id: str, content: str) -> dict:
    """Save an interaction note for an existing customer."""

    customer_id = customer_id.strip()
    content = content.strip()

    if not customer_id or not content:
        return {"error": "Customer ID and note content are required."}

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        # Confirm the customer exists before saving.
        customer = connection.execute(
            "SELECT customer_id FROM contacts WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()

        if customer is None:
            return {"error": f"Contact not found: {customer_id}"}

        with connection:
            cursor = connection.execute(
                """
                INSERT INTO notes (customer_id, content)
                VALUES (?, ?)
                """,
                (customer_id, content),
            )

        return {
            "note_id": cursor.lastrowid,
            "customer_id": customer_id,
            "content": content,
        }


def get_contact_notes(customer_id: str) -> list[dict]:
    """Retrieve saved interaction notes for an exact customer ID."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        cursor = connection.execute(
            """
            SELECT note_id, customer_id, content, created_at
            FROM notes
            WHERE customer_id = ?
            ORDER BY created_at DESC, note_id DESC
            """,
            (customer_id.strip(),),
        )

        return [dict(row) for row in cursor.fetchall()]
    


# ---------------------------------------------------------------
# Dashboard operations. The web pages call these through
# dashboard_api.py, and they can be added as assistant tools later,
# so the UI and the assistant share one implementation.
# ---------------------------------------------------------------

# A deal in these stages is finished, so it is not "open pipeline".
CLOSED_STAGES = ("won", "lost")

# A customer with no contact for this many days needs attention.
STALE_AFTER_DAYS = 30


def today_riyadh() -> str:
    """Today's date (YYYY-MM-DD) in Saudi Arabia, like the assistant uses."""

    return datetime.now(ZoneInfo("Asia/Riyadh")).date().isoformat()


def list_contacts(
    search: str = "",
    stage: str = "",
    owner: str = "",
    limit: int = 200,
) -> dict:
    """List customers for the table, filtered by text, stage and owner."""

    # Build the WHERE clause from only the filters that were given.
    # Values always go in as ? parameters, never into the SQL text.
    conditions = []
    values = []

    search = search.strip()
    if search:
        conditions.append(
            "(instr(lower(full_name), lower(?)) > 0"
            " OR instr(lower(company_name), lower(?)) > 0"
            " OR instr(lower(customer_id), lower(?)) > 0)"
        )
        values += [search, search, search]

    if stage.strip():
        conditions.append("deal_stage = ?")
        values.append(stage.strip())

    if owner.strip():
        conditions.append("assigned_owner = ?")
        values.append(owner.strip())

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        rows = connection.execute(
            f"""
            SELECT customer_id, full_name, company_name, industry,
                   job_title, assigned_owner, customer_status,
                   deal_stage, deal_value_sar, last_contact_date,
                   next_followup_date, next_action
            FROM contacts
            {where}
            ORDER BY company_name, full_name
            LIMIT ?
            """,
            (*values, max(1, min(limit, 500))),
        ).fetchall()

        # Cheap total so the page can say "12 customers".
        items = [dict(row) for row in rows]

    return {"as_of": today_riyadh(), "total": len(items), "items": items}


def get_filter_options() -> dict:
    """Values for the filter dropdowns, taken from the real records."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        stages = [
            row[0]
            for row in connection.execute(
                "SELECT DISTINCT deal_stage FROM contacts"
                " WHERE deal_stage IS NOT NULL ORDER BY deal_stage"
            )
        ]
        owners = [
            row[0]
            for row in connection.execute(
                "SELECT DISTINCT assigned_owner FROM contacts"
                " WHERE assigned_owner IS NOT NULL ORDER BY assigned_owner"
            )
        ]

    return {"stages": stages, "owners": owners}


def list_tasks(status: str = "") -> dict:
    """List rows of the tasks table with the customer's name attached."""

    status = status.strip()

    if status and status not in ("Open", "Completed"):
        return {"error": "Status must be Open or Completed."}

    where = "WHERE t.status = ?" if status else ""
    values = (status,) if status else ()

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Open tasks first, then the earliest due date.
        rows = connection.execute(
            f"""
            SELECT t.task_id, t.customer_id, c.full_name,
                   c.company_name, t.title, t.due_date,
                   t.status, t.created_at
            FROM tasks AS t
            JOIN contacts AS c ON c.customer_id = t.customer_id
            {where}
            ORDER BY (t.status = 'Completed'), t.due_date, t.task_id
            """,
            values,
        ).fetchall()

    items = [dict(row) for row in rows]

    return {"as_of": today_riyadh(), "total": len(items), "items": items}


def reschedule_task(task_id: int, due_date: str) -> dict:
    """Move an open task to a new YYYY-MM-DD due date."""

    # Invalid dates raise ValueError before anything is saved.
    due_date = date.fromisoformat(due_date.strip()).isoformat()

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()

        if task is None:
            return {"error": f"Task not found: {task_id}"}

        if task["status"] != "Open":
            return {"error": "Only open tasks can be rescheduled."}

        with connection:
            connection.execute(
                "UPDATE tasks SET due_date = ? WHERE task_id = ?",
                (due_date, task_id),
            )

        result = dict(task)
        result["due_date"] = due_date
        return result


def get_overview() -> dict:
    """Dashboard numbers, all calculated from the current records."""

    today = today_riyadh()
    stale_before = (
        date.fromisoformat(today) - timedelta(days=STALE_AFTER_DAYS)
    ).isoformat()

    # "?, ?" placeholders for the closed stages, so no SQL is built from text.
    closed = ",".join("?" for _ in CLOSED_STAGES)

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # Deals and value per stage (NULL values count as 0).
        stages = [
            dict(row)
            for row in connection.execute(
                """
                SELECT deal_stage AS stage,
                       COUNT(*) AS count,
                       COALESCE(SUM(deal_value_sar), 0) AS value
                FROM contacts
                WHERE deal_stage IS NOT NULL
                GROUP BY deal_stage
                """
            )
        ]

        open_stages = [x for x in stages if x["stage"] not in CLOSED_STAGES]
        won = next((x for x in stages if x["stage"] == "won"), None)

        open_tasks = connection.execute(
            "SELECT COUNT(*) FROM tasks WHERE status = 'Open'"
        ).fetchone()[0]

        # Open deals that are late for a follow-up or have gone quiet.
        attention_rows = connection.execute(
            f"""
            SELECT customer_id, full_name, company_name, deal_stage,
                   deal_value_sar, last_contact_date, next_followup_date
            FROM contacts
            WHERE deal_stage NOT IN ({closed})
              AND (date(next_followup_date) < date(?)
                   OR date(last_contact_date) < date(?))
            ORDER BY next_followup_date IS NULL,
                     next_followup_date ASC,
                     last_contact_date ASC
            """,
            (*CLOSED_STAGES, today, stale_before),
        ).fetchall()

        # Newest notes, tasks and customer contacts, mixed into one feed.
        activity = [
            dict(row)
            for row in connection.execute(
                """
                SELECT * FROM (
                    SELECT 'note' AS kind, n.customer_id, c.full_name,
                           n.content AS text, n.created_at AS happened_at
                    FROM notes AS n
                    JOIN contacts AS c ON c.customer_id = n.customer_id

                    UNION ALL

                    SELECT 'task', t.customer_id, c.full_name,
                           t.title, t.created_at
                    FROM tasks AS t
                    JOIN contacts AS c ON c.customer_id = t.customer_id

                    UNION ALL

                    SELECT 'contact', customer_id, full_name,
                           last_interaction_summary, last_contact_date
                    FROM contacts
                    WHERE last_contact_date IS NOT NULL
                )
                ORDER BY happened_at DESC
                LIMIT 8
                """
            )
        ]

    # Say why each customer needs attention (computed here, not stored).
    attention = []
    for row in attention_rows[:8]:
        item = dict(row)
        followup = item["next_followup_date"]
        if followup and followup < today:
            days = (date.fromisoformat(today) - date.fromisoformat(followup)).days
            item["reason"] = f"Follow-up overdue by {days} days"
        else:
            item["reason"] = f"No contact for over {STALE_AFTER_DAYS} days"
        attention.append(item)

    return {
        "as_of": today,
        "pipeline": {
            "open_value": sum(x["value"] for x in open_stages),
            "open_count": sum(x["count"] for x in open_stages),
            "won_value": won["value"] if won else 0,
            "won_count": won["count"] if won else 0,
            "stages": stages,
        },
        # Same function the assistant uses, so both show the same number.
        "overdue_followups": get_overdue_followups(today)["total"],
        "open_tasks": open_tasks,
        "attention": {"total": len(attention_rows), "items": attention},
        "recent_activity": activity,
    }

       
if __name__ == "__main__":
    # Read-only test: running this file no longer creates duplicate tasks.
    tasks = get_contact_tasks("CON-21066")

    for task in tasks:
        print(task)

    print(f"\nTotal tasks: {len(tasks)}")
