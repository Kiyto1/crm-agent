import argparse
import os
import runpy
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

from dotenv import load_dotenv
import uvicorn


PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def initialize_data():
    """Create missing tables while preserving existing records."""

    data_dir = PROJECT_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    with closing(
        sqlite3.connect(data_dir / "crm.db")
    ) as connection:
        contacts_exist = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'contacts'
            """
        ).fetchone()

    if not contacts_exist:
        # Docker keeps the source CSV outside the persistent volume.
        seed_file = (
            PROJECT_ROOT
            / "seed"
            / "saudi_crm_customers_synthetic.csv"
        )

        if seed_file.is_file():
            shutil.copyfile(
                seed_file,
                data_dir / seed_file.name,
            )

        from init_db import initialize_database

        initialize_database()

    # These scripts create their tables only if they are missing.
    for script in ("init_tasks.py", "init_notes.py"):
        runpy.run_path(
            str(PROJECT_ROOT / "scripts" / script),
            run_name="__main__",
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    # Optional command for preparing Chroma before sharing the demo.
    parser.add_argument(
        "--index-only",
        action="store_true",
    )

    arguments = parser.parse_args()

    initialize_data()

    if arguments.index_only:
        from rag import index_crm_data

        print(index_crm_data())

    else:
        # One worker keeps the in-process lock effective.
        uvicorn.run(
            "hosted:app",
            host="0.0.0.0",
            port=int(os.getenv("PORT", "8000")),
            workers=1,
            proxy_headers=True,
            forwarded_allow_ips=os.getenv(
                "FORWARDED_ALLOW_IPS",
                "127.0.0.1",
            ),
        )