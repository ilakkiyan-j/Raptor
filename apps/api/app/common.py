from datetime import datetime
from typing import Any
from fastapi import HTTPException, Request
from .auth import actor, csrf, iso, require_role, utc_now


def timestamp(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            raise ValueError('timezone missing')
        return dt
    except (ValueError, AttributeError):
        raise HTTPException(422, 'Expected a timezone-aware ISO timestamp')


def event(db: Any, eid: str):
    row = db.execute('SELECT * FROM events WHERE id=?', (eid,)).fetchone()
    if not row:
        raise HTTPException(404, 'Event not found')
    return row


def audit(db: Any, u: str, eid: str, action: str, subject: str):
    db.execute(
        'INSERT INTO audit_events(actor_id,event_id,action,subject_id,happened_at) VALUES (?,?,?,?,?)',
        (u, eid, action, subject, iso(utc_now())),
    )


def organizer(db: Any, request: Request, eid: str, write: bool = False):
    u = actor(db, request)
    require_role(db, u['id'], eid, 'organizer', 'admin')
    if write:
        csrf(db, request, request.headers.get('x-csrf-token'))
    return u


def require_admin(db: Any, user_id: str):
    is_admin = db.execute("SELECT 1 FROM roles WHERE user_id=? AND role='admin'", (user_id,)).fetchone()
    if not is_admin:
        raise HTTPException(403, 'Platform administrator privileges required')
