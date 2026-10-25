# CRM AI Assistant

A conversational CRM application built with **React, FastAPI, Gemini, LangGraph, SQLite, and Chroma**.

The assistant can search customer records, manage tasks, save interaction notes, and retrieve relevant CRM information by meaning. Database changes require user approval.

## Screenshots
Customer Search
<img width="2559" height="1391" alt="Screenshot 2026-10-25 183653" src="https://github.com/user-attachments/assets/161cf6fe-ea06-4d56-94a9-2c7922bebe76" />
Find customers and identify overdue follow-ups through natural-language requests.

Approval Workflow
<img width="2558" height="1393" alt="Screenshot 2026-10-25 183731" src="https://github.com/user-attachments/assets/93028a37-82fb-41f8-bdc3-75f2b5be907a" />
Review proposed changes and approve or reject them before they are saved.

Customer Insights with Sources
<img width="2559" height="1391" alt="Screenshot 2026-10-25 183824" src="https://github.com/user-attachments/assets/29b9d4ed-2568-48fd-9510-ddf774706a62" />
Ask questions about customer notes and receive answers with source references.


## Features

- Search contacts by name or company.
- Retrieve complete customer records.
- Create tasks and mark them as completed.
- Find overdue tasks and contact follow-ups.
- Save and retrieve customer interaction notes.
- List saved notes with exact totals and pagination.
- Search CRM summaries and notes using semantic retrieval.
- Approve or reject proposed database changes.
- Reopen saved conversations from the sidebar.
- Restore messages and pending approvals after refreshes and backend restarts.

## Agent Tools

| Tool | What it does |
|---|---|
| `search_contacts(query)` | Finds contacts whose name or company contains the search text. |
| `get_contact_details(customer_id)` | Retrieves a customer’s complete CRM record. |
| `get_contact_tasks(customer_id)` | Lists tasks belonging to a customer. |
| `get_overdue_followups(as_of_date)` | Returns open tasks and contact follow-ups due before the specified date, with an exact total. |
| `create_task(customer_id, title, due_date)` | Creates a customer task after approval. |
| `complete_task(task_id)` | Marks an existing task as completed after approval. |
| `add_note(customer_id, content)` | Saves a customer interaction note after approval. |
| `get_contact_notes(customer_id)` | Retrieves saved notes for a specific customer. |
| `list_notes(customer_id, limit, offset)` | Lists saved notes across all customers or one customer, with pagination and an exact total. |
| `search_crm_knowledge(query)` | Retrieves up to five relevant CRM summaries or notes by meaning, including source IDs. |

## How It Works

1. React sends the user’s message to FastAPI.
2. LangGraph passes the conversation and tool descriptions to Gemini.
3. Gemini requests the tools needed to handle the message.
4. Read-only tools execute directly. Database changes pause for user approval.
5. Python executes approved operations and returns their results to Gemini.
6. Gemini generates an answer using those results.

LangGraph checkpoints preserve conversation history and pending approvals.

## RAG and Semantic Search

Contact summaries and saved notes are converted into embeddings using Google’s embedding API and stored locally in Chroma.

Before semantic search, the application synchronizes new, edited, and deleted source records. Unchanged documents reuse their existing embeddings.

Retrieved passages include source identifiers such as:

- `note:2`
- `contact:CON-21066`

Semantic search returns a limited set of candidates. Exact counts, statuses, dates, and complete note lists use SQL tools.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, Vite |
| Backend | Python, FastAPI |
| Language model | Gemini 3.5 Flash Lite |
| Agent workflow | LangGraph |
| CRM storage | SQLite |
| Conversation persistence | LangGraph SQLite checkpointer |
| Vector storage | Chroma |
| Embeddings | Gemini Embedding 001 |

## Local Setup

### Backend

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a `.env` file in the project root:

```dotenv
GOOGLE_API_KEY=your_google_api_key
```

For a fresh database, run:

```powershell
python scripts/init_db.py
python scripts/init_tasks.py
python scripts/init_notes.py
```

Start FastAPI:

```powershell
python -m uvicorn api:app --app-dir scripts --reload
```

API documentation: http://127.0.0.1:8000/docs

### Frontend

In a separate terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. Keep both servers running.

## Example Requests

- “Find contacts named Ahmed.”
- “Show the saved notes for CON-21066.”
- “List all saved notes.”
- “Which follow-ups were overdue as of 2026-10-21?”
- “Create a task for CON-21066 to send the proposal on 2026-11-01.”
- “Mark task 3 as completed.”
- “Save a note for CON-21066: Arabic onboarding materials are required.”
- “Which customers mentioned onboarding needs? Cite the sources.”

## Data and Scope

The initial dataset contains **120 synthetic CRM records**.

- `crm.db` stores contacts, tasks, and notes.
- `conversations.sqlite` stores conversation checkpoints.
- Chroma stores searchable text and embeddings.
- Browser storage remembers the selected conversation ID.

This project is a local, single-user prototype. Authentication, multi-user access controls, and public deployment are not implemented in this version.

