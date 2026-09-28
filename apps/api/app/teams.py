"""Team formation, membership management, and invitation workflows."""
import hashlib
import secrets
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .auth import actor, csrf, iso, password_hash, require_role, utc_now
from .common import audit, event, timestamp
from .db import connect

router = APIRouter(prefix='/api')


class TeamIn(BaseModel):
    event_id: str
    name: str = Field(min_length=1, max_length=160)


@router.post('/teams')
def create_team(body: TeamIn, request: Request):
    with connect() as db:
        e = event(db, body.event_id)
        u = actor(db, request)
        has_role = db.execute('SELECT 1 FROM roles WHERE user_id=? AND event_id=?', (u['id'], e['id'])).fetchone()
        if has_role:
            require_role(db, u['id'], e['id'], 'participant', 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))
        if utc_now() >= timestamp(e['submissions_close']):
            raise HTTPException(409, 'Teams are closed')
        tid = 'tm_' + secrets.token_hex(8)
        db.execute('INSERT INTO teams VALUES (?,?,?)', (tid, e['id'], body.name.strip()))
        db.execute('INSERT INTO team_members VALUES (?,?)', (tid, u['id']))
        db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)', (u['id'], e['id'], 'participant'))
        audit(db, u['id'], e['id'], 'team.create', tid)
        return {'id': tid, 'event_id': e['id'], 'name': body.name.strip()}


@router.get('/teams/{tid}')
def get_team(tid: str):
    """Get team details and public member roster."""
    with connect() as db:
        team = db.execute('SELECT * FROM teams WHERE id=?', (tid,)).fetchone()
        if not team:
            raise HTTPException(404, 'Team not found')
        members = db.execute(
            """SELECT u.id, u.name, u.email
               FROM team_members tm
               JOIN users u ON u.id=tm.user_id
               WHERE tm.team_id=?""",
            (tid,),
        ).fetchall()
        projects = db.execute(
            'SELECT id, title, state, track_id, submitted_at FROM projects WHERE team_id=?',
            (tid,),
        ).fetchall()
        return {
            'team': dict(team),
            'members': [dict(m) for m in members],
            'projects': [dict(p) for p in projects],
        }


@router.get('/events/{eid}/my-team')
def get_my_team(eid: str, request: Request):
    """Find caller's team for this event."""
    with connect() as db:
        event(db, eid)
        u = actor(db, request)
        row = db.execute(
            """SELECT t.id, t.name, t.event_id
               FROM teams t
               JOIN team_members tm ON tm.team_id=t.id
               WHERE t.event_id=? AND tm.user_id=?""",
            (eid, u['id']),
        ).fetchone()
        if not row:
            return {'has_team': False, 'team': None}
        return {'has_team': True, 'team': dict(row)}


class TeamUpdateIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)


@router.patch('/teams/{tid}')
def update_team(tid: str, body: TeamUpdateIn, request: Request):
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        t = db.execute('SELECT * FROM teams WHERE id=?', (tid,)).fetchone()
        if not t:
            raise HTTPException(404, 'Team not found')
        is_member = db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (tid, u['id'])).fetchone()
        if not is_member:
            require_role(db, u['id'], t['event_id'], 'organizer', 'admin')
        db.execute('UPDATE teams SET name=? WHERE id=?', (body.name.strip(), tid))
        audit(db, u['id'], t['event_id'], 'team.update', tid)
        return {'id': tid, 'name': body.name.strip()}


@router.post('/teams/{tid}/leave')
def leave_team(tid: str, request: Request):
    """Leave current team."""
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        t = db.execute('SELECT * FROM teams WHERE id=?', (tid,)).fetchone()
        if not t:
            raise HTTPException(404, 'Team not found')
        if not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (tid, u['id'])).fetchone():
            raise HTTPException(403, 'Not a member of this team')
        db.execute('DELETE FROM team_members WHERE team_id=? AND user_id=?', (tid, u['id']))
        audit(db, u['id'], t['event_id'], 'team.leave', tid)
        return {'team_id': tid, 'left': True}


class InviteIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    expires_hours: int = Field(default=48, ge=1, le=168)


@router.post('/teams/{tid}/invites')
def invite(tid: str, body: InviteIn, request: Request):
    with connect() as db:
        u = actor(db, request)
        t = db.execute('SELECT * FROM teams WHERE id=?', (tid,)).fetchone()
        if not t:
            raise HTTPException(404, 'Team not found')
        if not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (tid, u['id'])).fetchone():
            require_role(db, u['id'], t['event_id'], 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))
        if utc_now() >= timestamp(event(db, t['event_id'])['submissions_close']):
            raise HTTPException(409, 'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?', (tid,)).fetchone()[0] >= 4:
            raise HTTPException(409, 'Team is full')
        email = body.email.strip().lower()
        if '@' not in email or email.startswith('@') or email.endswith('@'):
            raise HTTPException(422, 'Invalid email')
        token = secrets.token_urlsafe(32)
        expiry = iso(utc_now() + timedelta(hours=body.expires_hours))
        db.execute(
            'INSERT INTO team_invites VALUES (?,?,?,?,?,?)',
            (hashlib.sha256(token.encode()).hexdigest(), tid, email, expiry, None, u['id']),
        )
        audit(db, u['id'], t['event_id'], 'team.invite', tid)
        return {'token': token, 'expires_at': expiry, 'team_id': tid}


@router.get('/invites/{token}')
def inspect_invite(token: str):
    """Inspect invite metadata without requiring authentication."""
    with connect() as db:
        inv = db.execute(
            'SELECT * FROM team_invites WHERE token_hash=?',
            (hashlib.sha256(token.encode()).hexdigest(),),
        ).fetchone()
        if not inv or inv['accepted_at'] or timestamp(inv['expires_at']) <= utc_now():
            raise HTTPException(404, 'Invite unavailable or expired')
        t = db.execute('SELECT * FROM teams WHERE id=?', (inv['team_id'],)).fetchone()
        e = db.execute('SELECT * FROM events WHERE id=?', (t['event_id'],)).fetchone()
        member_count = db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?', (t['id'],)).fetchone()[0]
        return {
            'team_id': t['id'],
            'team_name': t['name'],
            'event_id': e['id'],
            'event_name': e['name'],
            'email': inv['email'],
            'expires_at': inv['expires_at'],
            'is_full': member_count >= 4,
        }


@router.post('/invites/{token}/accept')
def accept_invite(token: str, request: Request):
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        inv = db.execute(
            'SELECT * FROM team_invites WHERE token_hash=?',
            (hashlib.sha256(token.encode()).hexdigest(),),
        ).fetchone()
        if not inv or inv['accepted_at'] or timestamp(inv['expires_at']) <= utc_now():
            raise HTTPException(404, 'Invite unavailable or expired')
        if u['email'].lower() != inv['email'].lower():
            raise HTTPException(403, 'Invite belongs to another email')
        t = db.execute('SELECT * FROM teams WHERE id=?', (inv['team_id'],)).fetchone()
        if utc_now() >= timestamp(event(db, t['event_id'])['submissions_close']):
            raise HTTPException(409, 'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?', (t['id'],)).fetchone()[0] >= 4:
            raise HTTPException(409, 'Team is full')
        db.execute('INSERT OR IGNORE INTO team_members VALUES (?,?)', (t['id'], u['id']))
        db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)', (u['id'], t['event_id'], 'participant'))
        db.execute('UPDATE team_invites SET accepted_at=? WHERE token_hash=?', (iso(utc_now()), inv['token_hash']))
        audit(db, u['id'], t['event_id'], 'team.join', t['id'])
        return {'team_id': t['id'], 'joined': True}


class SignupIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=12, max_length=200)


@router.post('/invites/{token}/register')
def register_invitee(token: str, body: SignupIn):
    """Registration is permitted with a live invite for this email."""
    with connect() as db:
        inv = db.execute(
            'SELECT * FROM team_invites WHERE token_hash=?',
            (hashlib.sha256(token.encode()).hexdigest(),),
        ).fetchone()
        if not inv or inv['accepted_at'] or timestamp(inv['expires_at']) <= utc_now():
            raise HTTPException(404, 'Invite unavailable or expired')
        if body.email.strip().lower() != inv['email'].lower():
            raise HTTPException(403, 'Invite belongs to another email')
        if db.execute('SELECT 1 FROM users WHERE email=?', (body.email.strip(),)).fetchone():
            raise HTTPException(409, 'Account already exists; sign in to accept invitation')
        t = db.execute('SELECT * FROM teams WHERE id=?', (inv['team_id'],)).fetchone()
        if utc_now() >= timestamp(event(db, t['event_id'])['submissions_close']):
            raise HTTPException(409, 'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?', (t['id'],)).fetchone()[0] >= 4:
            raise HTTPException(409, 'Team is full')
        uid = 'usr_' + secrets.token_hex(10)
        salt = secrets.token_hex(16)
        db.execute(
            'INSERT INTO users VALUES (?,?,?,?,?)',
            (uid, body.email.strip().lower(), body.name, salt, password_hash(body.password, salt)),
        )
        db.execute('INSERT INTO team_members VALUES (?,?)', (t['id'], uid))
        db.execute('INSERT INTO roles VALUES (?,?,?)', (uid, t['event_id'], 'participant'))
        db.execute('UPDATE team_invites SET accepted_at=? WHERE token_hash=?', (iso(utc_now()), inv['token_hash']))
        audit(db, uid, t['event_id'], 'team.register', t['id'])
        return {'user_id': uid, 'team_id': t['id'], 'registered': True}
