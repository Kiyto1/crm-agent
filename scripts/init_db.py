import sqlite3 
from contextlib import closing
from pathlib import Path 

import pandas as pd 

# Find the project root, two levels above this file.
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# Locate the source CSV and choose where to store the database.
DATA_FILE = PROJECT_ROOT / "data" / "saudi_crm_customers_synthetic.csv"
DB_FILE = PROJECT_ROOT / "data" / "crm.db"

def initialize_database():
    """copy the csv into a new contacts table."""

    # Load the original customer records into a DataFrame.
    df = pd.read_csv(DATA_FILE, encoding="utf-8-sig")

    # Stop if any customer ID is missing.
    if df["customer_id"].isna().any():
        raise ValueError("some customer have missing IDs.")
    
    # Stop if any customer ID appears more than once.
    if df["customer_id"].duplicated().any():
        raise ValueError("Some customer IDs are duplicated.")

    # Open the database and close the connection when finished.
    with closing(sqlite3.connect(DB_FILE)) as connection:

        # Create the contacts table and copy the CSV records into it.
        df.to_sql(
            name="contacts",
            con=connection,
            if_exists="fail",
            index=False,
        )

        print(f"Imported {len(df)} contacts into {DB_FILE.name}")



if __name__ == "__main__":
    initialize_database()
