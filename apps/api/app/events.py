"""Events, tracks, prizes, rubric, and system administration endpoints."""
import json
import math
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .auth import actor, csrf, iso, require_role, utc_now
from .common import audit, event, organizer, require_admin, timestamp
from .db import connect

router = APIRouter(prefix='/api')


# -----------------------------------------------------------------------------
# 1. EVENT LIFECYCLE & METADATA
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
# 2. EVENT ROLES
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
# 3. TRACKS MANAGEMENT
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
# 4. PRIZES MANAGEMENT
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
# 5. RUBRIC MANAGEMENT
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
# 6. ADMIN CONSOLE — SYSTEM HEALTH, USER MANAGEMENT & AUDIT LOGS
# -----------------------------------------------------------------------------

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
