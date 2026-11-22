import re
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection

router = APIRouter(prefix="/finance", tags=["finance"])


def currency_code(value: object) -> str:
    if not isinstance(value, str) or not re.fullmatch("[A-Za-z]{3}", value):
        raise HTTPException(status_code=422, detail="Currency must be a three-letter code.")
    return value.upper()


def parse_amount(value: object) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=422, detail="Amount must be a valid decimal number."
        ) from error
    if not amount.is_finite() or not 0 < amount < 10**12 or amount.as_tuple().exponent < -2:
        raise HTTPException(
            status_code=422, detail="Amount must be positive with at most two decimal places."
        )
    return amount


@router.get("/summary")
def get_summary(month: str | None = None, currency: str = "INR", user: dict = Depends(get_current_user)) -> dict:
    currency = currency_code(currency)
    if month is None:
        month = fetch_one(
            "SELECT to_char(now() AT TIME ZONE timezone,'YYYY-MM') AS month FROM users WHERE id=%s",
            (user["id"],),
        )["month"]
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}", month):
            raise ValueError
        start = date.fromisoformat(month + "-01")
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Month must use YYYY-MM format.") from error
    rows = fetch_all(
        "SELECT t.transaction_type, COALESCE(c.name,'Uncategorised') AS label, SUM(t.amount) AS value "
        "FROM finance_transactions t LEFT JOIN finance_categories c ON c.id=t.category_id "
        "WHERE t.user_id=%s AND t.currency=%s AND t.voided_at IS NULL AND t.transaction_date >= %s "
        "AND t.transaction_date < %s::date + interval '1 month' "
        "GROUP BY t.transaction_type, label ORDER BY value DESC, label",
        (user["id"], currency, start, start),
    )
    income = sum((row["value"] for row in rows if row["transaction_type"] == "income"), Decimal(0))
    spending = [{"label": row["label"], "value": row["value"]} for row in rows if row["transaction_type"] == "expense"]
    expenses = sum((row["value"] for row in spending), Decimal(0))
    return {"month": month, "currency": currency, "income": income, "expenses": expenses,
            "net": income - expenses, "spending_by_category": spending}


@router.get("/transactions")
def get_transactions(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT id,category_id,transaction_type,amount,currency,transaction_date,description,created_at "
            "FROM finance_transactions WHERE user_id=%s AND voided_at IS NULL "
            "ORDER BY transaction_date DESC,created_at DESC LIMIT 250",
            (user["id"],),
        )
    }


@router.post("/transactions", status_code=201)
def create_transaction(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    transaction_type = payload.get("transaction_type")
    if transaction_type not in ("income", "expense"):
        raise HTTPException(status_code=422, detail="Transaction type must be income or expense.")
    currency = currency_code(payload.get("currency", "INR"))
    category_id = payload.get("category_id")
    if category_id is not None:
        try:
            category_id = UUID(str(category_id))
        except ValueError as error:
            raise HTTPException(status_code=422, detail="Invalid category ID.") from error
    try:
        transaction_date = date.fromisoformat(str(payload.get("transaction_date", date.today())))
    except ValueError as error:
        raise HTTPException(
            status_code=422, detail="Transaction date must use YYYY-MM-DD."
        ) from error
    amount = parse_amount(payload.get("amount"))
    category_name = payload.get("category_name", "")
    if not isinstance(category_name, str) or len(category_name.strip()) > 80:
        raise HTTPException(status_code=422, detail="Category names may contain up to 80 characters.")
    category_name = category_name.strip()
    if category_name and category_id:
        raise HTTPException(status_code=422, detail="Specify a category name or an existing category ID.")
    with get_connection() as connection:
        if category_id and not connection.execute(
            "SELECT id FROM finance_categories WHERE id=%s AND user_id=%s AND category_type=%s",
            (category_id, user["id"], transaction_type),
        ).fetchone():
            raise HTTPException(status_code=404, detail="Finance category not found.")
        if category_name:
            category = connection.execute(
                "INSERT INTO finance_categories (user_id,name,category_type) VALUES (%s,%s,%s) "
                "ON CONFLICT (user_id,name,category_type) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                (user["id"], category_name, transaction_type),
            ).fetchone()
            category_id = category["id"]
        transaction = connection.execute(
            "INSERT INTO finance_transactions "
            "(user_id,category_id,transaction_type,amount,currency,transaction_date,description) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (user["id"], category_id, transaction_type, amount, currency, transaction_date,
             str(payload.get("description", ""))[:240]),
        ).fetchone()
    return {"item": transaction}


@router.get("/categories")
def get_categories(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT id,name,category_type,color FROM finance_categories WHERE user_id=%s ORDER BY name",
            (user["id"],),
        )
    }


@router.post("/categories", status_code=201)
def create_category(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    category_type = payload.get("category_type")
    if not name or len(name) > 80 or category_type not in ("income", "expense"):
        raise HTTPException(
            status_code=422, detail="Provide a category name and income/expense type."
        )
    return {
        "item": fetch_one(
            "INSERT INTO finance_categories (user_id,name,category_type,color) VALUES (%s,%s,%s,%s) "
            "ON CONFLICT (user_id,name,category_type) DO UPDATE SET color=EXCLUDED.color RETURNING *",
            (user["id"], name, category_type, payload.get("color", "persimmon")),
        )
    }


@router.get("/budgets")
def get_budgets(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT b.*,COALESCE(SUM(t.amount),0) AS spent FROM budgets b "
            "LEFT JOIN finance_transactions t ON t.user_id=b.user_id AND t.transaction_type='expense' "
            "AND t.transaction_date BETWEEN b.period_start AND b.period_end AND t.currency=b.currency AND t.voided_at IS NULL "
            "WHERE b.user_id=%s GROUP BY b.id ORDER BY b.period_start DESC",
            (user["id"],),
        )
    }


@router.post("/budgets", status_code=201)
def create_budget(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 120:
        raise HTTPException(status_code=422, detail="Budget name is required.")
    try:
        period_start = date.fromisoformat(str(payload["period_start"]))
        period_end = date.fromisoformat(str(payload["period_end"]))
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Provide valid budget dates.") from error
    if period_end < period_start:
        raise HTTPException(status_code=422, detail="Budget end must not precede its start.")
    period_type = payload.get("period_type", "monthly")
    currency = currency_code(payload.get("currency", "INR"))
    if period_type not in ("weekly", "monthly", "custom"):
        raise HTTPException(
            status_code=422, detail="Provide a supported budget period and three-letter currency."
        )
    return {
        "item": fetch_one(
            "INSERT INTO budgets (user_id,name,period_type,period_start,period_end,total_limit,currency) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                period_type,
                period_start,
                period_end,
                parse_amount(payload.get("total_limit")),
                currency,
            ),
        )
    }


@router.get("/savings")
def get_savings(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT * FROM savings_goals WHERE user_id=%s ORDER BY created_at DESC", (user["id"],)
        )
    }


@router.post("/savings", status_code=201)
def create_savings_goal(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 120:
        raise HTTPException(status_code=422, detail="Enter a savings goal name of up to 120 characters.")
    try:
        target_date = date.fromisoformat(str(payload["target_date"])) if payload.get("target_date") else None
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Provide a valid savings target date.") from error
    currency = currency_code(payload.get("currency", "INR"))
    return {
        "item": fetch_one(
            "INSERT INTO savings_goals (user_id,name,target_amount,currency,target_date) "
            "VALUES (%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                parse_amount(payload.get("target_amount")),
                currency,
                target_date,
            ),
        )
    }


@router.delete("/transactions/{transaction_id}", status_code=204)
def void_transaction(transaction_id: UUID, user: dict = Depends(get_current_user)) -> Response:
    row = fetch_one(
        "UPDATE finance_transactions SET voided_at=now() WHERE id=%s AND user_id=%s "
        "AND voided_at IS NULL RETURNING id",
        (transaction_id, user["id"]),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return Response(status_code=204)
