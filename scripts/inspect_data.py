from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent
csv_path = project_root / "data" / "saudi_crm_customers_synthetic.csv"

df = pd.read_csv(csv_path, encoding="utf-8-sig")

print("First five contacts:")
print(df[["full_name", "company_name", "deal_stage"]].head())

print("\nTotal contacts:", len(df))
print("Unique companies:", df["company_id"].nunique())

# Convert date strings into values Python can compare as dates.
df["next_followup_date"] = pd.to_datetime(
    df["next_followup_date"],
    errors="raise"
)

# Use the dataset's snapshot date for a consistent demo.
snapshot_date = pd.Timestamp("2026-10-19")

# Keep tasks that are still open and due before the snapshot date.
overdue = df[
    (df["task_status"] == "Open")
    & (df["next_followup_date"] < snapshot_date)
]

overdue = overdue.sort_values("next_followup_date")

print("\nOVERDUE FOLLOW-UPS")
print(
    overdue[
        ["full_name", "next_followup_date", "next_action"]
    ].head(10).to_string(index=False)
)

print("\nTotal overdue follow-ups:", len(overdue))