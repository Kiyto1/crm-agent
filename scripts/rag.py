import sqlite3
import time
from contextlib import closing
from functools import lru_cache
from pathlib import Path
from threading import RLock

from dotenv import load_dotenv
from langchain_core.documents import Document


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"

load_dotenv(PROJECT_ROOT / ".env")

# Prevent overlapping synchronization and searches in this process.
sync_lock = RLock()


@lru_cache(maxsize=1)
def get_vector_store():
    """Create the embedding connection and local Chroma store when needed."""

    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    embeddings = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
    )

    return Chroma(
        collection_name="crm_knowledge",
        persist_directory=str(PROJECT_ROOT / "data" / "chroma"),
        embedding_function=embeddings,
    )


def load_crm_documents() -> list[Document]:
    """Build searchable documents from the current SQLite records."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        contacts = connection.execute(
            """
            SELECT customer_id, full_name, company_name,
                   business_need, last_interaction_summary
            FROM contacts
            ORDER BY customer_id
            """
        ).fetchall()

        notes = connection.execute(
            """
            SELECT n.note_id, n.customer_id, n.content,
                   c.full_name, c.company_name
            FROM notes AS n
            JOIN contacts AS c
              ON c.customer_id = n.customer_id
            ORDER BY n.note_id
            """
        ).fetchall()

    documents = []

    # Keep each contact summary as one document.
    for contact in contacts:
        documents.append(
            Document(
                page_content=(
                    f"Customer: {contact['full_name']}\n"
                    f"Company: {contact['company_name']}\n"
                    f"Business need: {contact['business_need'] or ''}\n"
                    f"Last interaction: "
                    f"{contact['last_interaction_summary'] or ''}"
                ),
                metadata={
                    "customer_id": contact["customer_id"],
                    "source_id": f"contact:{contact['customer_id']}",
                    "source": "contact_summary",
                },
            )
        )

    # Keep notes separate so answers can cite their exact IDs.
    for note in notes:
        documents.append(
            Document(
                page_content=(
                    f"Customer: {note['full_name']}\n"
                    f"Company: {note['company_name']}\n"
                    f"Note: {note['content']}"
                ),
                metadata={
                    "customer_id": note["customer_id"],
                    "source_id": f"note:{note['note_id']}",
                    "source": "saved_note",
                },
            )
        )

    return documents


def retry_rate_limit(operation):
    """Retry temporary quota errors, with at most three attempts."""

    for attempt in range(3):
        try:
            return operation()
        except Exception as error:
            if "429" not in str(error) or attempt == 2:
                raise

            print("Embedding rate limit reached. Waiting 60 seconds...")
            time.sleep(60)


def index_crm_data() -> dict:
    """Synchronize new, edited, and deleted source records with Chroma."""

    with sync_lock:
        store = get_vector_store()
        documents = load_crm_documents()

        # Reading stored text and metadata does not request embeddings.
        stored = store.get(
            include=["documents", "metadatas"],
        )

        existing = {
            document_id: {
                "text": text,
                "metadata": metadata,
            }
            for document_id, text, metadata in zip(
                stored["ids"],
                stored["documents"],
                stored["metadatas"],
            )
        }

        pending = []
        current_ids = set()

        for document in documents:
            document_id = document.metadata["source_id"]
            current_ids.add(document_id)

            previous = existing.get(document_id)

            # Reuse existing embeddings when the source has not changed.
            if (
                previous is None
                or previous["text"] != document.page_content
                or previous["metadata"] != document.metadata
            ):
                pending.append(document)

        # Update changed documents in paced batches.
        for start in range(0, len(pending), 20):
            batch = pending[start:start + 20]

            retry_rate_limit(
                lambda: store.add_documents(
                    documents=batch,
                    ids=[
                        document.metadata["source_id"]
                        for document in batch
                    ],
                )
            )

            completed = min(start + 20, len(pending))
            print(f"RAG sync: indexed {completed}/{len(pending)} changes")

            if start + 20 < len(pending):
                time.sleep(20)

        # Remove documents whose SQLite source records were deleted.
        obsolete_ids = sorted(set(existing) - current_ids)

        if obsolete_ids:
            store.delete(ids=obsolete_ids)

        return {
            "total_documents": len(documents),
            "updated_documents": len(pending),
            "removed_documents": len(obsolete_ids),
        }


def search_crm_knowledge(query: str) -> list[dict]:
    """Find up to five relevant CRM summaries or notes by meaning.

    Synchronizes SQLite source records before searching.
    Results are candidates, not an exhaustive list or exact count.
    """

    query = query.strip()

    if not query:
        return []

    with sync_lock:
        # Include new notes and refresh edits automatically.
        summary = index_crm_data()

        if summary["total_documents"] == 0:
            return []

        store = get_vector_store()

        documents = retry_rate_limit(
            lambda: store.similarity_search(query, k=5)
        )

        return [
            {
                "text": document.page_content,
                "customer_id": document.metadata["customer_id"],
                "source_id": document.metadata["source_id"],
            }
            for document in documents
        ]


if __name__ == "__main__":
    print(index_crm_data())