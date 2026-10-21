import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path


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
    
       
if __name__ == "__main__":
    # Read-only test: running this file no longer creates duplicate tasks.
    tasks = get_contact_tasks("CON-21066")

    for task in tasks:
        print(task)

    print(f"\nTotal tasks: {len(tasks)}")