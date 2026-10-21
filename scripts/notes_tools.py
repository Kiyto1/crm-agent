import sqlite3
from contextlib import closing
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"


def list_notes(
    customer_id: str = "",
    limit: int = 25,
    offset: int = 0,
) -> dict:
    """List saved notes from SQLite with an exact total.

    Leave customer_id empty to list notes across all customers.
    Supply an exact customer ID to list only that customer's notes.
    Use offset to retrieve additional pages.
    """

    customer_id = customer_id.strip()

    # Bound the page size and reject invalid positions.
    if not 1 <= limit <= 100:
        return {"error": "Limit must be between 1 and 100."}

    if offset < 0:
        return {"error": "Offset cannot be negative."}

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        # An empty customer ID means include every customer's notes.
        total = connection.execute(
            """
            SELECT COUNT(*)
            FROM notes
            WHERE (? = '' OR customer_id = ?)
            """,
            (customer_id, customer_id),
        ).fetchone()[0]

        # Return a page in a stable order, with customer information.
        cursor = connection.execute(
            """
            SELECT
                n.note_id,
                n.customer_id,
                c.full_name,
                c.company_name,
                n.content,
                n.created_at,
                'note:' || n.note_id AS source_id
            FROM notes AS n
            JOIN contacts AS c
              ON c.customer_id = n.customer_id
            WHERE (? = '' OR n.customer_id = ?)
            ORDER BY n.note_id ASC
            LIMIT ? OFFSET ?
            """,
            (customer_id, customer_id, limit, offset),
        )

        notes = [dict(row) for row in cursor.fetchall()]

        return {
            "total": total,
            "returned": len(notes),
            "offset": offset,
            "has_more": offset + len(notes) < total,
            "notes": notes,
        }