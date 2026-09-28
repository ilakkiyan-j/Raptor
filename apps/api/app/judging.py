"""Judging engine, assignments, evaluation ballots, score normalization, CSV exports, and pairwise ranking."""
import csv
import io
import math
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .assignment import auto_assign_judges
from .auth import actor, csrf, iso, password_hash, require_role, utc_now
from .common import audit, event, organizer, timestamp
from .db import connect
from .normalization import calculate_event_results

router = APIRouter(prefix='/api')


# -----------------------------------------------------------------------------
# 1. JUDGE MANAGEMENT
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


# -----------------------------------------------------------------------------
# 2. ASSIGNMENTS (MANUAL + AUTOMATED BALANCER)
# -----------------------------------------------------------------------------

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
# 3. BALLOTS & EVALUATION INTERFACE
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
# 4. DASHBOARD, NORMALIZED RESULTS & EXPORTS
# -----------------------------------------------------------------------------

@router.get('/events/{eid}/dashboard')
def dashboard(eid: str, request: Request):
    """Live organizer progress dashboard with per-project and per-judge metrics."""
    with connect() as db:
        event(db, eid)
        organizer(db, request, eid)

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
# 5. BRADLEY-TERRY PAIRWISE JUDGING (BONUS CHALLENGE 2)
# -----------------------------------------------------------------------------

class PairwiseVoteIn(BaseModel):
    winner_project_id: str
    loser_project_id: str
    track_id: Optional[str] = None


@router.post('/events/{event_id}/pairwise-vote')
def submit_pairwise_vote(event_id: str, body: PairwiseVoteIn, request: Request):
    """Pairwise head-to-head project comparison by assigned judge."""
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'judge', 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))

        judge = db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?', (u['id'], event_id)).fetchone()
        judge_id = judge['id'] if judge else 'jdg_organizer'

        if body.winner_project_id == body.loser_project_id:
            raise HTTPException(422, 'Cannot compare a project to itself')

        p1 = db.execute('SELECT 1 FROM projects WHERE id=? AND event_id=?', (body.winner_project_id, event_id)).fetchone()
        p2 = db.execute('SELECT 1 FROM projects WHERE id=? AND event_id=?', (body.loser_project_id, event_id)).fetchone()
        if not p1 or not p2:
            raise HTTPException(404, 'One or both projects not found')

        comp_id = 'cmp_' + secrets.token_hex(8)
        db.execute(
            """INSERT OR REPLACE INTO pairwise_comparisons(id, event_id, judge_id, track_id, winner_project_id, loser_project_id, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (comp_id, event_id, judge_id, body.track_id, body.winner_project_id, body.loser_project_id, iso(utc_now()))
        )
        audit(db, u['id'], event_id, 'pairwise.vote', f'{body.winner_project_id}>{body.loser_project_id}')
        return {'status': 'recorded', 'comparison_id': comp_id}


@router.get('/events/{event_id}/pairwise-rankings')
def calculate_pairwise_rankings(event_id: str):
    """Compute Bradley-Terry Maximum Likelihood Estimator latent skill rankings."""
    with connect() as db:
        event(db, event_id)
        projects = db.execute(
            "SELECT p.id, p.title, t.name as track_name, tm.name as team_name FROM projects p JOIN tracks t ON p.track_id=t.id JOIN teams tm ON p.team_id=tm.id WHERE p.event_id=? AND p.state='submitted'",
            (event_id,)
        ).fetchall()

        comparisons = db.execute(
            'SELECT winner_project_id, loser_project_id FROM pairwise_comparisons WHERE event_id=?',
            (event_id,)
        ).fetchall()

        if not comparisons:
            return {'status': 'no_comparisons', 'rankings': []}

        proj_ids = [p['id'] for p in projects]
        skills = {pid: 1.0 for pid in proj_ids}
        wins = {pid: 0 for pid in proj_ids}
        head_to_head: Dict[str, Dict[str, int]] = {p1: {p2: 0 for p2 in proj_ids} for p1 in proj_ids}

        for c in comparisons:
            w, l = c['winner_project_id'], c['loser_project_id']
            if w in wins:
                wins[w] += 1
            if w in head_to_head and l in head_to_head[w]:
                head_to_head[w][l] += 1

        for _ in range(50):
            new_skills = {}
            for i in proj_ids:
                denom = 0.0
                for j in proj_ids:
                    if i != j:
                        n_ij = head_to_head[i][j] + head_to_head[j][i]
                        if n_ij > 0 and (skills[i] + skills[j]) > 0:
                            denom += n_ij / (skills[i] + skills[j])
                new_skills[i] = (wins[i] / denom) if denom > 0 else 0.001

            log_sum = sum(math.log(max(1e-6, s)) for s in new_skills.values())
            scale = math.exp(log_sum / max(1, len(proj_ids)))
            skills = {k: v / scale for k, v in new_skills.items()}

        sorted_projects = sorted(projects, key=lambda p: skills.get(p['id'], 0.0), reverse=True)

        rankings = []
        for idx, p in enumerate(sorted_projects):
            rankings.append({
                'rank': idx + 1,
                'project_id': p['id'],
                'title': p['title'],
                'track_name': p['track_name'],
                'team_name': p['team_name'],
                'bt_latent_skill': round(skills.get(p['id'], 0.0), 4),
                'wins': wins.get(p['id'], 0)
            })

        return {
            'model': 'Bradley-Terry Maximum Likelihood Estimator',
            'total_comparisons': len(comparisons),
            'rankings': rankings
        }
