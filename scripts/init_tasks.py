import sqlite3
from contextlib import closing
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"


if __name__ == "__main__":
    with closing(sqlite3.connect(DB_FILE)) as connection:
        # Commit the schema changes if everything succeeds.
        with connection:
            # Allow tasks to reference a unique customer ID.
            connection.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_customer_id
                ON contacts(customer_id)
                """
            )

            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id INTEGER PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    due_date TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Open'
                        CHECK (status IN ('Open', 'Completed')),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES contacts(customer_id)
                )
                """
            )

    print("Tasks table ready.")