import sqlite3
from contextlib import closing
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"


if __name__ == "__main__":
    with closing(sqlite3.connect(DB_FILE)) as connection:
        with connection:
            # Each customer can have multiple interaction notes.
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS notes (
                    note_id INTEGER PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES contacts(customer_id)
                )
                """
            )

    print("Notes table ready.")