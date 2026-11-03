# CRM AI Assistant

A CRM web app with a built-in AI assistant, built with **React, FastAPI, Gemini, LangGraph, SQLite, and Chroma**.

Use the dashboard to browse customers, deals, and tasks, or ask the assistant in plain language. The assistant searches CRM records, finds overdue follow-ups and stalled deals, retrieves notes by meaning, and proposes changes. **Every database change made by the assistant waits for your approval.**

## Features

**Assistant**
- Search contacts by name or company and open complete customer records.
- Find overdue follow-ups and inactive customers, with exact totals.
- Create, complete, and reschedule tasks.
- Save and list customer notes, with pagination and exact totals.
- Move a deal to another stage and log calls, emails, meetings, and WhatsApp contacts.
- Search summaries and notes by meaning, with source references such as `note:2`.
- Approve or reject proposed changes before anything is saved.
- Reopen past conversations from the sidebar. Messages and pending approvals survive page refreshes and backend restarts.

**Dashboard**
- **Overview:** open and won pipeline value, deals by stage, overdue follow-ups, open tasks, customers needing attention, and recent activity.
- **Customers:** search, stage and owner filters, and a detail drawer with notes, tasks, and activity history.
- **Deals:** per-stage summary with stage, owner, and stalled filters.
- **Tasks:** open and completed tasks, with create, complete, and reschedule actions.
- **Assistant panel:** the assistant sits beside the dashboard, and the dashboard refreshes after approved changes.

Dashboard actions are performed directly by the user, so they do not go through the approval step. The approval step applies to changes proposed by the assistant.

## Assistant Tools

The assistant can only run the functions registered in `scripts/graph_agent.py`.

| Tool | Type | What it does |
|---|---|---|
| `search_contacts(query)` | Read | Finds contacts whose name or company contains the text. |
| `get_contact_details(customer_id)` | Read | Returns a customer's complete record. |
| `get_contact_tasks(customer_id)` | Read | Lists a customer's tasks. |
| `get_contact_notes(customer_id)` | Read | Lists a customer's saved notes. |
| `list_notes(customer_id, limit, offset)` | Read | Lists notes across all customers or one customer, with pagination and an exact total. |
| `get_overdue_followups(as_of_date)` | Read | Returns open contact follow-ups and tasks due before the date, with an exact total. |
| `find_inactive_contacts(days)` | Read | Returns open deals with no contact in the last N days (default 30), with an exact total. |
| `search_crm_knowledge(query)` | Read | Retrieves up to five relevant summaries or notes by meaning, with source IDs. |
| `create_task(customer_id, title, due_date)` | Write | Creates a task. |
| `complete_task(task_id)` | Write | Marks a task as completed. |
| `reschedule_task(task_id, due_date)` | Write | Moves an open task to a new due date. |
| `add_note(customer_id, content)` | Write | Saves an interaction note. |
| `update_deal_stage(customer_id, stage)` | Write | Moves a deal to another stage and records the change. |
| `log_contact(customer_id, channel, summary)` | Write | Records a contact (Phone, Email, Meeting, or WhatsApp). |

Write tools require approval. Deal stages are `new`, `qualified`, `demo_scheduled`, `proposal_sent`, `negotiation`, `won`, and `lost`. A deal is **stalled** when it is still open and has had no contact for 30 days.

## How It Works

1. React sends the message to FastAPI (`POST /api/chat`).
2. LangGraph passes the conversation and tool descriptions to Gemini.
3. Gemini replies with an answer or requests tools.
4. Read-only tools run immediately. If the model requests any write tool, the graph pauses and the proposed changes are shown for approval.
5. The user approves or rejects (`POST /api/approve`). Approved changes are executed by Python, and a rejection is reported to the model as cancelled.
6. Gemini writes the final answer from the tool results.

Safeguards:
- Approval is enforced in code, in both the routing step and the tool-execution step, not only in the prompt.
- Approval applies to one batch of tool calls and is reset afterwards.
- Each user turn is limited to five model calls.
- Retrieved records and notes are treated as data, not instructions.

LangGraph checkpoints in SQLite keep conversation history and pending approvals.

## RAG and Semantic Search

Customer summaries and saved notes are converted into embeddings with Google's embedding API and stored locally in Chroma.

Before each semantic search, the app synchronizes Chroma with SQLite. New and edited records are embedded, deleted records are removed, and unchanged records reuse their existing vectors.

Retrieved passages carry source identifiers, such as `note:2` or `contact:CON-21066`.

Semantic search returns a limited set of candidates. Exact counts, statuses, dates, and complete lists come from SQL tools.

## Data Model

The seed data is **120 synthetic customer records** from `data/saudi_crm_customers_synthetic.csv`. On first start, the app imports the CSV and migrates it into a normalized schema.

```
companies ──< people ──< activities
                │
                ├──── deals   (one per person)
                ├──< tasks
                └──< notes
```

| Table | Contents |
|---|---|
| `companies` | Company name, industry, size, city, country |
| `people` | Customers: name, job title, email, owner, status |
| `deals` | One deal per customer: stage, value (SAR), product, next follow-up |
| `activities` | Contact history and stage changes |
| `tasks` | Customer tasks (`Open` or `Completed`) |
| `notes` | Saved interaction notes |
| `contacts` (view) | Flat view joining the tables above, used by the assistant, search, and dashboard |

Other data files:
- `data/crm.db`: CRM data.
- `data/conversations.sqlite`: LangGraph conversation checkpoints.
- `data/session_owners.sqlite`: which visitor owns which conversation.
- `data/gemini_usage.sqlite`: usage counters for the rate limits.
- `data/chroma/`: vector store.

## Project Structure

```
crm-agent/
├── scripts/
│   ├── hosted.py            Entry point: sessions, limits, security headers, serves the React build
│   ├── api.py               Assistant endpoints (/chat, /approve, /sessions)
│   ├── dashboard_api.py     Dashboard endpoints (overview, customers, deals, tasks)
│   ├── graph_agent.py       LangGraph agent, tool registry, approval step
│   ├── crm_tools.py         Customer, task, note, and overview functions
│   ├── deals.py             Deal stage and activity functions
│   ├── notes_tools.py       Paginated note listing
│   ├── rag.py               Chroma sync and semantic search
│   ├── demo_embeddings.py   Gemini embeddings with usage budgets
│   ├── gemini_limits.py     Rate limits and daily budgets
│   ├── session_store.py     Conversation ownership
│   ├── migrate_schema.py    Flat table to normalized schema migration
│   ├── start_demo.py        Prepares data and starts the server
│   └── init_*.py            Database setup scripts
├── frontend/                React app (Vite)
├── tests/                   Schema migration and deal tests
├── data/                    Seed CSV and runtime databases
├── Dockerfile
└── compose.yaml
```

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, Vite |
| Backend | Python, FastAPI, Pydantic, uvicorn |
| Language model | Gemini 3.5 Flash Lite |
| Agent workflow | LangGraph |
| CRM storage | SQLite |
| Conversation persistence | LangGraph SQLite checkpointer |
| Vector storage | Chroma |
| Embeddings | Gemini Embedding 001 |
| Deployment | Docker, Docker Compose |

## Local Setup

Requirements: Python 3.12 or newer, Node.js, and a Google API key for Gemini.

### 1. Backend dependencies

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### 2. Environment file

Create a `.env` file in the project root:

```dotenv
GOOGLE_API_KEY=your_google_api_key
SESSION_SECRET=a_random_value_of_at_least_32_characters
```

Generate a secret with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3. Build the frontend

The server serves the built React app and will not start without it:

```powershell
cd frontend
npm ci
npm run build
cd ..
```

### 4. Start the app

```powershell
python scripts/start_demo.py
```

On the first run this creates `data/crm.db` from the seed CSV and migrates it to the current schema. Existing data is kept on later runs.

Open http://127.0.0.1:8000.

### Frontend development with hot reload

Keep the backend running, then in a second terminal:

```powershell
cd frontend
npm run dev
```

Open the URL printed by Vite. Vite forwards `/api` requests to the backend on port 8000.

### Terminal assistant (optional)

```powershell
python scripts/graph_agent.py
```

### Tests

```powershell
python -m unittest discover -s tests -v
```

Each test builds a temporary database from the seed CSV, so `data/crm.db` is not touched.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini API key (chat and embeddings). |
| `SESSION_SECRET` | Yes | Signs the visitor cookie. At least 32 characters. |
| `COOKIE_SECURE` | No | Set to `true` when serving over HTTPS. Default `false`. |
| `AI_ENABLED` | No | Set to `false` to pause all AI requests. Default `true`. |
| `PORT` | No | Server port. Default `8000`. |
| `FORWARDED_ALLOW_IPS` | No | Trusted proxy addresses. Default `127.0.0.1`. |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model. Default `gemini-embedding-001`. |

## Docker

```powershell
docker compose up --build
```

The app is available at http://127.0.0.1:8000. Compose reads secrets from your `.env` file (it needs `GOOGLE_API_KEY` and `SESSION_SECRET`) and stores all data in the `crm_data` volume, so it survives restarts. The seed CSV is kept outside the volume, and the container runs as a non-root user with a health check on `/health`.

To build the semantic-search index ahead of time:

```powershell
docker compose run --rm crm python scripts/start_demo.py --index-only
```

## Demo Protections

`scripts/hosted.py` and `scripts/gemini_limits.py` protect a public demo:

- Each browser gets a signed visitor cookie. Conversations are private to the visitor that created them.
- Chat and approval requests must be JSON, cross-site requests are rejected, and request bodies are limited to 16 KiB.
- Only one chat or approval request runs at a time. Extra requests receive a 503.
- Usage limits (per minute and per day) apply per visitor, per IP address (stored as a hash), and across the whole demo. Separate budgets cover chat model calls and embeddings.
- Responses are sent with `no-store`, `nosniff`, and `X-Frame-Options: DENY` headers.

The exact limits are defined in `scripts/gemini_limits.py`.

## API

All routes are served under `/api`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/chat` | Send a message to a new or existing conversation. |
| `POST` | `/approve` | Approve or reject a pending change. |
| `GET` | `/sessions` | List the visitor's conversations. |
| `GET` | `/sessions/{session_id}` | Restore a conversation and any pending approval. |
| `GET` | `/overview` | Dashboard numbers. |
| `GET` | `/customers`, `/customers/filters`, `/customers/{customer_id}` | Customer table, filter options, and detail. |
| `GET` | `/deals` | Deals with a per-stage summary. |
| `GET` | `/tasks` | Tasks, optionally filtered by status. |
| `POST` | `/tasks`, `/tasks/{task_id}/complete`, `/tasks/{task_id}/reschedule` | Create, complete, and reschedule tasks. |
| `POST` | `/customers/{customer_id}/stage`, `/customers/{customer_id}/activities` | Change a deal stage and log a contact. |

Running `api:app` on its own does not work for the chat routes: they need the visitor identity that `hosted.py` provides.

## Example Requests

- "Find contacts named Ahmed."
- "Show the saved notes for CON-21066."
- "List all saved notes."
- "Which follow-ups were overdue as of 2026-10-21?"
- "Which open deals have had no contact in 30 days?"
- "Create a task for CON-21066 to send the proposal on 2026-11-10."
- "Reschedule task 4 to 2026-11-15."
- "Move the deal for CON-20317 to negotiation."
- "Log a phone call with CON-20317: agreed to review the proposal."
- "Save a note for CON-21066: Arabic onboarding materials are required."
- "Which customers mentioned onboarding needs? Cite the sources."

## Limitations

This is a prototype built on synthetic data.

- There are no user accounts. Visitors are identified only by a browser cookie.
- Dashboard data is shared by all visitors. Only assistant conversations are private.
- It runs as a single process with SQLite, and requests are handled one at a time.
- Semantic search returns at most five candidates and is not exhaustive.
