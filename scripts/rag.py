import sqlite3
import time
from contextlib import closing
from functools import lru_cache
from pathlib import Path
from threading import RLock

from dotenv import load_dotenv
from langchain_core.documents import Document

from demo_embeddings import DemoEmbeddings
from gemini_limits import DemoLimitError


# Locate the project and its CRM database.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"

# Load the Gemini key and other server configuration.
load_dotenv(PROJECT_ROOT / ".env")

# Prevent overlapping synchronization and searches.
# RLock allows search_crm_knowledge() to call index_crm_data()
# while both functions use the same lock.
sync_lock = RLock()


@lru_cache(maxsize=1)
def get_vector_store():
    """Create Chroma with budget-controlled Gemini embeddings."""

    # Import Chroma only when the vector store is first needed.
    from langchain_chroma import Chroma

    # DemoEmbeddings checks usage before contacting Gemini.
    # lru_cache keeps this store available for later searches.
    return Chroma(
        collection_name="crm_knowledge",
        persist_directory=str(
            PROJECT_ROOT / "data" / "chroma"
        ),
        embedding_function=DemoEmbeddings(),
    )


def load_crm_documents() -> list[Document]:
    """Build searchable documents from the current SQLite records."""

    with closing(sqlite3.connect(DB_FILE)) as connection:
        # Allow database columns to be accessed by name.
        connection.row_factory = sqlite3.Row

        # Retrieve the text used for customer semantic search.
        contacts = connection.execute(
            """
            SELECT customer_id, full_name, company_name,
                   business_need, last_interaction_summary
            FROM contacts
            ORDER BY customer_id
            """
        ).fetchall()

        # Join saved notes with their customer information.
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

    # Keep each customer summary as one searchable document.
    for contact in contacts:
        documents.append(
            Document(
                page_content=(
                    f"Customer: {contact['full_name']}\n"
                    f"Company: {contact['company_name']}\n"
                    f"Business need: "
                    f"{contact['business_need'] or ''}\n"
                    f"Last interaction: "
                    f"{contact['last_interaction_summary'] or ''}"
                ),
                metadata={
                    "customer_id": contact["customer_id"],
                    "source_id": (
                        f"contact:{contact['customer_id']}"
                    ),
                    "source": "contact_summary",
                },
            )
        )

    # Keep notes separate so answers can cite individual note IDs.
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
    """Retry temporary Google quota errors up to three attempts."""

    for attempt in range(3):
        try:
            return operation()

        except DemoLimitError:
            # Our application budget is exhausted.
            # Do not retry or attempt to bypass that limit.
            raise

        except Exception as error:
            # Other errors, or the final failed attempt, stop here.
            if "429" not in str(error) or attempt == 2:
                raise

            # A temporary Google quota error may clear after waiting.
            print(
                "Google embedding rate limit reached. "
                "Waiting 60 seconds..."
            )
            time.sleep(60)


def index_crm_data() -> dict:
    """Synchronize new, edited, and deleted records with Chroma."""

    with sync_lock:
        store = get_vector_store()
        documents = load_crm_documents()

        # Reading existing text and metadata does not call Gemini.
        stored = store.get(
            include=["documents", "metadatas"],
        )

        # Create a lookup of documents already in Chroma.
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

            # Embed only new documents or documents whose content changed.
            # Unchanged documents reuse their existing vectors.
            if (
                previous is None
                or previous["text"] != document.page_content
                or previous["metadata"] != document.metadata
            ):
                pending.append(document)

        # Process changes in batches to reduce quota pressure.
        for start in range(0, len(pending), 20):
            batch = pending[start:start + 20]

            # Chroma calls DemoEmbeddings for these documents.
            # The embedding budget is checked before contacting Gemini.
            retry_rate_limit(
                lambda: store.add_documents(
                    documents=batch,
                    ids=[
                        document.metadata["source_id"]
                        for document in batch
                    ],
                )
            )

            completed = min(
                start + 20,
                len(pending),
            )

            print(
                f"RAG sync: indexed "
                f"{completed}/{len(pending)} changes"
            )

            # Pause only when another batch remains.
            if start + 20 < len(pending):
                time.sleep(20)

        # Remove vectors whose source records no longer exist.
        obsolete_ids = sorted(
            set(existing) - current_ids
        )

        if obsolete_ids:
            store.delete(ids=obsolete_ids)

        return {
            "total_documents": len(documents),
            "updated_documents": len(pending),
            "removed_documents": len(obsolete_ids),
        }


def search_crm_knowledge(query: str) -> list[dict]:
    """Find up to five relevant customer summaries or saved notes.

    Synchronizes SQLite records before searching.
    Results are candidates, not a complete list or an exact count.
    """

    query = query.strip()

    if not query:
        return []

    with sync_lock:
        # Include new notes and synchronize edited or deleted records.
        summary = index_crm_data()

        if summary["total_documents"] == 0:
            return []

        store = get_vector_store()

        # DemoEmbeddings also counts the query's embedding.
        # Chroma compares its vector with the stored document vectors.
        documents = retry_rate_limit(
            lambda: store.similarity_search(
                query,
                k=5,
            )
        )

        # Return the retrieved text and its exact source reference.
        return [
            {
                "text": document.page_content,
                "customer_id": document.metadata["customer_id"],
                "source_id": document.metadata["source_id"],
            }
            for document in documents
        ]


if __name__ == "__main__":
    # Allow manual synchronization from the terminal.
    print(index_crm_data())