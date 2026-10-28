import os

from google import genai
from google.genai import types
from langchain_core.embeddings import Embeddings

from gemini_limits import reserve_embedding_inputs


class DemoEmbeddings(Embeddings):
    """Generate Gemini embeddings within the demo's usage budget."""

    def __init__(self):
        # Keep the same embedding model as your existing Chroma collection.
        self.model = os.getenv(
            "GEMINI_EMBEDDING_MODEL",
            "gemini-embedding-001",
        )

        # The key stays on the backend.
        # One attempt disables the SDK's automatic retries.
        self.client = genai.Client(
            api_key=os.environ["GOOGLE_API_KEY"],
            vertexai=False,
            http_options=types.HttpOptions(
                timeout=30000,
                retry_options=types.HttpRetryOptions(
                    attempts=1,
                ),
            ),
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed source documents in batches of up to 20."""

        vectors = []

        for start in range(0, len(texts), 20):
            batch = texts[start:start + 20]

            # Count every text, even though several share one request.
            reserve_embedding_inputs(len(batch))

            response = self.client.models.embed_content(
                model=self.model,
                contents=[
                    {"parts": [{"text": text}]}
                    for text in batch
                ],
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                ),
            )

            # Chroma expects a list of numeric vectors.
            vectors.extend(
                list(item.values)
                for item in response.embeddings
            )

        return vectors

    def embed_query(self, text: str) -> list[float]:
        """Embed a search question for similarity search."""

        reserve_embedding_inputs(1)

        response = self.client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
            ),
        )

        return list(response.embeddings[0].values)