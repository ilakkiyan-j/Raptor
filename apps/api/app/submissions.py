"""Project submissions, draft lifecycle, public showcase, comments, and community voting."""
import hashlib
import secrets
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .auth import actor, csrf, iso, require_role, utc_now
from .common import audit, event, timestamp
from .db import connect

router = APIRouter(prefix='/api')


# -----------------------------------------------------------------------------
# 1. DRAFT & SUBMISSION LIFECYCLE
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
# 2. COMMUNITY VOTING & ANTI-ABUSE
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

        if not is_organizer:
            return {
                'status': 'hidden',
                'message': 'Community voting results are hidden until voting window concludes.',
                'total_votes_cast': total_votes,
                'rankings': [],
            }

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
# 3. PROJECT COMMENTS & DISCUSSION
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
