"""Web endpoints for the dashboard pages.

These functions are thin: they check the input, call crm_tools (the same
code the assistant uses) and turn {"error": ...} results into HTTP errors.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

import crm_tools


router = APIRouter()


def same_site_only(request: Request) -> None:
    """Reject writes started from another website (basic CSRF guard)."""

    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(
            status_code=403,
            detail="Cross-site requests are not allowed.",
        )


def unwrap(result: dict, status_code: int = 404) -> dict:
    """crm_tools reports problems as {"error": ...}; make that an HTTP error."""

    if "error" in result:
        raise HTTPException(status_code=status_code, detail=result["error"])

    return result


# ---------- Request bodies ----------


class NewTask(BaseModel):
    customer_id: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    due_date: date  # FastAPI rejects anything that is not a valid date


class Reschedule(BaseModel):
    due_date: date


# ---------- Reads ----------


@router.get("/overview")
def overview():
    """Numbers for the Overview page."""

    return crm_tools.get_overview()


@router.get("/customers")
def customers(
    search: str = Query("", max_length=100),
    stage: str = Query("", max_length=40),
    owner: str = Query("", max_length=80),
):
    """Customer table rows, optionally filtered."""

    return crm_tools.list_contacts(search, stage, owner)


@router.get("/customers/filters")
def customer_filters():
    """Options for the stage and owner dropdowns."""

    return crm_tools.get_filter_options()


@router.get("/customers/{customer_id}")
def customer_detail(customer_id: str):
    """One customer with their notes and tasks, for the detail drawer."""

    contact = unwrap(crm_tools.get_contact_details(customer_id))

    return {
        "as_of": crm_tools.today_riyadh(),
        "contact": contact,
        "notes": crm_tools.get_contact_notes(customer_id),
        "tasks": crm_tools.get_contact_tasks(customer_id),
    }


@router.get("/tasks")
def tasks(status: str = Query("", max_length=20)):
    """Tasks, optionally only 'Open' or 'Completed'."""

    return unwrap(crm_tools.list_tasks(status), status_code=422)


# ---------- Writes (same functions the assistant runs after approval) ----------


@router.post("/tasks", dependencies=[Depends(same_site_only)])
def add_task(body: NewTask):
    return unwrap(
        crm_tools.create_task(
            body.customer_id, body.title, body.due_date.isoformat()
        )
    )


@router.post("/tasks/{task_id}/complete", dependencies=[Depends(same_site_only)])
def finish_task(task_id: int):
    return unwrap(crm_tools.complete_task(task_id))


@router.post("/tasks/{task_id}/reschedule", dependencies=[Depends(same_site_only)])
def move_task(task_id: int, body: Reschedule):
    return unwrap(
        crm_tools.reschedule_task(task_id, body.due_date.isoformat()),
        status_code=400,
    )
