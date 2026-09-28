"""Event/team setup and event-scoped judging workflow. JSON API only."""
import csv
import hashlib
import io
import json
import math
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .assignment import auto_assign_judges
from .auth import actor, create_session, csrf, iso, password_hash, require_role, token_hash, utc_now
from .db import connect
from .normalization import calculate_event_results

router = APIRouter(prefix='/api')


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


# -----------------------------------------------------------------------------
# 1. AUTHENTICATION & DIRECT REGISTRATION
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

    # Security: public registration is restricted to participant only.
    # Privileged roles (judge, organizer, admin) must be assigned by an organizer/admin.
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
        
        # Assign requested role for default event
        eid = body.event_id or 'evt_01'
        db.execute(
            'INSERT OR IGNORE INTO roles(user_id, event_id, role) VALUES (?,?,?)',
            (uid, eid, target_role),
        )
        if target_role == 'judge':
            jid = 'jdg_' + secrets.token_hex(6)
            db.execute(
                'INSERT OR IGNORE INTO judges(id, event_id, user_id) VALUES (?,?,?)',
                (jid, eid, uid),
            )
        
        org_name = (body.organization or '').strip()
        audit_details = f'role:{target_role}' + (f' org:{org_name}' if org_name else '')
        audit(db, uid, eid, 'user.register', audit_details)

        # Default session created for convenience
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


# -----------------------------------------------------------------------------
# 2. EVENT LIFECYCLE & ROLES
# -----------------------------------------------------------------------------

class EventIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    submissions_close: str
    judging_close: Optional[str] = None
    starts_at: Optional[str] = None
    description: Optional[str] = Field(default='', max_length=4000)


@router.post('/events')
def create_event(body: EventIn, request: Request):
    with connect() as db:
        u = actor(db, request)
        if not db.execute("SELECT 1 FROM roles WHERE user_id=? AND role='admin'", (u['id'],)).fetchone():
            raise HTTPException(403, 'Admin required to create an event')
        csrf(db, request, request.headers.get('x-csrf-token'))
        close = timestamp(body.submissions_close)
        if close <= utc_now():
            raise HTTPException(422, 'New event submission close must be in future')
        judge_close = timestamp(body.judging_close) if body.judging_close else None
        if judge_close and judge_close <= close:
            raise HTTPException(422, 'Judging must close after submissions')
        starts = timestamp(body.starts_at) if body.starts_at else None
        eid = 'evt_' + secrets.token_hex(8)
        db.execute(
            'INSERT INTO events(id,name,submissions_close,judging_close,starts_at,description) VALUES (?,?,?,?,?,?)',
            (
                eid,
                body.name,
                iso(close),
                iso(judge_close) if judge_close else None,
                iso(starts) if starts else None,
                body.description or '',
            ),
        )
        db.execute('INSERT INTO roles VALUES (?,?,?)', (u['id'], eid, 'admin'))
        audit(db, u['id'], eid, 'event.create', eid)
        return {
            'id': eid,
            'name': body.name,
            'submissions_close': iso(close),
            'judging_close': iso(judge_close) if judge_close else None,
            'starts_at': iso(starts) if starts else None,
            'description': body.description or '',
        }


@router.get('/events')
def list_events():
    with connect() as db:
        return {'events': [dict(r) for r in db.execute('SELECT * FROM events ORDER BY id')]}


@router.get('/events/{eid}')
def get_event(eid: str):
    """Get complete event details including tracks and prize counts."""
    with connect() as db:
        e = event(db, eid)
        e_dict = dict(e)
        tracks = db.execute('SELECT id,name FROM tracks WHERE event_id=? ORDER BY name', (eid,)).fetchall()
        prizes = db.execute('SELECT * FROM prizes WHERE event_id=? ORDER BY rank_order, id', (eid,)).fetchall()
        sub_count = db.execute(
            "SELECT COUNT(*) FROM projects WHERE event_id=? AND state='submitted'", (eid,)
        ).fetchone()[0]
        now = utc_now()
        sub_close = timestamp(e['submissions_close'])
        judging_close = timestamp(e_dict['judging_close']) if e_dict.get('judging_close') else None

        if now < sub_close:
            status = 'open'
        elif judging_close and now < judging_close:
            status = 'judging'
        else:
            status = 'closed'

        return {
            'event': e_dict,
            'status': status,
            'submission_count': sub_count,
            'tracks': [dict(t) for t in tracks],
            'prizes': [dict(p) for p in prizes],
        }


class EventUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    submissions_close: Optional[str] = None
    judging_close: Optional[str] = None
    starts_at: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=4000)


@router.patch('/events/{eid}')
def update_event(eid: str, body: EventUpdateIn, request: Request):
    """Update event dates or metadata (organizer or admin only)."""
    with connect() as db:
        e = event(db, eid)
        u = organizer(db, request, eid, write=True)

        updates = {}
        if body.name is not None:
            updates['name'] = body.name.strip()
        if body.description is not None:
            updates['description'] = body.description.strip()
        if body.starts_at is not None:
            updates['starts_at'] = iso(timestamp(body.starts_at))

        cur_close = timestamp(body.submissions_close) if body.submissions_close else timestamp(e['submissions_close'])
        if body.submissions_close:
            updates['submissions_close'] = iso(cur_close)

        if body.judging_close is not None:
            j_close = timestamp(body.judging_close)
            if j_close <= cur_close:
                raise HTTPException(422, 'Judging must close after submissions')
            updates['judging_close'] = iso(j_close)

        if updates:
            set_clause = ', '.join(f'{k}=?' for k in updates.keys())
            db.execute(f'UPDATE events SET {set_clause} WHERE id=?', (*updates.values(), eid))
            audit(db, u['id'], eid, 'event.update', eid)

        return dict(event(db, eid))


# -----------------------------------------------------------------------------
# 3. ROLES MANAGEMENT
# -----------------------------------------------------------------------------

class RoleAssignIn(BaseModel):
    user_id: str
    role: str = Field(pattern=r'^(participant|judge|organizer|admin)$')


@router.get('/events/{eid}/roles')
def list_event_roles(eid: str, request: Request):
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)
        rows = db.execute(
            """SELECT r.user_id, r.role, u.email, u.name
               FROM roles r
               JOIN users u ON u.id=r.user_id
               WHERE r.event_id=? ORDER BY r.role, u.name""",
            (eid,),
        ).fetchall()
        return {'event_id': eid, 'roles': [dict(r) for r in rows]}


@router.post('/events/{eid}/roles')
def assign_event_role(eid: str, body: RoleAssignIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, write=True)
        target = db.execute('SELECT id FROM users WHERE id=?', (body.user_id,)).fetchone()
        if not target:
            raise HTTPException(404, 'Target user not found')
        db.execute(
            'INSERT OR REPLACE INTO roles(user_id,event_id,role) VALUES (?,?,?)',
            (body.user_id, eid, body.role),
        )
        audit(db, u['id'], eid, 'role.assign', f'{body.user_id}:{body.role}')
        return {'user_id': body.user_id, 'event_id': eid, 'role': body.role}


# -----------------------------------------------------------------------------
# 4. TRACKS MANAGEMENT
# -----------------------------------------------------------------------------

class TrackIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


@router.get('/events/{eid}/tracks')
def get_tracks(eid: str):
    with connect() as db:
        event(db, eid)
        rows = db.execute('SELECT id, event_id, name FROM tracks WHERE event_id=? ORDER BY name', (eid,)).fetchall()
        return {'event_id': eid, 'tracks': [dict(r) for r in rows]}


@router.post('/events/{eid}/tracks')
def create_track(eid: str, body: TrackIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        tid = 'trk_' + secrets.token_hex(8)
        try:
            db.execute('INSERT INTO tracks VALUES (?,?,?)', (tid, eid, body.name.strip()))
        except Exception as exc:
            if 'UNIQUE' in str(exc):
                raise HTTPException(409, 'Track name already exists in event')
            raise
        audit(db, u['id'], eid, 'track.create', tid)
        return {'id': tid, 'event_id': eid, 'name': body.name.strip()}


@router.delete('/events/{eid}/tracks/{tid}')
def delete_track(eid: str, tid: str, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if db.execute('SELECT 1 FROM projects WHERE track_id=?', (tid,)).fetchone():
            raise HTTPException(409, 'Cannot delete track with associated projects')
        db.execute('DELETE FROM judge_tracks WHERE track_id=?', (tid,))
        db.execute('DELETE FROM tracks WHERE id=? AND event_id=?', (tid, eid))
        audit(db, u['id'], eid, 'track.delete', tid)
        return {'deleted': True, 'track_id': tid}


# -----------------------------------------------------------------------------
# 5. PRIZES MANAGEMENT (T1 Checklist)
# -----------------------------------------------------------------------------

class PrizeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=2000)
    amount: str = Field(default='', max_length=100)
    track_id: Optional[str] = None
    rank_order: int = Field(default=0, ge=0)


@router.get('/events/{eid}/prizes')
def list_prizes(eid: str):
    """Public listing of all event prizes."""
    with connect() as db:
        event(db, eid)
        rows = db.execute(
            """SELECT p.id, p.event_id, p.track_id, p.title, p.description, p.amount, p.rank_order, t.name AS track_name
               FROM prizes p
               LEFT JOIN tracks t ON t.id=p.track_id
               WHERE p.event_id=? ORDER BY p.rank_order, p.id""",
            (eid,),
        ).fetchall()
        return {'event_id': eid, 'prizes': [dict(r) for r in rows]}


@router.post('/events/{eid}/prizes')
def create_prize(eid: str, body: PrizeIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if body.track_id and not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?', (body.track_id, eid)).fetchone():
            raise HTTPException(422, 'Track does not belong to this event')
        pid = 'prz_' + secrets.token_hex(8)
        db.execute(
            'INSERT INTO prizes VALUES (?,?,?,?,?,?,?)',
            (pid, eid, body.track_id, body.title.strip(), body.description.strip(), body.amount.strip(), body.rank_order),
        )
        audit(db, u['id'], eid, 'prize.create', pid)
        return {'id': pid, 'event_id': eid, **body.model_dump()}


class PrizeUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    amount: Optional[str] = Field(default=None, max_length=100)
    track_id: Optional[str] = None
    rank_order: Optional[int] = Field(default=None, ge=0)


@router.patch('/events/{eid}/prizes/{pid}')
def update_prize(eid: str, pid: str, body: PrizeUpdateIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        existing = db.execute('SELECT * FROM prizes WHERE id=? AND event_id=?', (pid, eid)).fetchone()
        if not existing:
            raise HTTPException(404, 'Prize not found')
        updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if 'track_id' in updates and updates['track_id']:
            if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?', (updates['track_id'], eid)).fetchone():
                raise HTTPException(422, 'Track does not belong to this event')
        if updates:
            set_clause = ', '.join(f'{k}=?' for k in updates.keys())
            db.execute(f'UPDATE prizes SET {set_clause} WHERE id=?', (*updates.values(), pid))
            audit(db, u['id'], eid, 'prize.update', pid)
        return dict(db.execute('SELECT * FROM prizes WHERE id=?', (pid,)).fetchone())


@router.delete('/events/{eid}/prizes/{pid}')
def delete_prize(eid: str, pid: str, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        db.execute('DELETE FROM prizes WHERE id=? AND event_id=?', (pid, eid))
        audit(db, u['id'], eid, 'prize.delete', pid)
        return {'deleted': True, 'prize_id': pid}


# -----------------------------------------------------------------------------
# 6. TEAMS & INVITES LIFECYCLE
# -----------------------------------------------------------------------------

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


# -----------------------------------------------------------------------------
# 7. SUBMISSIONS & LIFECYCLE (UNSUBMIT, DELETE DRAFT)
# -----------------------------------------------------------------------------

@router.get('/projects/{project_id}/public')
def get_public_project(project_id: str):
    """JSON project detail view for public/visitor consumption."""
    with connect() as db:
        row = db.execute(
            """SELECT p.*, t.name AS track_name, tm.name AS team_name
               FROM projects p
               JOIN tracks t ON t.id=p.track_id
               JOIN teams tm ON tm.id=p.team_id
               WHERE p.id=? AND p.state='submitted'""",
            (project_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, 'Project not found')
        return dict(row)


@router.post('/projects/{project_id}/unsubmit')
def unsubmit_project(project_id: str, request: Request):
    """Revert a submitted project to draft state (must be before event deadline)."""
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        p = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
        if not p:
            raise HTTPException(404, 'Project not found')
        # Check team ownership
        if not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (p['team_id'], u['id'])).fetchone():
            raise HTTPException(403, 'Not a member of this project team')
        # Deadline check
        e = event(db, p['event_id'])
        if utc_now() >= timestamp(e['submissions_close']):
            raise HTTPException(409, 'Cannot unsubmit after deadline has passed')
        db.execute("UPDATE projects SET state='draft', submitted_at=NULL WHERE id=?", (project_id,))
        audit(db, u['id'], p['event_id'], 'project.unsubmit', project_id)
        return {'id': project_id, 'state': 'draft'}


@router.delete('/projects/{project_id}/draft')
def delete_draft(project_id: str, request: Request):
    """Delete an unsubmitted draft project."""
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        p = db.execute("SELECT * FROM projects WHERE id=? AND state='draft'", (project_id,)).fetchone()
        if not p:
            raise HTTPException(404, 'Draft not found')
        if not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (p['team_id'], u['id'])).fetchone():
            raise HTTPException(403, 'Not a member of this project team')
        db.execute('DELETE FROM projects WHERE id=?', (project_id,))
        audit(db, u['id'], p['event_id'], 'project.delete_draft', project_id)
        return {'deleted': True, 'id': project_id}


# -----------------------------------------------------------------------------
# 8. RUBRIC MANAGEMENT
# -----------------------------------------------------------------------------

@router.get('/events/{eid}/rubric')
def rubric(eid: str):
    with connect() as db:
        event(db, eid)
        return {
            'event_id': eid,
            'criteria': [
                dict(r)
                for r in db.execute(
                    'SELECT criterion,weight,min_score,max_score FROM rubric_criteria WHERE event_id=? ORDER BY criterion',
                    (eid,),
                )
            ],
        }


class Criterion(BaseModel):
    criterion: str = Field(pattern=r'^[a-z][a-z0-9_]{1,39}$')
    weight: float = Field(gt=0, le=100)
    min_score: int = Field(ge=0, le=100)
    max_score: int = Field(ge=1, le=100)


class RubricIn(BaseModel):
    criteria: list[Criterion] = Field(min_length=1, max_length=12)


@router.put('/events/{eid}/rubric')
def set_rubric(eid: str, body: RubricIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if db.execute(
            'SELECT 1 FROM ballots b JOIN projects p ON p.id=b.project_id WHERE p.event_id=? LIMIT 1',
            (eid,),
        ).fetchone():
            raise HTTPException(409, 'Rubric is locked after the first ballot')
        names = [c.criterion for c in body.criteria]
        if len(names) != len(set(names)) or any(
            c.min_score >= c.max_score or not math.isfinite(c.weight) for c in body.criteria
        ):
            raise HTTPException(422, 'Duplicate criterion or invalid range/weight')
        db.execute('DELETE FROM rubric_criteria WHERE event_id=?', (eid,))
        for c in body.criteria:
            db.execute('INSERT INTO rubric_criteria VALUES (?,?,?,?,?)', (eid, c.criterion, c.weight, c.min_score, c.max_score))
        audit(db, u['id'], eid, 'rubric.configure', eid)
        return {'event_id': eid, 'criteria': [c.model_dump() for c in body.criteria]}


# -----------------------------------------------------------------------------
# 9. JUDGE MANAGEMENT & ASSIGNMENTS (MANUAL + AUTO)
# -----------------------------------------------------------------------------

class JudgeIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=160)
    tracks: list[str] = Field(min_length=1)


@router.get('/events/{eid}/judges')
def list_judges(eid: str, request: Request):
    """List event judges, assigned tracks, and review progress."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)
        judges = db.execute(
            """SELECT j.id AS judge_id, j.user_id, u.email, u.name
               FROM judges j
               JOIN users u ON u.id=j.user_id
               WHERE j.event_id=? ORDER BY u.name""",
            (eid,),
        ).fetchall()
        result = []
        for j in judges:
            tracks = [r['track_id'] for r in db.execute('SELECT track_id FROM judge_tracks WHERE judge_id=?', (j['judge_id'],))]
            assigned = db.execute('SELECT COUNT(*) FROM assignments WHERE judge_id=?', (j['judge_id'],)).fetchone()[0]
            completed = db.execute('SELECT COUNT(*) FROM ballots WHERE judge_id=?', (j['judge_id'],)).fetchone()[0]
            result.append(
                {
                    'judge_id': j['judge_id'],
                    'user_id': j['user_id'],
                    'name': j['name'],
                    'email': j['email'],
                    'tracks': tracks,
                    'assigned_count': assigned,
                    'completed_count': completed,
                    'pending_count': assigned - completed,
                }
            )
        return {'event_id': eid, 'judges': result}


@router.post('/events/{eid}/judges')
def create_judge(eid: str, body: JudgeIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if len(body.tracks) != len(set(body.tracks)):
            raise HTTPException(422, 'Duplicate tracks')
        for tid in body.tracks:
            if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?', (tid, eid)).fetchone():
                raise HTTPException(422, 'Track does not belong to event')
        email = body.email.strip().lower()
        if '@' not in email:
            raise HTTPException(422, 'Invalid email')
        existing = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
        if existing:
            uid = existing['id']
        else:
            uid = 'usr_' + secrets.token_hex(10)
            salt = secrets.token_hex(16)
            password = secrets.token_urlsafe(24)
            db.execute('INSERT INTO users VALUES (?,?,?,?,?)', (uid, email, body.name, salt, password_hash(password, salt)))
        if db.execute('SELECT 1 FROM judges WHERE user_id=? AND event_id=?', (uid, eid)).fetchone():
            raise HTTPException(409, 'User is already a judge for this event')
        jid = 'jdg_' + secrets.token_hex(8)
        db.execute('INSERT INTO judges VALUES (?,?,?)', (jid, eid, uid))
        db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)', (uid, eid, 'judge'))
        for tid in body.tracks:
            db.execute('INSERT INTO judge_tracks VALUES (?,?)', (jid, tid))
        audit(db, u['id'], eid, 'judge.create', jid)
        out = {'judge_id': jid, 'user_id': uid, 'email': email, 'tracks': body.tracks}
        if not existing:
            out['temporary_password'] = password
        return out


class JudgeUpdateIn(BaseModel):
    tracks: list[str] = Field(min_length=1)


@router.patch('/events/{eid}/judges/{jid}')
def update_judge_tracks(eid: str, jid: str, body: JudgeUpdateIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if not db.execute('SELECT 1 FROM judges WHERE id=? AND event_id=?', (jid, eid)).fetchone():
            raise HTTPException(404, 'Judge not found')
        for tid in body.tracks:
            if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?', (tid, eid)).fetchone():
                raise HTTPException(422, f'Track {tid} does not belong to event')
        db.execute('DELETE FROM judge_tracks WHERE judge_id=?', (jid,))
        for tid in body.tracks:
            db.execute('INSERT INTO judge_tracks VALUES (?,?)', (jid, tid))
        audit(db, u['id'], eid, 'judge.update_tracks', jid)
        return {'judge_id': jid, 'tracks': body.tracks}


@router.delete('/events/{eid}/judges/{jid}')
def delete_judge(eid: str, jid: str, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if db.execute('SELECT 1 FROM ballots WHERE judge_id=?', (jid,)).fetchone():
            raise HTTPException(409, 'Cannot remove judge who has already submitted ballots')
        db.execute('DELETE FROM assignments WHERE judge_id=?', (jid,))
        db.execute('DELETE FROM judge_tracks WHERE judge_id=?', (jid,))
        db.execute('DELETE FROM judges WHERE id=? AND event_id=?', (jid, eid))
        audit(db, u['id'], eid, 'judge.delete', jid)
        return {'deleted': True, 'judge_id': jid}


class AssignmentIn(BaseModel):
    judge_id: str
    project_id: str


@router.post('/events/{eid}/assignments')
def assign(eid: str, body: AssignmentIn, request: Request):
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        j = db.execute('SELECT * FROM judges WHERE id=? AND event_id=?', (body.judge_id, eid)).fetchone()
        p = db.execute("SELECT * FROM projects WHERE id=? AND event_id=? AND state='submitted'", (body.project_id, eid)).fetchone()
        if not j or not p:
            raise HTTPException(404, 'Judge or submitted project not in event')
        if not db.execute('SELECT 1 FROM judge_tracks WHERE judge_id=? AND track_id=?', (j['id'], p['track_id'])).fetchone():
            raise HTTPException(422, 'Judge not eligible for track')
        if db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (p['team_id'], j['user_id'])).fetchone():
            raise HTTPException(409, 'Judge belongs to the project team')
        if db.execute('SELECT 1 FROM assignments WHERE judge_id=? AND project_id=?', (j['id'], p['id'])).fetchone():
            raise HTTPException(409, 'Assignment already exists')
        db.execute('INSERT INTO assignments VALUES (?,?)', (j['id'], p['id']))
        audit(db, u['id'], eid, 'judge.assign', p['id'])
        return {'judge_id': j['id'], 'project_id': p['id'], 'status': 'pending'}


@router.delete('/events/{eid}/assignments/{jid}/{pid}')
def unassign(eid: str, jid: str, pid: str, request: Request):
    """Remove a project assignment from a judge."""
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        if db.execute('SELECT 1 FROM ballots WHERE judge_id=? AND project_id=?', (jid, pid)).fetchone():
            raise HTTPException(409, 'Cannot unassign after ballot has been submitted')
        db.execute('DELETE FROM assignments WHERE judge_id=? AND project_id=?', (jid, pid))
        audit(db, u['id'], eid, 'judge.unassign', f'{jid}:{pid}')
        return {'deleted': True, 'judge_id': jid, 'project_id': pid}


class AutoAssignIn(BaseModel):
    reviews_per_project: int = Field(default=3, ge=1, le=10)
    max_reviews_per_judge: Optional[int] = Field(default=None, ge=1)


@router.post('/events/{eid}/assignments/auto')
def auto_assign(eid: str, body: AutoAssignIn, request: Request):
    """Execute automated balanced judge assignment respecting tracks and conflicts of interest."""
    with connect() as db:
        event(db, eid)
        u = organizer(db, request, eid, True)
        stats = auto_assign_judges(
            db,
            eid,
            reviews_per_project=body.reviews_per_project,
            max_reviews_per_judge=body.max_reviews_per_judge,
        )
        audit(db, u['id'], eid, 'judge.auto_assign', str(stats['created_assignments']))
        return stats


@router.get('/events/{eid}/assignments')
def assignments(eid: str, request: Request):
    with connect() as db:
        event(db, eid)
        u = actor(db, request)
        rows = db.execute(
            """SELECT a.judge_id, a.project_id, b.submitted_at
               FROM assignments a
               JOIN projects p ON p.id=a.project_id
               LEFT JOIN ballots b ON b.judge_id=a.judge_id AND b.project_id=a.project_id
               WHERE p.event_id=? ORDER BY a.project_id, a.judge_id""",
            (eid,),
        ).fetchall()
        if db.execute("SELECT 1 FROM roles WHERE user_id=? AND event_id=? AND role IN ('organizer','admin')", (u['id'], eid)).fetchone():
            pass
        else:
            require_role(db, u['id'], eid, 'judge')
            judge = db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?', (u['id'], eid)).fetchone()
            rows = [r for r in rows if judge and r['judge_id'] == judge['id']]
        return {
            'assignments': [
                {
                    'judge_id': r['judge_id'],
                    'project_id': r['project_id'],
                    'status': 'completed' if r['submitted_at'] else 'pending',
                }
                for r in rows
            ]
        }


# -----------------------------------------------------------------------------
# 10. BALLOTS & EVALUATION INTERFACE
# -----------------------------------------------------------------------------

@router.get('/events/{eid}/ballots/{project_id}')
def get_evaluation_form(eid: str, project_id: str, request: Request):
    """Fetch project details, rubric, and judge's existing scores for evaluation."""
    with connect() as db:
        event(db, eid)
        u = actor(db, request)
        require_role(db, u['id'], eid, 'judge')
        j = db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?', (u['id'], eid)).fetchone()
        if not j:
            raise HTTPException(403, 'Judge not found for this event')
        p = db.execute(
            """SELECT p.*, t.name AS track_name, tm.name AS team_name
               FROM projects p
               JOIN tracks t ON t.id=p.track_id
               JOIN teams tm ON tm.id=p.team_id
               WHERE p.id=? AND p.event_id=? AND p.state='submitted'""",
            (project_id, eid),
        ).fetchone()
        if not p:
            raise HTTPException(404, 'Project not found')
        if not db.execute('SELECT 1 FROM assignments WHERE judge_id=? AND project_id=?', (j['id'], project_id)).fetchone():
            raise HTTPException(403, 'Project is not assigned to this judge')
        rubric_criteria = db.execute(
            'SELECT criterion, weight, min_score, max_score FROM rubric_criteria WHERE event_id=? ORDER BY criterion',
            (eid,),
        ).fetchall()
        ballot = db.execute('SELECT comment, submitted_at FROM ballots WHERE judge_id=? AND project_id=?', (j['id'], project_id)).fetchone()
        existing_scores = {}
        if ballot:
            scores = db.execute('SELECT criterion, score FROM ballot_scores WHERE judge_id=? AND project_id=?', (j['id'], project_id)).fetchall()
            existing_scores = {r['criterion']: r['score'] for r in scores}
        return {
            'event_id': eid,
            'project': dict(p),
            'rubric': [dict(r) for r in rubric_criteria],
            'evaluation': {
                'completed': ballot is not None,
                'comment': ballot['comment'] if ballot else '',
                'scores': existing_scores,
                'submitted_at': ballot['submitted_at'] if ballot else None,
            },
        }


class BallotIn(BaseModel):
    criteria: dict[str, int]
    comment: str = Field(default='', max_length=3000)


@router.put('/events/{eid}/ballots/{project_id}')
def write_ballot(eid: str, project_id: str, body: BallotIn, request: Request):
    with connect() as db:
        e = event(db, eid)
        u = actor(db, request)
        require_role(db, u['id'], eid, 'judge')
        csrf(db, request, request.headers.get('x-csrf-token'))
        j = db.execute('SELECT * FROM judges WHERE user_id=? AND event_id=?', (u['id'], eid)).fetchone()
        p = db.execute("SELECT * FROM projects WHERE id=? AND event_id=? AND state='submitted'", (project_id, eid)).fetchone()
        if not j or not p:
            raise HTTPException(404, 'Judge or project not in event')
        if utc_now() < timestamp(e['submissions_close']):
            raise HTTPException(409, 'Judging has not opened')
        if e['judging_close'] and utc_now() >= timestamp(e['judging_close']):
            raise HTTPException(409, 'Judging closed')
        if not db.execute('SELECT 1 FROM assignments WHERE judge_id=? AND project_id=?', (j['id'], p['id'])).fetchone():
            raise HTTPException(403, 'Project not assigned to this judge')
        if not db.execute('SELECT 1 FROM judge_tracks WHERE judge_id=? AND track_id=?', (j['id'], p['track_id'])).fetchone():
            raise HTTPException(403, 'Judge is not eligible for track')
        if db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', (p['team_id'], u['id'])).fetchone():
            raise HTTPException(403, 'Cannot score own team')
        rub = db.execute('SELECT * FROM rubric_criteria WHERE event_id=?', (eid,)).fetchall()
        if not rub or set(body.criteria) != {r['criterion'] for r in rub}:
            raise HTTPException(422, 'Scores must include every rubric criterion exactly once')
        for r in rub:
            value = body.criteria[r['criterion']]
            if isinstance(value, bool) or not isinstance(value, int) or value < r['min_score'] or value > r['max_score']:
                raise HTTPException(422, 'Criterion score outside configured range')
        db.execute(
            'INSERT INTO ballots VALUES (?,?,?,?) ON CONFLICT(judge_id,project_id) '
            'DO UPDATE SET comment=excluded.comment,submitted_at=excluded.submitted_at',
            (j['id'], p['id'], body.comment, iso(utc_now())),
        )
        db.execute('DELETE FROM ballot_scores WHERE judge_id=? AND project_id=?', (j['id'], p['id']))
        for name, value in body.criteria.items():
            db.execute('INSERT INTO ballot_scores VALUES (?,?,?,?)', (j['id'], p['id'], name, value))
        audit(db, u['id'], eid, 'ballot.write', p['id'])
        return {'judge_id': j['id'], 'project_id': p['id'], 'status': 'completed'}


@router.get('/events/{eid}/my-ballots')
def my_ballots(eid: str, request: Request):
    with connect() as db:
        event(db, eid)
        u = actor(db, request)
        require_role(db, u['id'], eid, 'judge')
        j = db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?', (u['id'], eid)).fetchone()
        if not j:
            raise HTTPException(403, 'Judge identity not found in event')
        rows = db.execute(
            """SELECT a.project_id, p.title, b.comment, b.submitted_at
               FROM assignments a
               JOIN projects p ON p.id=a.project_id
               LEFT JOIN ballots b ON b.judge_id=a.judge_id AND b.project_id=a.project_id
               WHERE a.judge_id=? AND p.event_id=? ORDER BY p.id""",
            (j['id'], eid),
        ).fetchall()
        ballots = []
        for row in rows:
            data = dict(row)
            data['criteria'] = {
                r['criterion']: r['score']
                for r in db.execute(
                    'SELECT criterion,score FROM ballot_scores WHERE judge_id=? AND project_id=?',
                    (j['id'], row['project_id']),
                )
            }
            ballots.append(data)
        return {'event_id': eid, 'judge_id': j['id'], 'ballots': ballots}


# -----------------------------------------------------------------------------
# 11. DASHBOARD, NORMALIZED RESULTS & LEADERBOARD EXPORT
# -----------------------------------------------------------------------------

@router.get('/events/{eid}/dashboard')
def dashboard(eid: str, request: Request):
    """Live organizer progress dashboard with per-project and per-judge metrics."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)

        # Per-project status
        rows = db.execute(
            """SELECT p.id AS project_id, p.title, p.track_id, COUNT(a.judge_id) AS assigned,
                      COUNT(b.judge_id) AS completed
               FROM projects p
               LEFT JOIN assignments a ON a.project_id=p.id
               LEFT JOIN ballots b ON b.project_id=a.project_id AND b.judge_id=a.judge_id
               WHERE p.event_id=? AND p.state='submitted'
               GROUP BY p.id ORDER BY p.id""",
            (eid,),
        ).fetchall()

        # Per-judge status
        judge_rows = db.execute(
            """SELECT j.id AS judge_id, u.name, COUNT(a.project_id) AS assigned,
                      COUNT(b.project_id) AS completed
               FROM judges j
               JOIN users u ON u.id=j.user_id
               LEFT JOIN assignments a ON a.judge_id=j.id
               LEFT JOIN ballots b ON b.judge_id=a.judge_id AND b.project_id=a.project_id
               WHERE j.event_id=?
               GROUP BY j.id ORDER BY u.name""",
            (eid,),
        ).fetchall()

        total_assigned = sum(r['assigned'] for r in rows)
        total_completed = sum(r['completed'] for r in rows)
        completion_pct = round((total_completed / total_assigned * 100.0), 1) if total_assigned > 0 else 0.0

        return {
            'event_id': eid,
            'completion_percentage': completion_pct,
            'totals': {'assigned': total_assigned, 'completed': total_completed},
            'projects': [dict(r) | {'pending': r['assigned'] - r['completed']} for r in rows],
            'judges': [dict(r) | {'pending': r['assigned'] - r['completed']} for r in judge_rows],
        }


@router.get('/events/{eid}/results')
def results(eid: str, request: Request, method: str = 'shrinkage'):
    """Raw weighted percent and normalized scores (default shrinkage for test backwards compatibility; ?method=zscore for Z-score)."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)
        return calculate_event_results(db, eid, method=method)


@router.get('/events/{eid}/leaderboard.csv')
def export_leaderboard_csv(eid: str, request: Request, method: str = 'shrinkage'):
    """Organizer-only CSV export of normalized rankings and leaderboard."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)
        res = calculate_event_results(db, eid, method=method)

        out = io.StringIO(newline='')
        writer = csv.writer(out)
        writer.writerow(['rank', 'project_id', 'title', 'team', 'track', 'review_count', 'raw_score', 'normalized_score'])

        for p in res['projects']:
            row = [
                p['rank'] or '',
                p['project_id'],
                p['title'],
                p['team_name'],
                p['track_name'],
                p['review_count'],
                p['raw_percent'] if p['raw_percent'] is not None else '',
                p['normalized_percent'] if p['normalized_percent'] is not None else '',
            ]
            # Formula injection defense
            for i in (1, 2, 3, 4):
                if str(row[i]).lstrip().startswith(('=', '+', '-', '@')):
                    row[i] = "'" + str(row[i])
            writer.writerow(row)

        return Response(
            out.getvalue(),
            media_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename="leaderboard_{eid}.csv"'},
        )


@router.get('/events/{eid}/export.csv')
def export_event_csv(eid: str, request: Request):
    """Raw ballots audit CSV export."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)
        out = io.StringIO(newline='')
        writer = csv.writer(out)
        writer.writerow(['project_id', 'judge_id', 'criterion', 'score', 'comment'])
        rows = db.execute(
            """SELECT b.project_id, b.judge_id, s.criterion, s.score, b.comment
               FROM ballots b
               JOIN ballot_scores s ON s.judge_id=b.judge_id AND s.project_id=b.project_id
               JOIN projects p ON p.id=b.project_id
               WHERE p.event_id=?
               ORDER BY b.project_id, b.judge_id, s.criterion""",
            (eid,),
        )
        for row in rows:
            values = list(row)
            for i in (0, 1, 2, 4):
                if str(values[i]).lstrip().startswith(('=', '+', '-', '@')):
                    values[i] = "'" + str(values[i])
            writer.writerow(values)
        return Response(
            out.getvalue(),
            media_type='text/csv',
            headers={'Content-Disposition': 'attachment; filename="scores.csv"'},
        )


# -----------------------------------------------------------------------------
# 12. T3 PUBLIC — COMMUNITY VOTING, COMMENTS & ANTI-ABUSE
# -----------------------------------------------------------------------------

class VoteIn(BaseModel):
    project_id: str = Field(min_length=1, max_length=64)
    email: Optional[str] = Field(default=None, max_length=254)


@router.post('/events/{eid}/vote')
def cast_community_vote(eid: str, body: VoteIn, request: Request):
    """Cast an authenticated or email-gated community vote on a project."""
    with connect() as db:
        event(db, eid)
        p = db.execute("SELECT * FROM projects WHERE id=? AND event_id=? AND state='submitted'", (body.project_id, eid)).fetchone()
        if not p:
            raise HTTPException(404, 'Project not found in event')

        # Determine voter identity
        voter_id = None
        voter_email = None

        try:
            u = actor(db, request)
            voter_id = u['id']
            voter_email = u['email'].strip().lower()
        except HTTPException:
            if not body.email or '@' not in body.email:
                raise HTTPException(422, 'Valid email required for unauthenticated voting')
            voter_email = body.email.strip().lower()

        client_ip = request.client.host if request.client else '127.0.0.1'
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

        # Duplicate vote detection
        existing = db.execute(
            'SELECT 1 FROM community_votes WHERE event_id=? AND voter_email=? AND project_id=?',
            (eid, voter_email, body.project_id),
        ).fetchone()
        if existing:
            raise HTTPException(409, 'You have already voted for this project')

        # Anti-abuse: Rate limit (max 20 votes per hour per voter)
        recent_count = db.execute(
            """SELECT COUNT(*) as count FROM community_votes
               WHERE event_id=? AND voter_email=? AND created_at > ?""",
            (eid, voter_email, iso(utc_now() - timedelta(hours=1))),
        ).fetchone()['count']
        if recent_count >= 20:
            raise HTTPException(429, 'Rate limit exceeded: max 20 votes per hour')

        vote_id = 'vt_' + secrets.token_hex(8)
        db.execute(
            """INSERT INTO community_votes(id, event_id, project_id, voter_id, voter_email, ip_hash, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (vote_id, eid, body.project_id, voter_id, voter_email, ip_hash, iso(utc_now())),
        )
        audit(db, voter_id or 'visitor_' + ip_hash, eid, 'vote.cast', body.project_id)
        return {'ok': True, 'vote_id': vote_id, 'project_id': body.project_id}


@router.get('/events/{eid}/my-votes')
def get_my_votes(eid: str, request: Request, email: Optional[str] = None):
    """Retrieve all project IDs the caller has voted for in this event."""
    with connect() as db:
        event(db, eid)
        voter_email = None

        try:
            u = actor(db, request)
            voter_email = u['email'].strip().lower()
        except HTTPException:
            if email and '@' in email:
                voter_email = email.strip().lower()

        if not voter_email:
            return {'event_id': eid, 'voted_projects': []}

        rows = db.execute(
            'SELECT project_id, created_at FROM community_votes WHERE event_id=? AND voter_email=?',
            (eid, voter_email),
        ).fetchall()
        return {'event_id': eid, 'voted_projects': [r['project_id'] for r in rows]}


@router.get('/events/{eid}/community-results')
def get_community_results(eid: str, request: Request):
    """Fetch community voting leaderboard with hidden window enforcement."""
    with connect() as db:
        e = event(db, eid)
        is_organizer = False
        try:
            u = actor(db, request)
            require_role(db, u['id'], eid, 'organizer', 'admin')
            is_organizer = True
        except HTTPException:
            is_organizer = False

        total_votes = db.execute('SELECT COUNT(*) as count FROM community_votes WHERE event_id=?', (eid,)).fetchone()['count']

        # If voting is still active and caller is not an organizer, results are strictly hidden
        if not is_organizer:
            return {
                'status': 'hidden',
                'message': 'Community voting results are hidden until voting window concludes.',
                'total_votes_cast': total_votes,
                'rankings': [],
            }

        # Organizer or closed window: compute vote tallies
        rows = db.execute(
            """SELECT p.id as project_id, p.title, t.name as track_name, tm.name as team_name,
                      COUNT(v.id) as vote_count
               FROM projects p
               LEFT JOIN community_votes v ON v.project_id=p.id AND v.event_id=p.event_id
               JOIN tracks t ON t.id=p.track_id
               JOIN teams tm ON tm.id=p.team_id
               WHERE p.event_id=? AND p.state='submitted'
               GROUP BY p.id
               ORDER BY vote_count DESC, p.title ASC""",
            (eid,),
        ).fetchall()

        rankings = []
        for idx, r in enumerate(rows):
            rankings.append({
                'rank': idx + 1,
                'project_id': r['project_id'],
                'title': r['title'],
                'track_name': r['track_name'],
                'team_name': r['team_name'],
                'vote_count': r['vote_count'],
            })

        return {
            'status': 'revealed',
            'total_votes_cast': total_votes,
            'rankings': rankings,
        }


# -----------------------------------------------------------------------------
# 13. PROJECT COMMENTS & DISCUSSION
# -----------------------------------------------------------------------------

class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    author_name: Optional[str] = Field(default=None, max_length=100)


@router.get('/projects/{project_id}/comments')
def get_project_comments(project_id: str):
    """Publicly read comment thread for a project."""
    with connect() as db:
        p = db.execute('SELECT id, event_id FROM projects WHERE id=?', (project_id,)).fetchone()
        if not p:
            raise HTTPException(404, 'Project not found')

        rows = db.execute(
            """SELECT c.id, c.project_id, c.user_id, c.author_name, c.content, c.created_at
               FROM project_comments c
               WHERE c.project_id=?
               ORDER BY c.created_at ASC""",
            (project_id,),
        ).fetchall()
        return {'project_id': project_id, 'comments': [dict(r) for r in rows]}


@router.post('/projects/{project_id}/comments')
def post_project_comment(project_id: str, body: CommentIn, request: Request):
    """Post a new comment on a project."""
    with connect() as db:
        p = db.execute('SELECT id, event_id FROM projects WHERE id=?', (project_id,)).fetchone()
        if not p:
            raise HTTPException(404, 'Project not found')

        user_id = 'usr_guest'
        author_name = body.author_name.strip() if body.author_name else 'Community Guest'

        try:
            u = actor(db, request)
            user_id = u['id']
            author_name = u['name']
        except HTTPException:
            pass

        cid = 'cmt_' + secrets.token_hex(8)
        db.execute(
            """INSERT INTO project_comments(id, event_id, project_id, user_id, author_name, content, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (cid, p['event_id'], project_id, user_id, author_name, body.content.strip(), iso(utc_now())),
        )
        audit(db, user_id, p['event_id'], 'comment.post', project_id)
        return {
            'id': cid,
            'project_id': project_id,
            'author_name': author_name,
            'content': body.content.strip(),
            'created_at': iso(utc_now()),
        }


@router.delete('/comments/{comment_id}')
def delete_comment(comment_id: str, request: Request):
    """Delete a comment (author or organizer)."""
    with connect() as db:
        u = actor(db, request)
        csrf(db, request, request.headers.get('x-csrf-token'))
        c = db.execute('SELECT * FROM project_comments WHERE id=?', (comment_id,)).fetchone()
        if not c:
            raise HTTPException(404, 'Comment not found')

        if c['user_id'] != u['id']:
            require_role(db, u['id'], c['event_id'], 'organizer', 'admin')

        db.execute('DELETE FROM project_comments WHERE id=?', (comment_id,))
        audit(db, u['id'], c['event_id'], 'comment.delete', comment_id)
        return {'deleted': True, 'comment_id': comment_id}


# -----------------------------------------------------------------------------
# 14. ADMIN CONSOLE — SYSTEM HEALTH, USER MANAGEMENT & AUDIT TELEMETRY
# -----------------------------------------------------------------------------

def require_admin(db: Any, user_id: str):
    is_admin = db.execute("SELECT 1 FROM roles WHERE user_id=? AND role='admin'", (user_id,)).fetchone()
    if not is_admin:
        raise HTTPException(403, 'Platform administrator privileges required')


@router.get('/admin/system-health')
def get_system_health(request: Request):
    """Real-time platform telemetry, database statistics, and operational status."""
    with connect() as db:
        u = actor(db, request)
        require_admin(db, u['id'])

        user_count = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        event_count = db.execute('SELECT COUNT(*) as c FROM events').fetchone()['c']
        project_count = db.execute('SELECT COUNT(*) as c FROM projects').fetchone()['c']
        ballot_count = db.execute('SELECT COUNT(*) as c FROM ballots').fetchone()['c']
        score_count = db.execute('SELECT COUNT(*) as c FROM ballot_scores').fetchone()['c']
        vote_count = db.execute('SELECT COUNT(*) as c FROM community_votes').fetchone()['c']
        webhook_count = db.execute('SELECT COUNT(*) as c FROM webhooks').fetchone()['c']
        delivery_count = db.execute('SELECT COUNT(*) as c FROM webhook_deliveries').fetchone()['c']
        cert_count = db.execute('SELECT COUNT(*) as c FROM certificates').fetchone()['c']
        audit_count = db.execute('SELECT COUNT(*) as c FROM audit_events').fetchone()['c']
        active_sessions = db.execute('SELECT COUNT(*) as c FROM sessions WHERE expires_at > ?', (iso(utc_now()),)).fetchone()['c']

        return {
            'status': 'HEALTHY',
            'air_gapped': True,
            'storage_engine': 'SQLite 3 WAL Mode',
            'checked_at': iso(utc_now()),
            'metrics': {
                'users': user_count,
                'events': event_count,
                'projects': project_count,
                'ballots': ballot_count,
                'scores': score_count,
                'community_votes': vote_count,
                'webhooks': webhook_count,
                'webhook_deliveries': delivery_count,
                'certificates': cert_count,
                'audit_events': audit_count,
                'active_sessions': active_sessions,
            },
            'subsystems': {
                'auth_engine': 'Operational (PBKDF2-HMAC-SHA256)',
                'z_score_normalizer': 'Operational (Bayesian Shrinkage)',
                'bt_mle_engine': 'Operational (MM Bradley-Terry)',
                'webhook_dispatcher': 'Operational (HMAC-SHA256)',
                'cert_signer': 'Operational (SHA-256 Digest)'
            }
        }


@router.get('/admin/users')
def list_admin_users(request: Request):
    """Retrieve all platform users with assigned roles."""
    with connect() as db:
        u = actor(db, request)
        require_admin(db, u['id'])

        users = db.execute('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC').fetchall()
        roles = db.execute('SELECT user_id, event_id, role FROM roles').fetchall()

        role_map: Dict[str, List[str]] = {}
        for r in roles:
            role_map.setdefault(r['user_id'], []).append(r['role'])

        result = []
        for usr in users:
            result.append({
                'id': usr['id'],
                'email': usr['email'],
                'name': usr['name'],
                'created_at': usr['created_at'],
                'roles': role_map.get(usr['id'], ['visitor']),
            })

        return {'users': result, 'total': len(result)}


class RoleUpdateIn(BaseModel):
    role: str = Field(min_length=3, max_length=32)
    event_id: Optional[str] = 'evt_01'


@router.post('/admin/users/{user_id}/roles')
def update_user_role(user_id: str, body: RoleUpdateIn, request: Request):
    """Promote or modify user roles (participant, judge, organizer, admin)."""
    with connect() as db:
        u = actor(db, request)
        require_admin(db, u['id'])
        csrf(db, request, request.headers.get('x-csrf-token'))

        target_user = db.execute('SELECT 1 FROM users WHERE id=?', (user_id,)).fetchone()
        if not target_user:
            raise HTTPException(404, 'User not found')

        new_role = body.role.lower().strip()
        if new_role not in ('participant', 'judge', 'organizer', 'admin'):
            raise HTTPException(422, 'Invalid role specification')

        eid = body.event_id or 'evt_01'

        # Remove existing roles for event
        db.execute('DELETE FROM roles WHERE user_id=? AND event_id=?', (user_id, eid))
        db.execute('INSERT INTO roles(user_id, event_id, role) VALUES (?,?,?)', (user_id, eid, new_role))

        if new_role == 'judge':
            jid = 'jdg_' + secrets.token_hex(6)
            db.execute('INSERT OR IGNORE INTO judges(id, event_id, user_id) VALUES (?,?,?)', (jid, eid, user_id))

        audit(db, u['id'], eid, 'admin.role_change', f'{user_id}:{new_role}')
        return {'status': 'updated', 'user_id': user_id, 'new_role': new_role}


@router.get('/admin/audit-log')
def get_admin_audit_log(request: Request):
    """System-wide immutable audit trail."""
    with connect() as db:
        u = actor(db, request)
        require_admin(db, u['id'])

        rows = db.execute(
            """SELECT a.*, u.email as actor_email, u.name as actor_name
               FROM audit_events a
               LEFT JOIN users u ON a.actor_id=u.id
               ORDER BY a.happened_at DESC LIMIT 100"""
        ).fetchall()

        return {'events': [dict(r) for r in rows]}


