"""Split the flat `contacts` table into companies, people, deals and activities.

Run it with:  python scripts/migrate_schema.py

What it does (all in ONE transaction, so it either fully works or changes nothing):
  1. Copies data/crm.db to data/crm.db.bak-before-migration (your way back).
  2. Renames the flat table to `contacts_legacy` (kept for reference).
  3. Creates companies, people, deals and activities and fills them from it.
  4. Rebuilds `tasks` and `notes` so they point at `people`. Their IDs are kept.
  5. Creates a VIEW named `contacts` with the old column names, so the
     assistant, search and RAG code keep working without changes.
  6. Checks the view returns exactly the old data before saving.

Running it again is safe: it says "already migrated" and does nothing.
To start over from the CSV: delete data/crm.db and run scripts/start_demo.py.
"""

import shutil
import sqlite3
from contextlib import closing
from datetime import date, timedelta
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = PROJECT_ROOT / "data" / "crm.db"

# Pipeline order. "lost" is a stage you can leave a deal in at any point.
STAGES = (
    "new",
    "qualified",
    "demo_scheduled",
    "proposal_sent",
    "negotiation",
    "won",
    "lost",
)


SCHEMA = """
CREATE TABLE companies (
    company_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT,
    city TEXT,
    country TEXT
);

CREATE TABLE people (
    customer_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    full_name TEXT NOT NULL,
    job_title TEXT,
    email TEXT,
    preferred_language TEXT,
    preferred_channel TEXT,
    lead_source TEXT,
    assigned_owner TEXT,
    created_at TEXT,
    customer_status TEXT
);

-- One deal per person for now (customer_id is UNIQUE).
CREATE TABLE deals (
    deal_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE REFERENCES people(customer_id),
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    title TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ({stages})),
    value_sar REAL,
    currency TEXT,
    product_interest TEXT,
    estimated_users INTEGER,
    business_need TEXT,
    next_action TEXT,
    next_followup_date TEXT,
    followup_status TEXT,
    lost_reason TEXT,
    subscription_start_date TEXT,
    renewal_date TEXT,
    data_as_of TEXT
);

-- Every contact with a customer, plus stage changes. The newest "contact"
-- row is what the app shows as the customer's "last contact".
CREATE TABLE activities (
    activity_id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES people(customer_id),
    deal_id TEXT REFERENCES deals(deal_id),
    kind TEXT NOT NULL CHECK (kind IN ('contact', 'stage_change')),
    channel TEXT,
    summary TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE INDEX idx_people_company ON people(company_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_activities_customer
    ON activities(customer_id, occurred_at);

-- Same columns and names as the old flat table, built from the new tables.
CREATE VIEW contacts AS
SELECT
    p.customer_id,
    p.company_id,
    p.full_name,
    c.name AS company_name,
    c.city,
    c.country,
    c.industry,
    c.size AS company_size,
    p.job_title,
    p.email,
    p.preferred_language,
    p.preferred_channel,
    p.lead_source,
    p.assigned_owner,
    p.created_at,
    p.customer_status,
    d.deal_id,
    d.stage AS deal_stage,
    d.product_interest,
    d.estimated_users,
    d.value_sar AS deal_value_sar,
    d.currency,
    d.business_need,
    a.occurred_at AS last_contact_date,
    a.channel AS last_contact_channel,
    a.summary AS last_interaction_summary,
    d.next_action,
    d.next_followup_date,
    d.followup_status AS task_status,
    d.lost_reason,
    d.subscription_start_date,
    d.renewal_date,
    d.data_as_of
FROM people AS p
JOIN companies AS c ON c.company_id = p.company_id
LEFT JOIN deals AS d ON d.customer_id = p.customer_id
LEFT JOIN activities AS a ON a.activity_id = (
    SELECT x.activity_id
    FROM activities AS x
    WHERE x.customer_id = p.customer_id AND x.kind = 'contact'
    ORDER BY x.occurred_at DESC, x.activity_id DESC
    LIMIT 1
);
""".format(stages=", ".join(f"'{stage}'" for stage in STAGES))


# tasks and notes are rebuilt with the same columns, but they now reference
# `people` instead of the old flat table.
REBUILD_TASKS = """
CREATE TABLE tasks_new (
    task_id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open'
        CHECK (status IN ('Open', 'Completed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES people(customer_id)
);
"""

REBUILD_NOTES = """
CREATE TABLE notes_new (
    note_id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES people(customer_id)
);
"""


# How a lead usually first reached us, and what the first activity says.
LEAD_CHANNEL = {
    "Outbound call": "Phone",
    "Website": "Email",
    "LinkedIn": "Email",
    "Referral": "Phone",
    "Partner": "Email",
    "Trade event": "Meeting",
}

FIRST_CONTACT = {
    "Outbound call": "Outbound call. {job} at {company} agreed to hear more about {product}.",
    "Website": "Website enquiry from {job} at {company} about {product}.",
    "LinkedIn": "Replied to a LinkedIn message about {product}.",
    "Referral": "Introduced through a referral. {company} is interested in {product}.",
    "Partner": "A partner introduced {company}. They asked about {product}.",
    "Trade event": "Met {job} at a trade event and talked about {product}.",
}


def history_steps(deal):
    """The earlier contacts of a deal, as (channel, summary) pairs.

    The number of steps depends on the stage: a deal in negotiation has
    already had a first contact, discovery call, demo and proposal.
    """

    texts = {
        "company": deal["company_name"],
        "job": deal["job_title"],
        "product": deal["product_interest"],
        "users": deal["estimated_users"],
    }
    source = deal["lead_source"]

    steps = [
        (
            LEAD_CHANNEL.get(source, "Email"),
            FIRST_CONTACT.get(
                source, "First enquiry about {product}."
            ).format(**texts),
        )
    ]

    # "lost" deals are treated as having reached the proposal stage.
    stage = deal["deal_stage"]
    reached = 3 if stage == "lost" else STAGES.index(stage)

    if reached >= 1:
        steps.append(
            ("Phone", "Discovery call to confirm needs for {users} users.".format(**texts))
        )
    if reached >= 2:
        steps.append(("Meeting", "Product demo for the {company} team.".format(**texts)))
    if reached >= 3:
        steps.append(("Email", "Sent the proposal for {product}.".format(**texts)))
    if reached >= 4:
        steps.append(("Phone", "Discussed pricing and contract terms."))
    if stage == "won":
        steps.append(("Meeting", "Contract signed. Onboarding planned."))
    if stage == "lost":
        steps.append(
            ("Phone", "Customer decided not to proceed. Reason: {}.".format(deal["lost_reason"] or "not given"))
        )

    return steps


def activity_rows(deal):
    """Activity rows for one deal: made-up history, then the real last contact."""

    start = date.fromisoformat(deal["created_at"][:10])
    end = date.fromisoformat(deal["last_contact_date"][:10])

    # Safety net: history cannot start after the last contact.
    if end < start:
        start = end

    span = (end - start).days
    steps = history_steps(deal)
    rows = []

    # Spread the earlier steps evenly between creation and the last contact.
    for number, (channel, summary) in enumerate(steps, start=1):
        day = start + timedelta(days=span * number // (len(steps) + 1))
        rows.append((channel, summary, day.isoformat()))

    # The original CSV's last contact is kept exactly as it was.
    rows.append(
        (
            deal["last_contact_channel"],
            deal["last_interaction_summary"],
            deal["last_contact_date"],
        )
    )

    return rows


def object_type(connection, name):
    """'table', 'view' or None for a name in the database."""

    row = connection.execute(
        "SELECT type FROM sqlite_master WHERE name = ?", (name,)
    ).fetchone()

    return row[0] if row else None


def verify(connection):
    """Raise if the new `contacts` view differs from the old flat table."""

    legacy_count = connection.execute(
        "SELECT COUNT(*) FROM contacts_legacy"
    ).fetchone()[0]
    view_count = connection.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]

    if legacy_count != view_count:
        raise RuntimeError(f"Row count changed: {legacy_count} -> {view_count}")

    columns = ", ".join(
        f'"{row[1]}"'
        for row in connection.execute("PRAGMA table_info(contacts_legacy)")
    )

    # EXCEPT returns rows that are in the first query but not the second.
    missing = connection.execute(
        f"SELECT {columns} FROM contacts_legacy "
        f"EXCEPT SELECT {columns} FROM contacts"
    ).fetchall()

    if missing:
        raise RuntimeError(f"{len(missing)} rows differ after migration")

    violations = connection.execute("PRAGMA foreign_key_check").fetchall()

    if violations:
        raise RuntimeError(f"Foreign key problems: {violations[:3]}")


def migrate(db_file=DB_FILE):
    """Migrate the database. Returns a short status message."""

    db_file = Path(db_file)

    with closing(sqlite3.connect(db_file)) as connection:
        connection.row_factory = sqlite3.Row

        if object_type(connection, "contacts") == "view":
            return "Already migrated. Nothing to do."

        if object_type(connection, "contacts") != "table":
            raise RuntimeError("No contacts table found. Run start_demo.py first.")

    # Your way back: restore by copying this file over crm.db.
    backup = db_file.with_name(db_file.name + ".bak-before-migration")
    if not backup.exists():
        shutil.copyfile(db_file, backup)

    # isolation_level=None lets us control BEGIN/COMMIT ourselves, so the
    # table changes and the data copy are one all-or-nothing transaction.
    connection = sqlite3.connect(db_file, isolation_level=None)
    connection.row_factory = sqlite3.Row

    try:
        # Must be switched off while tables are rebuilt (outside a transaction).
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("BEGIN")

        connection.execute("ALTER TABLE contacts RENAME TO contacts_legacy")

        # Create the new tables, indexes and the compatibility view.
        # executescript() would COMMIT early, so we run the statements one by
        # one (SCHEMA is split at each ";" that ends a line).
        for statement in SCHEMA.split(";\n"):
            if statement.strip():
                connection.execute(statement)

        connection.execute(
            """
            INSERT INTO companies
            SELECT company_id, MIN(company_name), MIN(industry),
                   MIN(company_size), MIN(city), MIN(country)
            FROM contacts_legacy
            GROUP BY company_id
            """
        )

        connection.execute(
            """
            INSERT INTO people
            SELECT customer_id, company_id, full_name, job_title, email,
                   preferred_language, preferred_channel, lead_source,
                   assigned_owner, created_at, customer_status
            FROM contacts_legacy
            """
        )

        connection.execute(
            """
            INSERT INTO deals
            SELECT deal_id, customer_id, company_id,
                   product_interest || ' for ' || company_name,
                   deal_stage, deal_value_sar, currency, product_interest,
                   estimated_users, business_need, next_action,
                   next_followup_date, task_status, lost_reason,
                   subscription_start_date, renewal_date, data_as_of
            FROM contacts_legacy
            """
        )

        # Seed the activity history.
        for deal in connection.execute("SELECT * FROM contacts_legacy").fetchall():
            for channel, summary, day in activity_rows(deal):
                connection.execute(
                    """
                    INSERT INTO activities
                        (customer_id, deal_id, kind, channel, summary, occurred_at)
                    VALUES (?, ?, 'contact', ?, ?, ?)
                    """,
                    (deal["customer_id"], deal["deal_id"], channel, summary, day),
                )

        # Rebuild tasks and notes so they reference `people`; IDs are kept.
        for table, new_schema in (("tasks", REBUILD_TASKS), ("notes", REBUILD_NOTES)):
            connection.execute(new_schema)

            if object_type(connection, table):
                connection.execute(
                    f"INSERT INTO {table}_new SELECT * FROM {table}"
                )
                connection.execute(f"DROP TABLE {table}")

            connection.execute(f"ALTER TABLE {table}_new RENAME TO {table}")

        # Prove the view still returns the old data before saving anything.
        verify(connection)

        connection.execute("COMMIT")

    except Exception:
        # Undo everything; the database is exactly as it was.
        if connection.in_transaction:
            connection.execute("ROLLBACK")
        raise

    finally:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.close()

    return f"Migrated. Backup saved as {backup.name}."


if __name__ == "__main__":
    print(migrate())
