# Python's built-in library for working with SQLite databases.
import sqlite3

# closing() closes the connection when finished.
# contextmanager lets us create our own "with" block.
from contextlib import closing, contextmanager

# Build file paths that work on Windows and Linux.
from pathlib import Path

# Return an HTTP error when someone requests a chat they do not own.
from fastapi import HTTPException


# Move from this file to scripts/, then to the project root.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Store conversation ownership separately from the conversation messages.
OWNERS_FILE = PROJECT_ROOT / "data" / "session_owners.sqlite"


@contextmanager
def session_database():
    """Open the ownership database and close it after use."""

    # Create the data folder if it does not exist.
    OWNERS_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Open the database, creating the file if necessary.
    # Wait up to 10 seconds if another connection has locked it.
    # closing() guarantees the connection is closed afterward.
    with closing(sqlite3.connect(OWNERS_FILE, timeout=10)) as connection:

        # Commit changes if successful; roll back if an error occurs.
        with connection:

            # Create the table only if it does not already exist.
            # PRIMARY KEY ensures each conversation has only one owner.
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS session_owners (
                    session_id TEXT PRIMARY KEY,
                    visitor_id TEXT NOT NULL
                )
                """
            )

            # Hand the connection to the code inside:
            # with session_database() as connection:
            # Cleanup happens after that code finishes.
            yield connection


def save_session_owner(session_id: str, visitor_id: str):
    """Record the owner when a new conversation is created."""

    # Use our connection helper to open and close the database.
    with session_database() as connection:

        # Save the conversation ID together with its owner's visitor ID.
        # The ? placeholders pass values safely as SQL parameters.
        connection.execute(
            """
            INSERT INTO session_owners (session_id, visitor_id)
            VALUES (?, ?)
            """,
            (session_id, visitor_id),
        )


def require_session_owner(session_id: str, visitor_id: str):
    """Reject access unless this visitor owns the conversation."""

    with session_database() as connection:

        # Find the owner of the requested conversation.
        # fetchone() returns one row, or None when no row matches.
        owner = connection.execute(
            """
            SELECT visitor_id
            FROM session_owners
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    # owner[0] contains the stored visitor ID.
    # If owner is None, Python stops at the first condition,
    # so it does not attempt to access owner[0].
    if owner is None or owner[0] != visitor_id:

        # Use the same response for missing chats and someone else's chats.
        # This avoids revealing whether another visitor's chat exists.
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    # If ownership matches, the function finishes normally.
    # The API can then continue processing the request.


def get_visitor_sessions(visitor_id: str) -> set[str]:
    """Return the conversation IDs belonging to this visitor."""

    with session_database() as connection:

        # Retrieve every conversation owned by this visitor.
        # fetchall() returns a list of matching rows.
        rows = connection.execute(
            """
            SELECT session_id
            FROM session_owners
            WHERE visitor_id = ?
            """,
            (visitor_id,),
        ).fetchall()

    # Each row contains one value: its session ID.
    # Build a set for quick ownership checks when filtering the sidebar.
    return {row[0] for row in rows}