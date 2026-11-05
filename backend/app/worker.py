import time

from app.core.database import get_connection


def process_due_notifications(batch_size: int = 50) -> int:
    processed = 0
    with get_connection() as connection:
        jobs = connection.execute(
            "SELECT id,user_id,title,body,source_type,source_id FROM notification_jobs "
            "WHERE channel='in_app' AND status='pending' AND scheduled_at<=now() "
            "ORDER BY scheduled_at LIMIT %s FOR UPDATE SKIP LOCKED",
            (batch_size,),
        ).fetchall()
        for job in jobs:
            notification = connection.execute(
                "INSERT INTO notifications (user_id,title,body,source_type,source_id) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (job["user_id"], job["title"], job["body"], job["source_type"], job["source_id"]),
            ).fetchone()
            connection.execute(
                "UPDATE notification_jobs SET status='sent',attempt_count=attempt_count+1 WHERE id=%s",
                (job["id"],),
            )
            connection.execute(
                "INSERT INTO notification_deliveries (job_id,status,delivered_at) VALUES (%s,'sent',now())",
                (job["id"],),
            )
            if not notification:
                raise RuntimeError("Notification insert did not return an identifier.")
            processed += 1
    return processed


def run_worker() -> None:
    while True:
        processed = process_due_notifications()
        time.sleep(1 if processed else 5)


if __name__ == "__main__":
    run_worker()
