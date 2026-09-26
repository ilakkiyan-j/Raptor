"""Local password authentication and hashed server-side session tokens."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request

COOKIE = 'session'

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
    db.execute('INSERT OR REPLACE INTO sessions VALUES (?,?,?,?)',
               (token_hash(token), user_id, iso(utc_now()+timedelta(days=days)), secrets.token_urlsafe(32)))
    return token

def actor(db, request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, 'Sign in required')
    row = db.execute('SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id '
                     'WHERE s.token_hash=? AND s.expires_at>?',
                     (token_hash(token), iso(utc_now()))).fetchone()
    if not row:
        raise HTTPException(401, 'Session expired or invalid')
    return row

def require_role(db, user_id, event_id, *roles):
    marks = ','.join('?' for _ in roles)
    row = db.execute(f'SELECT 1 FROM roles WHERE user_id=? AND event_id=? AND role IN ({marks})',
                     (user_id,event_id,*roles)).fetchone()
    if not row:
        raise HTTPException(403, 'Not permitted for this event')

def csrf(db, request, supplied):
    user = actor(db, request)
    if not supplied or not hmac.compare_digest(user['csrf_token'], supplied):
        raise HTTPException(403, 'Invalid CSRF token')
    return user
