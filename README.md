# CRM Assistant

A small CRM with a chat assistant. The frontend is React, the backend is FastAPI, and the assistant is a LangGraph agent that calls Gemini. Data lives in SQLite, with Chroma for semantic search over notes.

You can browse customers, deals, and tasks in the dashboard, or ask the assistant things like "which follow-ups are overdue?" in the chat panel. The assistant can propose changes (create a task, move a deal, save a note), but nothing is written to the database until you approve it.

The data is 120 synthetic customer records. This is a prototype, not a production system.

## What it does

Assistant:
- Search contacts by name or company and open a full customer record.
- List overdue follow-ups and deals with no recent contact, with exact totals.
- Create, complete, and reschedule tasks.
- Save and list notes.
- Move a deal to another stage and log a call, email, meeting, or WhatsApp contact.
- Search summaries and notes by meaning and cite the source (for example `note:2`).
- Keep past conversations in a sidebar. Messages and pending approvals survive a page refresh or a backend restart.

Dashboard:
- Overview: open and won pipeline value, deals by stage, overdue follow-ups, open tasks, customers needing attention, recent activity.
- Customers: search, stage and owner filters, and a detail drawer with notes, tasks, and activity.
- Deals: per-stage summary with stage, owner, and stalled filters.
- Tasks: open and completed tasks, with create, complete, and reschedule.

Actions you take in the dashboard are applied directly. The approval step only applies to changes the assistant proposes.

## Assistant tools

The assistant can only call the functions registered in `scripts/graph_agent.py`.

| Tool | Type | Description |
|---|---|---|
| `search_contacts(query)` | Read | Contacts whose name or company contains the text. |
| `get_contact_details(customer_id)` | Read | Full record for one customer. |
| `get_contact_tasks(customer_id)` | Read | A customer's tasks. |
| `get_contact_notes(customer_id)` | Read | A customer's notes. |
| `list_notes(customer_id, limit, offset)` | Read | Notes for all customers or one, paginated, with an exact total. |
| `get_overdue_followups(as_of_date)` | Read | Open follow-ups and tasks due before the date. |
| `find_inactive_contacts(days)` | Read | Open deals with no contact in the last N days (default 30). |
| `search_crm_knowledge(query)` | Read | Up to five summaries or notes matched by meaning, with source IDs. |
| `create_task(customer_id, title, due_date)` | Write | Create a task. |
| `complete_task(task_id)` | Write | Mark a task completed. |
| `reschedule_task(task_id, due_date)` | Write | Change an open task's due date. |
| `add_note(customer_id, content)` | Write | Save a note. |
| `update_deal_stage(customer_id, stage)` | Write | Move a deal to another stage and record it. |
| `log_contact(customer_id, channel, summary)` | Write | Record a contact (Phone, Email, Meeting, WhatsApp). |

Deal stages are `new`, `qualified`, `demo_scheduled`, `proposal_sent`, `negotiation`, `won`, and `lost`. A deal counts as stalled when it is open and has had no contact for 30 days.

## How a request flows

1. The frontend posts the message to `POST /api/chat`.
2. LangGraph sends the conversation and tool descriptions to Gemini.
3. Gemini either answers or asks to call tools.
4. Read tools run right away. If the model asks for a write tool, the graph pauses and the proposed changes are returned to the frontend.
5. The user approves or rejects through `POST /api/approve`. Approved changes run in Python. A rejection is passed back to the model as cancelled.
6. Gemini writes the final answer from the tool results.

Some details about the guardrails:
- The approval check is in code, in both the routing step and the tool-execution step. It does not rely on the prompt.
- An approval covers one batch of tool calls and is cleared afterwards.
- Each user turn is capped at five model calls.
- Retrieved notes and records are treated as data, not instructions.

Conversation history and pending approvals are stored with LangGraph's SQLite checkpointer.

## Semantic search

Customer summaries and notes are embedded with Google's embedding API and stored in a local Chroma collection. Before each search the app syncs Chroma with SQLite: new and edited records are embedded, deleted ones are removed, and unchanged ones keep their existing vectors.

Search results carry source IDs such as `note:2` or `contact:CON-21066`. Semantic search only returns a few candidates, so anything that needs an exact count, status, date, or full list goes through the SQL tools instead.

## Data model

On first start the app imports `data/saudi_crm_customers_synthetic.csv` and migrates it into a normalized schema.

```
companies ──< people ──< activities
                │
                ├──── deals   (one per person)
                ├──< tasks
                └──< notes
```

| Table | Contents |
|---|---|
| `companies` | Name, industry, size, city, country |
| `people` | Name, job title, email, owner, status |
| `deals` | Stage, value (SAR), product, next follow-up |
| `activities` | Contact history and stage changes |
| `tasks` | Customer tasks (`Open` or `Completed`) |
| `notes` | Saved notes |
| `contacts` (view) | Flat view over the tables above, used by the assistant, search, and dashboard |

Runtime files in `data/`:
- `crm.db`: CRM data
- `conversations.sqlite`: LangGraph checkpoints
- `session_owners.sqlite`: which visitor owns which conversation
- `gemini_usage.sqlite`: counters for the rate limits
- `chroma/`: vector store

## Project layout

```
crm-agent/
├── scripts/
│   ├── hosted.py            Entry point: sessions, limits, security headers, serves the React build
│   ├── api.py               Assistant endpoints (/chat, /approve, /sessions)
│   ├── dashboard_api.py     Dashboard endpoints
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

## Stack

| Part | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI, Pydantic, uvicorn |
| Model | Gemini 3.5 Flash Lite |
| Agent | LangGraph |
| CRM storage | SQLite |
| Vector storage | Chroma |
| Embeddings | Gemini Embedding 001 |
| Deployment | Docker, Docker Compose |

## Running locally

You need Python 3.12 or newer, Node.js, and a Google API key for Gemini.

Install backend dependencies from the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a `.env` file in the project root:

```dotenv
GOOGLE_API_KEY=your_google_api_key
SESSION_SECRET=a_random_value_of_at_least_32_characters
```

A quick way to generate the secret:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Build the frontend. The server serves the built files and won't start without them:

```powershell
cd frontend
npm ci
npm run build
cd ..
```

Start the app:

```powershell
python scripts/start_demo.py
```

The first run creates `data/crm.db` from the seed CSV and migrates it. Later runs keep the existing data. Open http://127.0.0.1:8000.

### Frontend development

With the backend running, start Vite in a second terminal:

```powershell
cd frontend
npm run dev
```

Vite proxies `/api` to the backend on port 8000.

### Terminal assistant

```powershell
python scripts/graph_agent.py
```

### Tests

```powershell
python -m unittest discover -s tests -v
```

Each test builds a temporary database from the seed CSV, so `data/crm.db` is left alone.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini API key, used for chat and embeddings. |
| `SESSION_SECRET` | Yes | Signs the visitor cookie. At least 32 characters. |
| `COOKIE_SECURE` | No | Set to `true` when serving over HTTPS. Default `false`. |
| `AI_ENABLED` | No | Set to `false` to turn off all AI requests. Default `true`. |
| `PORT` | No | Server port. Default `8000`. |
| `FORWARDED_ALLOW_IPS` | No | Trusted proxy addresses. Default `127.0.0.1`. |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model. Default `gemini-embedding-001`. |

## Docker

```powershell
docker compose up --build
```

The app is at http://127.0.0.1:8000. Compose reads `GOOGLE_API_KEY` and `SESSION_SECRET` from `.env` and keeps all data in the `crm_data` volume. The seed CSV stays outside the volume. The container runs as a non-root user and has a health check on `/health`.

To build the semantic search index ahead of time:

```powershell
docker compose run --rm crm python scripts/start_demo.py --index-only
```

## Protections for a public demo

`scripts/hosted.py` and `scripts/gemini_limits.py` add some limits so the demo can be left online:

- Each browser gets a signed visitor cookie, and conversations are only visible to the visitor who created them.
- Chat and approval requests must be JSON, cross-site requests are rejected, and request bodies are capped at 16 KiB.
- Only one chat or approval request runs at a time. Others get a 503.
- Usage limits (per minute and per day) apply per visitor, per IP address (stored hashed), and across the whole demo. Chat and embeddings have separate budgets.
- Responses carry `no-store`, `nosniff`, and `X-Frame-Options: DENY` headers.

The actual numbers are in `scripts/gemini_limits.py`.

## API

All routes are under `/api`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/chat` | Send a message to a new or existing conversation. |
| `POST` | `/approve` | Approve or reject a pending change. |
| `GET` | `/sessions` | List the visitor's conversations. |
| `GET` | `/sessions/{session_id}` | Restore a conversation and any pending approval. |
| `GET` | `/overview` | Dashboard numbers. |
| `GET` | `/customers`, `/customers/filters`, `/customers/{customer_id}` | Customer table, filter options, detail. |
| `GET` | `/deals` | Deals with a per-stage summary. |
| `GET` | `/tasks` | Tasks, optionally filtered by status. |
| `POST` | `/tasks`, `/tasks/{task_id}/complete`, `/tasks/{task_id}/reschedule` | Create, complete, and reschedule tasks. |
| `POST` | `/customers/{customer_id}/stage`, `/customers/{customer_id}/activities` | Change a deal stage and log a contact. |

The chat routes depend on the visitor identity set by `hosted.py`, so `api:app` can't be run on its own for chat.

## Example prompts

- "Find contacts named Ahmed."
- "Show the saved notes for CON-21066."
- "Which follow-ups were overdue as of 2026-10-21?"
- "Which open deals have had no contact in 30 days?"
- "Create a task for CON-21066 to send the proposal on 2026-11-10."
- "Reschedule task 4 to 2026-11-15."
- "Move the deal for CON-20317 to negotiation."
- "Log a phone call with CON-20317: agreed to review the proposal."
- "Save a note for CON-21066: Arabic onboarding materials are required."
- "Which customers mentioned onboarding needs? Cite the sources."

## Limitations

- No user accounts. Visitors are identified only by a browser cookie.
- Dashboard data is shared between all visitors. Only assistant conversations are private.
- Single process, SQLite, one request handled at a time.
- Semantic search returns at most five candidates and isn't exhaustive.
- The data is synthetic.
