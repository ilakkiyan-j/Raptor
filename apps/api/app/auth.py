"""Local password authentication, sessions, role verification, and registration."""
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from .db import connect

COOKIE = 'session'

router = APIRouter(prefix='/api')


def utc_now():
    return datetime.now(timezone.utc)


def iso(t):
    return t.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 120000).hex()


def create_session(db, user_id, token=None, days=1):
    token = token or secrets.token_urlsafe(40)
    db.execute(
        'INSERT OR REPLACE INTO sessions VALUES (?,?,?,?)',
        (token_hash(token), user_id, iso(utc_now() + timedelta(days=days)), secrets.token_urlsafe(32))
    )
    return token


def actor(db, request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, 'Sign in required')
    row = db.execute(
        'SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id '
        'WHERE s.token_hash=? AND s.expires_at>?',
        (token_hash(token), iso(utc_now()))
    ).fetchone()
    if not row:
        raise HTTPException(401, 'Session expired or invalid')
    return row


def require_role(db, user_id, event_id, *roles):
    marks = ','.join('?' for _ in roles)
    row = db.execute(
        f'SELECT 1 FROM roles WHERE user_id=? AND event_id=? AND role IN ({marks})',
        (user_id, event_id, *roles)
    ).fetchone()
    if not row:
        raise HTTPException(403, 'Not permitted for this event')


def csrf(db, request, supplied):
    user = actor(db, request)
    if not supplied or not hmac.compare_digest(user['csrf_token'], supplied):
        raise HTTPException(403, 'Invalid CSRF token')
    return user


# -----------------------------------------------------------------------------
# AUTH & REGISTRATION API ROUTER
# -----------------------------------------------------------------------------

class RegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=8, max_length=200)
    role: Optional[str] = Field(default='participant', max_length=32)
    organization: Optional[str] = Field(default='', max_length=200)
    event_id: Optional[str] = Field(default='evt_01', max_length=64)


@router.post('/auth/register')
def direct_register(body: RegisterIn, request: Request):
    """Public self-registration. New accounts are always created as participant.
    Judge / organizer / admin roles must be granted by an organizer or admin after signup."""
    email = body.email.strip().lower()
    if '@' not in email or email.startswith('@') or email.endswith('@'):
        raise HTTPException(422, 'Invalid email address')

    target_role = 'participant'

    with connect() as db:
        if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            raise HTTPException(409, 'An account with this email already exists')
        uid = 'usr_' + secrets.token_hex(10)
        salt = secrets.token_hex(16)
        pw_hash = password_hash(body.password, salt)
        db.execute(
            'INSERT INTO users(id,email,name,salt,password_hash) VALUES (?,?,?,?,?)',
            (uid, email, body.name.strip(), salt, pw_hash),
        )

        eid = body.event_id or 'evt_01'
        db.execute(
            'INSERT OR IGNORE INTO roles(user_id, event_id, role) VALUES (?,?,?)',
            (uid, eid, target_role),
        )

        org_name = (body.organization or '').strip()
        audit_details = f'role:{target_role}' + (f' org:{org_name}' if org_name else '')
        db.execute(
            'INSERT INTO audit_events(actor_id,event_id,action,subject_id,happened_at) VALUES (?,?,?,?,?)',
            (uid, eid, 'user.register', audit_details, iso(utc_now())),
        )

        token = create_session(db, uid)
        response = Response(
            content=json.dumps({
                'ok': True,
                'user_id': uid,
                'email': email,
                'name': body.name.strip(),
                'role': target_role,
                'organization': org_name,
            }),
            media_type='application/json',
        )
        response.set_cookie(
            'session',
            token,
            httponly=True,
            samesite='lax',
            secure=request.url.scheme == 'https',
            max_age=86400,
        )
        return response
