from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "saudi_crm_customers_synthetic.csv"


def get_overdue_followups(as_of_date: str) -> list[dict]:
    """Return open follow-up tasks due before the provided date."""

    df = pd.read_csv(DATA_FILE, encoding="utf-8-sig")

    # Convert dates before comparing them.
    df["next_followup_date"] = pd.to_datetime(
        df["next_followup_date"],
        errors="raise",
    )
    reference_date = pd.Timestamp(as_of_date)

    # Keep open tasks whose due date has passed.
    overdue = df[
        (df["task_status"] == "Open")
        & (df["next_followup_date"] < reference_date)
    ].sort_values("next_followup_date")

    result = overdue[
        [
            "customer_id",
            "full_name",
            "assigned_owner",
            "next_followup_date",
            "next_action",
        ]
    ].copy()

    # Format dates as strings for the returned records.
    result["next_followup_date"] = (
        result["next_followup_date"].dt.strftime("%Y-%m-%d")
    )

    return result.fillna("").to_dict(orient="records")

def search_contacts(query: str) -> list[dict]:
    """Find contacts whose name or company contains the search text."""

    query = query.strip()
    if not query:
        return []

    df = pd.read_csv(DATA_FILE, encoding="utf-8-sig")

    # Match either the contact name or the company name.
    matches = df[
        df["full_name"].str.contains(
            query, case=False, na=False, regex=False
        )
        | df["company_name"].str.contains(
            query, case=False, na=False, regex=False
        )
    ]

    result = matches[
        [
            "customer_id",
            "full_name",
            "company_name",
            "job_title",
            "assigned_owner",
            "deal_stage",
        ]
    ]

def search_contacts(query: str) -> list[dict]:
    """Find contacts by name or company."""

    # Remove surrounding spaces and reject an empty search.
    query = query.strip()
    if not query:
        return []

    df = pd.read_csv(DATA_FILE, encoding="utf-8-sig")

    # Search names and companies using literal, case-insensitive text.
    # na=False treats missing values as nonmatches.
    matches = df[
        df["full_name"].str.contains(
            query, case=False, na=False, regex=False
        )
        | df["company_name"].str.contains(
            query, case=False, na=False, regex=False
        )
    ]

    # Select the fields needed to identify each contact.
    result = matches[
        [
            "customer_id",
            "full_name",
            "company_name",
            "job_title",
            "assigned_owner",
            "deal_stage",
        ]
    ]

    # Replace missing values and return one dictionary per contact.
    return result.fillna("").to_dict(orient="records")

def get_contact_details(customer_id: str) -> dict:
    """Return a contact's complete record using their unique ID."""

    df = pd.read_csv(DATA_FILE, encoding="utf-8-sig")

    # Find the row with this exact customer ID.
    matches = df[df["customer_id"] == customer_id.strip()]

    if matches.empty:
        return {"error": f"Contact not found: {customer_id}"}

    # Select the first matching row and return its fields.
    return matches.fillna("").iloc[0].to_dict()


if __name__ == "__main__":
    # Use an ID from the search results you printed earlier.
    customer_id = input("Enter customer ID: ").strip()

    contact = get_contact_details(customer_id)

    for field, value in contact.items():
        print(f"{field}: {value}")