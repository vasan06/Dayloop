from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/finance", tags=["finance"])


def parse_amount(value: object) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=422, detail="Amount must be a valid decimal number."
        ) from error
    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise HTTPException(
            status_code=422, detail="Amount must be positive with at most two decimal places."
        )
    return amount


@router.get("/summary")
def get_summary(month: str | None = None, user: dict = Depends(get_current_user)) -> dict:
    try:
        period_start = date.fromisoformat((month or date.today().strftime("%Y-%m")) + "-01")
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Month must use YYYY-MM format.") from error
    if month and len(month) != 7:
        raise HTTPException(status_code=422, detail="Month must use YYYY-MM format.")
    period_end = date(
        period_start.year + (period_start.month == 12), period_start.month % 12 + 1, 1
    )
    totals = fetch_one(
        "SELECT COALESCE(SUM(amount) FILTER (WHERE transaction_type='income'),0) AS income, "
        "COALESCE(SUM(amount) FILTER (WHERE transaction_type='expense'),0) AS expenses "
        "FROM finance_transactions WHERE user_id=%s AND transaction_date >= %s "
        "AND transaction_date < %s AND voided_at IS NULL",
        (user["id"], period_start, period_end),
    )
    return {
        "month": period_start.strftime("%Y-%m"),
        "income": totals["income"],
        "expenses": totals["expenses"],
        "net": totals["income"] - totals["expenses"],
    }


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
    if transaction_type not in {"income", "expense"}:
        raise HTTPException(status_code=422, detail="Transaction type must be income or expense.")
    currency = str(payload.get("currency", "INR")).upper()
    if len(currency) != 3 or not currency.isalpha():
        raise HTTPException(status_code=422, detail="Currency must be a three-letter code.")
    category_id = payload.get("category_id")
    if category_id and not fetch_one(
        "SELECT id FROM finance_categories WHERE id=%s AND user_id=%s AND category_type=%s",
        (category_id, user["id"], transaction_type),
    ):
        raise HTTPException(status_code=404, detail="Finance category not found.")
    try:
        transaction_date = date.fromisoformat(str(payload.get("transaction_date", date.today())))
    except ValueError as error:
        raise HTTPException(
            status_code=422, detail="Transaction date must use YYYY-MM-DD."
        ) from error
    transaction = fetch_one(
        "INSERT INTO finance_transactions (user_id,category_id,transaction_type,amount,currency,transaction_date,description) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
        (
            user["id"],
            category_id,
            transaction_type,
            parse_amount(payload.get("amount")),
            currency,
            transaction_date,
            str(payload.get("description", ""))[:240],
        ),
    )
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
    if not name or len(name) > 80 or category_type not in {"income", "expense"}:
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
    currency = str(payload.get("currency", "INR")).upper()
    if (
        period_type not in {"weekly", "monthly", "custom"}
        or len(currency) != 3
        or not currency.isalpha()
    ):
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
    if not name:
        raise HTTPException(status_code=422, detail="Savings goal name is required.")
    currency = str(payload.get("currency", "INR")).upper()
    if len(currency) != 3 or not currency.isalpha():
        raise HTTPException(status_code=422, detail="Currency must be a three-letter code.")
    return {
        "item": fetch_one(
            "INSERT INTO savings_goals (user_id,name,target_amount,currency,target_date) "
            "VALUES (%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                parse_amount(payload.get("target_amount")),
                currency,
                payload.get("target_date"),
            ),
        )
    }
