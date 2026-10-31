"""Tests for the schema migration and the deal operations.

Run from the project root:   python -m unittest discover -s tests -v

Every test builds its own throwaway database from the real seed CSV in a
temporary folder, so data/crm.db is never touched.
"""

import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

import crm_tools  # noqa: E402
import deals  # noqa: E402
import migrate_schema  # noqa: E402

CSV_FILE = PROJECT_ROOT / "data" / "saudi_crm_customers_synthetic.csv"


def build_flat_database(db_file):
    """Recreate the OLD layout: a flat contacts table plus tasks and notes."""

    frame = pd.read_csv(CSV_FILE, encoding="utf-8-sig")

    with closing(sqlite3.connect(db_file)) as connection:
        frame.to_sql("contacts", connection, index=False)

        with connection:
            connection.execute(
                "CREATE UNIQUE INDEX idx_contacts_customer_id "
                "ON contacts(customer_id)"
            )
            connection.execute(
                """
                CREATE TABLE tasks (
                    task_id INTEGER PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    due_date TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Open'
                        CHECK (status IN ('Open', 'Completed')),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES contacts(customer_id)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE notes (
                    note_id INTEGER PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES contacts(customer_id)
                )
                """
            )
            # Existing records that must survive the migration.
            connection.execute(
                "INSERT INTO tasks (task_id, customer_id, title, due_date) "
                "VALUES (41, 'CON-21066', 'Old task', '2026-10-22')"
            )
            connection.execute(
                "INSERT INTO notes (note_id, customer_id, content) "
                "VALUES (7, 'CON-21066', 'Old note')"
            )


class MigratedDatabaseTest(unittest.TestCase):
    """Base class: a fresh migrated database for every test."""

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.db_file = Path(self.folder.name) / "crm.db"

        build_flat_database(self.db_file)
        migrate_schema.migrate(self.db_file)

        # Point the app code at the temporary database.
        self.original_db = crm_tools.DB_FILE
        crm_tools.DB_FILE = self.db_file

    def tearDown(self):
        crm_tools.DB_FILE = self.original_db
        self.folder.cleanup()

    def query(self, sql, *values):
        with closing(sqlite3.connect(self.db_file)) as connection:
            connection.row_factory = sqlite3.Row
            return connection.execute(sql, values).fetchall()


class MigrationTest(MigratedDatabaseTest):
    def test_rows_are_split_into_tables(self):
        counts = {
            table: self.query(f"SELECT COUNT(*) FROM {table}")[0][0]
            for table in ("companies", "people", "deals")
        }

        self.assertEqual(counts, {"companies": 75, "people": 120, "deals": 120})

    def test_contacts_is_a_view_with_the_old_data(self):
        kind = self.query("SELECT type FROM sqlite_master WHERE name = 'contacts'")
        self.assertEqual(kind[0][0], "view")

        # Every old row must still be returned unchanged.
        columns = ", ".join(
            f'"{row[1]}"'
            for row in self.query("PRAGMA table_info(contacts_legacy)")
        )
        missing = self.query(
            f"SELECT {columns} FROM contacts_legacy "
            f"EXCEPT SELECT {columns} FROM contacts"
        )
        self.assertEqual(missing, [])

    def test_tasks_and_notes_keep_their_ids_and_point_at_people(self):
        self.assertEqual(self.query("SELECT task_id FROM tasks")[0][0], 41)
        self.assertEqual(self.query("SELECT note_id FROM notes")[0][0], 7)

        for table in ("tasks", "notes"):
            parent = self.query(f"PRAGMA foreign_key_list({table})")[0]["table"]
            self.assertEqual(parent, "people")

    def test_every_deal_has_activity_history(self):
        empty = self.query(
            "SELECT COUNT(*) FROM deals WHERE customer_id NOT IN "
            "(SELECT customer_id FROM activities)"
        )
        self.assertEqual(empty[0][0], 0)

    def test_running_twice_does_nothing(self):
        self.assertIn("Already migrated", migrate_schema.migrate(self.db_file))

    def test_a_failed_migration_changes_nothing(self):
        other = Path(self.folder.name) / "broken.db"
        build_flat_database(other)

        # An unknown stage breaks the new CHECK constraint half way through.
        with closing(sqlite3.connect(other)) as connection:
            with connection:
                connection.execute(
                    "UPDATE contacts SET deal_stage = 'bogus' "
                    "WHERE customer_id = 'CON-21066'"
                )

        with self.assertRaises(sqlite3.IntegrityError):
            migrate_schema.migrate(other)

        with closing(sqlite3.connect(other)) as connection:
            names = {
                row[0]: row[1]
                for row in connection.execute(
                    "SELECT name, type FROM sqlite_master"
                )
            }

        self.assertEqual(names["contacts"], "table")  # still the old table
        self.assertNotIn("deals", names)  # nothing half-created


class ExistingToolsStillWorkTest(MigratedDatabaseTest):
    def test_search_and_details_read_through_the_view(self):
        found = crm_tools.search_contacts("Tareeq")
        self.assertTrue(found)

        details = crm_tools.get_contact_details("CON-21066")
        self.assertEqual(details["full_name"], "Ahmed Almutairi")

    def test_create_task_works_and_rejects_unknown_customers(self):
        created = crm_tools.create_task("CON-21066", "Call back", "2026-11-20")
        self.assertEqual(created["status"], "Open")

        missing = crm_tools.create_task("CON-00000", "Call back", "2026-11-20")
        self.assertIn("error", missing)

    def test_overview_still_calculates(self):
        overview = crm_tools.get_overview()

        self.assertGreater(overview["pipeline"]["open_value"], 0)
        self.assertIn("recent_activity", overview)


class DealsTest(MigratedDatabaseTest):
    def test_summary_covers_every_deal(self):
        result = deals.list_deals()

        self.assertEqual(sum(row["count"] for row in result["summary"]), 120)
        self.assertEqual(result["total"], 120)

    def test_stalled_deals_are_open_and_quiet(self):
        result = deals.list_deals(stalled_only=True)

        self.assertGreater(result["total"], 0)
        self.assertEqual(result["total"], result["stalled_total"])

        for deal in result["items"]:
            self.assertNotIn(deal["deal_stage"], ("won", "lost"))

    def test_stage_filter(self):
        result = deals.list_deals(stage="negotiation")

        self.assertTrue(result["items"])
        self.assertTrue(
            all(deal["deal_stage"] == "negotiation" for deal in result["items"])
        )

    def test_update_stage_changes_the_deal_and_records_it(self):
        result = deals.update_deal_stage("CON-21066", "proposal_sent")

        self.assertEqual(result["old_stage"], "demo_scheduled")
        self.assertEqual(
            crm_tools.get_contact_details("CON-21066")["deal_stage"],
            "proposal_sent",
        )

        history = deals.get_activities("CON-21066")
        self.assertEqual(history[0]["kind"], "stage_change")

    def test_update_stage_rejects_bad_input(self):
        self.assertIn("error", deals.update_deal_stage("CON-21066", "bogus"))
        self.assertIn("error", deals.update_deal_stage("CON-00000", "won"))

        same = deals.update_deal_stage("CON-21066", "demo_scheduled")
        self.assertIn("already", same["error"])

    def test_logging_a_contact_ends_a_stall(self):
        stalled = deals.list_deals(stalled_only=True)["items"][0]
        customer = stalled["customer_id"]

        deals.log_contact(customer, "Phone", "Checked in about the proposal.")

        after = [
            deal
            for deal in deals.list_deals()["items"]
            if deal["customer_id"] == customer
        ][0]

        self.assertFalse(after["stalled"])
        self.assertEqual(after["days_since_contact"], 0)

    def test_log_contact_rejects_bad_input(self):
        self.assertIn("error", deals.log_contact("CON-21066", "Pigeon", "Hi"))
        self.assertIn("error", deals.log_contact("CON-21066", "Phone", "   "))
        self.assertIn("error", deals.log_contact("CON-00000", "Phone", "Hi"))


if __name__ == "__main__":
    unittest.main()
