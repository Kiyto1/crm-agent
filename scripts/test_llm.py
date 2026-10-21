from pathlib import Path

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI


PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load the API key from the project's .env file.
load_dotenv(PROJECT_ROOT / ".env")

# Configure our connection to Gemini.
llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    vertexai=False,
)

# Send a message and receive the model's response.
response = llm.invoke("Explain what a CRM is in brief.")

print(response.text)