import sqlite3
import time
from contextlib import closing
from pathlib import Path

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"

load_dotenv(PROJECT_ROOT / ".env")

# Generate text embeddings using Google's API.
embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-001",
)

# Keep documents and their vectors in a local persistent database.
vector_store = Chroma(
    collection_name="crm_knowledge",
    persist_directory=str(PROJECT_ROOT / "data" / "chroma"),
    embedding_function=embeddings,
)


def index_crm_data():
    """Index new contact summaries and saved notes for semantic search."""

    documents = []
    ids = []

    # Read the source records from SQLite.
    with closing(sqlite3.connect(DB_FILE)) as connection:
        connection.row_factory = sqlite3.Row

        contacts = connection.execute(
            """
            SELECT customer_id, full_name, company_name,
                   business_need, last_interaction_summary
            FROM contacts
            """
        ).fetchall()

        notes = connection.execute(
            """
            SELECT n.note_id, n.customer_id, n.content,
                   c.full_name, c.company_name
            FROM notes AS n
            JOIN contacts AS c
              ON c.customer_id = n.customer_id
            """
        ).fetchall()

    # Turn each contact summary into a searchable document.
    for contact in contacts:
        source_id = f"contact:{contact['customer_id']}"

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
                    "source_id": source_id,
                    "source": "contact_summary",
                },
            )
        )
        ids.append(source_id)

    # Keep each saved note separate so results can cite its source.
    for note in notes:
        source_id = f"note:{note['note_id']}"

        documents.append(
            Document(
                page_content=(
                    f"Customer: {note['full_name']}\n"
                    f"Company: {note['company_name']}\n"
                    f"Note: {note['content']}"
                ),
                metadata={
                    "customer_id": note["customer_id"],
                    "source_id": source_id,
                    "source": "saved_note",
                },
            )
        )
        ids.append(source_id)

    if not documents:
        print("No documents to index.")
        return

    # Reuse documents successfully indexed during previous runs.
    existing_ids = set(vector_store.get(ids=ids)["ids"])

    pending = [
        (document, document_id)
        for document, document_id in zip(documents, ids)
        if document_id not in existing_ids
    ]

    print(f"Already indexed: {len(existing_ids)}")
    print(f"Remaining: {len(pending)}")

    # Add new documents in batches and pause between batches.
    for start in range(0, len(pending), 20):
        batch = pending[start:start + 20]

        # Retry temporary rate-limit errors up to two times.
        for attempt in range(3):
            try:
                vector_store.add_documents(
                    documents=[document for document, _ in batch],
                    ids=[document_id for _, document_id in batch],
                )
                break
            except Exception as error:
                # Other errors, or a third failed attempt, stop the script.
                if "429" not in str(error) or attempt == 2:
                    raise

                print("Rate limit reached. Waiting 60 seconds...")
                time.sleep(60)

        completed = min(start + 20, len(pending))
        print(f"Indexed {completed}/{len(pending)} new documents")

        if start + 20 < len(pending):
            time.sleep(20)

    print("Indexing complete.")


def search_crm_knowledge(query: str) -> list[dict]:
    """Find up to five relevant CRM summaries or notes by meaning.

    Use for customer needs, requests, and conversation topics.
    Results are candidates, not an exhaustive list or exact count.
    """

    query = query.strip()
    if not query:
        return []

    # Convert the question into a vector and find similar documents.
    documents = vector_store.similarity_search(query, k=5)

    return [
        {
            "text": document.page_content,
            "customer_id": document.metadata["customer_id"],
            "source_id": document.metadata["source_id"],
        }
        for document in documents
    ]


if __name__ == "__main__":
    index_crm_data()