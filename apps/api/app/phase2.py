"""Event/team setup and event-scoped judging workflow. JSON API only."""
import hashlib
import math
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from .auth import actor, csrf, iso, password_hash, require_role, utc_now
from .db import connect

router = APIRouter(prefix='/api')

def timestamp(value):
    try:
        dt=datetime.fromisoformat(value.replace('Z','+00:00'))
        if dt.tzinfo is None: raise ValueError('timezone missing')
        return dt
    except (ValueError,AttributeError):
        raise HTTPException(422,'Expected a timezone-aware ISO timestamp')

def event(db,eid):
    row=db.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone()
    if not row: raise HTTPException(404,'Event not found')
    return row

def audit(db,u,eid,action,subject):
    db.execute('INSERT INTO audit_events(actor_id,event_id,action,subject_id,happened_at) VALUES (?,?,?,?,?)',
               (u,eid,action,subject,iso(utc_now())))

def organizer(db,request,eid,write=False):
    u=actor(db,request)
    require_role(db,u['id'],eid,'organizer','admin')
    if write:csrf(db,request,request.headers.get('x-csrf-token'))
    return u

class EventIn(BaseModel):
    name: str = Field(min_length=2,max_length=160)
    submissions_close: str
    judging_close: str | None = None

@router.post('/events')
def create_event(body: EventIn,request: Request):
    with connect() as db:
        u=actor(db,request)
        # Administrative event creation is global; existing event admin role grants this power.
        if not db.execute("SELECT 1 FROM roles WHERE user_id=? AND role='admin'",(u['id'],)).fetchone():
            raise HTTPException(403,'Admin required to create an event')
        csrf(db,request,request.headers.get('x-csrf-token'))
        close=timestamp(body.submissions_close)
        if close <= utc_now():raise HTTPException(422,'New event submission close must be in future')
        judge_close=timestamp(body.judging_close) if body.judging_close else None
        if judge_close and judge_close <= close: raise HTTPException(422,'Judging must close after submissions')
        eid='evt_'+secrets.token_hex(8)
        db.execute('INSERT INTO events(id,name,submissions_close,judging_close) VALUES (?,?,?,?)',
                   (eid,body.name,iso(close),iso(judge_close) if judge_close else None))
        db.execute('INSERT INTO roles VALUES (?,?,?)',(u['id'],eid,'admin'))
        audit(db,u['id'],eid,'event.create',eid)
        return {'id':eid,'name':body.name,'submissions_close':iso(close),
                'judging_close':iso(judge_close) if judge_close else None}

@router.get('/events')
def events():
    with connect() as db:
        return {'events':[dict(r) for r in db.execute('SELECT * FROM events ORDER BY id')]}

class TrackIn(BaseModel):
    name: str = Field(min_length=1,max_length=100)

@router.post('/events/{eid}/tracks')
def create_track(eid: str,body: TrackIn,request: Request):
    with connect() as db:
        event(db,eid);u=organizer(db,request,eid,True)
        tid='trk_'+secrets.token_hex(8)
        try:db.execute('INSERT INTO tracks VALUES (?,?,?)',(tid,eid,body.name))
        except Exception as exc:
            if 'UNIQUE' in str(exc):raise HTTPException(409,'Track name already exists in event')
            raise
        audit(db,u['id'],eid,'track.create',tid)
        return {'id':tid,'event_id':eid,'name':body.name}

class TeamIn(BaseModel):
    event_id: str
    name: str = Field(min_length=1,max_length=160)

@router.post('/teams')
def create_team(body: TeamIn,request: Request):
    with connect() as db:
        e=event(db,body.event_id)
        u=actor(db,request)
        require_role(db,u['id'],e['id'],'participant','organizer','admin')
        csrf(db,request,request.headers.get('x-csrf-token'))
        if utc_now()>=timestamp(e['submissions_close']):raise HTTPException(409,'Teams are closed')
        tid='tm_'+secrets.token_hex(8)
        db.execute('INSERT INTO teams VALUES (?,?,?)',(tid,e['id'],body.name))
        db.execute('INSERT INTO team_members VALUES (?,?)',(tid,u['id']))
        audit(db,u['id'],e['id'],'team.create',tid)
        return {'id':tid,'event_id':e['id'],'name':body.name}

class InviteIn(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    expires_hours: int = Field(default=48,ge=1,le=168)

@router.post('/teams/{tid}/invites')
def invite(tid: str,body: InviteIn,request: Request):
    with connect() as db:
        u=actor(db,request)
        t=db.execute('SELECT * FROM teams WHERE id=?',(tid,)).fetchone()
        if not t:raise HTTPException(404,'Team not found')
        if not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?',(tid,u['id'])).fetchone():
            require_role(db,u['id'],t['event_id'],'organizer','admin')
        csrf(db,request,request.headers.get('x-csrf-token'))
        if utc_now()>=timestamp(event(db,t['event_id'])['submissions_close']):
            raise HTTPException(409,'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?',(tid,)).fetchone()[0]>=4:
            raise HTTPException(409,'Team is full')
        email=body.email.strip().lower()
        if '@' not in email or email.startswith('@') or email.endswith('@'):
            raise HTTPException(422,'Invalid email')
        token=secrets.token_urlsafe(32)
        expiry=iso(utc_now()+timedelta(hours=body.expires_hours))
        db.execute('INSERT INTO team_invites VALUES (?,?,?,?,?,?)',
                   (hashlib.sha256(token.encode()).hexdigest(),tid,email,expiry,None,u['id']))
        audit(db,u['id'],t['event_id'],'team.invite',tid)
        # Return only to an authorized team member; the application does not email it.
        return {'token':token,'expires_at':expiry,'team_id':tid}

@router.post('/invites/{token}/accept')
def accept_invite(token: str,request: Request):
    with connect() as db:
        u=actor(db,request)
        csrf(db,request,request.headers.get('x-csrf-token'))
        inv=db.execute('SELECT * FROM team_invites WHERE token_hash=?',
                       (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        if not inv or inv['accepted_at'] or timestamp(inv['expires_at'])<=utc_now():
            raise HTTPException(404,'Invite unavailable or expired')
        if u['email'].lower()!=inv['email'].lower():raise HTTPException(403,'Invite belongs to another email')
        t=db.execute('SELECT * FROM teams WHERE id=?',(inv['team_id'],)).fetchone()
        if utc_now()>=timestamp(event(db,t['event_id'])['submissions_close']):
            raise HTTPException(409,'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?',(t['id'],)).fetchone()[0]>=4:
            raise HTTPException(409,'Team is full')
        db.execute('INSERT OR IGNORE INTO team_members VALUES (?,?)',(t['id'],u['id']))
        db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)',(u['id'],t['event_id'],'participant'))
        db.execute('UPDATE team_invites SET accepted_at=? WHERE token_hash=?',
                   (iso(utc_now()),inv['token_hash']))
        audit(db,u['id'],t['event_id'],'team.join',t['id'])
        return {'team_id':t['id'],'joined':True}

@router.get('/events/{eid}/rubric')
def rubric(eid: str):
    with connect() as db:
        event(db,eid)
        return {'event_id':eid,'criteria':[dict(r) for r in db.execute(
            'SELECT criterion,weight,min_score,max_score FROM rubric_criteria WHERE event_id=? ORDER BY criterion',(eid,))]}

class Criterion(BaseModel):
    criterion: str = Field(pattern=r'^[a-z][a-z0-9_]{1,39}$')
    weight: float = Field(gt=0,le=100)
    min_score: int = Field(ge=0,le=100)
    max_score: int = Field(ge=1,le=100)

class RubricIn(BaseModel):
    criteria: list[Criterion] = Field(min_length=1,max_length=12)

@router.put('/events/{eid}/rubric')
def set_rubric(eid: str,body: RubricIn,request: Request):
    with connect() as db:
        event(db,eid);u=organizer(db,request,eid,True)
        if db.execute('SELECT 1 FROM ballots b JOIN projects p ON p.id=b.project_id WHERE p.event_id=? LIMIT 1',
                      (eid,)).fetchone():raise HTTPException(409,'Rubric is locked after the first ballot')
        names=[c.criterion for c in body.criteria]
        if len(names)!=len(set(names)) or any(c.min_score>=c.max_score or not math.isfinite(c.weight) for c in body.criteria):
            raise HTTPException(422,'Duplicate criterion or invalid range/weight')
        db.execute('DELETE FROM rubric_criteria WHERE event_id=?',(eid,))
        for c in body.criteria:
            db.execute('INSERT INTO rubric_criteria VALUES (?,?,?,?,?)',
                       (eid,c.criterion,c.weight,c.min_score,c.max_score))
        audit(db,u['id'],eid,'rubric.configure',eid)
        return {'event_id':eid,'criteria':[c.model_dump() for c in body.criteria]}

class AssignmentIn(BaseModel):
    judge_id: str
    project_id: str

@router.post('/events/{eid}/assignments')
def assign(eid: str,body: AssignmentIn,request: Request):
    with connect() as db:
        event(db,eid);u=organizer(db,request,eid,True)
        j=db.execute('SELECT * FROM judges WHERE id=? AND event_id=?',(body.judge_id,eid)).fetchone()
        p=db.execute("SELECT * FROM projects WHERE id=? AND event_id=? AND state='submitted'",(body.project_id,eid)).fetchone()
        if not j or not p:raise HTTPException(404,'Judge or submitted project not in event')
        if not db.execute('SELECT 1 FROM judge_tracks WHERE judge_id=? AND track_id=?',
                          (j['id'],p['track_id'])).fetchone():raise HTTPException(422,'Judge not eligible for track')
        if db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?',(p['team_id'],j['user_id'])).fetchone():
            raise HTTPException(409,'Judge belongs to the project team')
        if db.execute('SELECT 1 FROM assignments WHERE judge_id=? AND project_id=?',(j['id'],p['id'])).fetchone():
            raise HTTPException(409,'Assignment already exists')
        db.execute('INSERT INTO assignments VALUES (?,?)',(j['id'],p['id']))
        audit(db,u['id'],eid,'judge.assign',p['id'])
        return {'judge_id':j['id'],'project_id':p['id'],'status':'pending'}

@router.get('/events/{eid}/assignments')
def assignments(eid: str,request: Request):
    with connect() as db:
        event(db,eid);u=actor(db,request)
        rows=db.execute('SELECT a.judge_id,a.project_id,b.submitted_at FROM assignments a '
                        'JOIN projects p ON p.id=a.project_id LEFT JOIN ballots b '
                        'ON b.judge_id=a.judge_id AND b.project_id=a.project_id '
                        'WHERE p.event_id=? ORDER BY a.project_id,a.judge_id',(eid,)).fetchall()
        if db.execute("SELECT 1 FROM roles WHERE user_id=? AND event_id=? AND role IN ('organizer','admin')",(u['id'],eid)).fetchone():
            pass
        else:
            require_role(db,u['id'],eid,'judge')
            judge=db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?',(u['id'],eid)).fetchone()
            rows=[r for r in rows if judge and r['judge_id']==judge['id']]
        return {'assignments':[{'judge_id':r['judge_id'],'project_id':r['project_id'],
                                'status':'completed' if r['submitted_at'] else 'pending'} for r in rows]}

class BallotIn(BaseModel):
    criteria: dict[str,int]
    comment: str = Field(default='',max_length=3000)

@router.put('/events/{eid}/ballots/{project_id}')
def write_ballot(eid: str,project_id: str,body: BallotIn,request: Request):
    with connect() as db:
        e=event(db,eid);u=actor(db,request)
        require_role(db,u['id'],eid,'judge')
        csrf(db,request,request.headers.get('x-csrf-token'))
        j=db.execute('SELECT * FROM judges WHERE user_id=? AND event_id=?',(u['id'],eid)).fetchone()
        p=db.execute("SELECT * FROM projects WHERE id=? AND event_id=? AND state='submitted'",(project_id,eid)).fetchone()
        if not j or not p:raise HTTPException(404,'Judge or project not in event')
        if utc_now()<timestamp(e['submissions_close']):raise HTTPException(409,'Judging has not opened')
        if e['judging_close'] and utc_now()>=timestamp(e['judging_close']):raise HTTPException(409,'Judging closed')
        if not db.execute('SELECT 1 FROM assignments WHERE judge_id=? AND project_id=?',(j['id'],p['id'])).fetchone():
            raise HTTPException(403,'Project not assigned to this judge')
        if not db.execute('SELECT 1 FROM judge_tracks WHERE judge_id=? AND track_id=?',(j['id'],p['track_id'])).fetchone():
            raise HTTPException(403,'Judge is not eligible for track')
        if db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?',(p['team_id'],u['id'])).fetchone():
            raise HTTPException(403,'Cannot score own team')
        rub=db.execute('SELECT * FROM rubric_criteria WHERE event_id=?',(eid,)).fetchall()
        if not rub or set(body.criteria)!={r['criterion'] for r in rub}:
            raise HTTPException(422,'Scores must include every rubric criterion exactly once')
        for r in rub:
            value=body.criteria[r['criterion']]
            if isinstance(value,bool) or not isinstance(value,int) or value<r['min_score'] or value>r['max_score']:
                raise HTTPException(422,'Criterion score outside configured range')
        db.execute('INSERT INTO ballots VALUES (?,?,?,?) ON CONFLICT(judge_id,project_id) '
                   'DO UPDATE SET comment=excluded.comment,submitted_at=excluded.submitted_at',
                   (j['id'],p['id'],body.comment,iso(utc_now())))
        db.execute('DELETE FROM ballot_scores WHERE judge_id=? AND project_id=?',(j['id'],p['id']))
        for name,value in body.criteria.items():
            db.execute('INSERT INTO ballot_scores VALUES (?,?,?,?)',(j['id'],p['id'],name,value))
        audit(db,u['id'],eid,'ballot.write',p['id'])
        return {'judge_id':j['id'],'project_id':p['id'],'status':'completed'}

@router.get('/events/{eid}/dashboard')
def dashboard(eid: str,request: Request):
    with connect() as db:
        event(db,eid);organizer(db,request,eid)
        rows=db.execute('SELECT p.id AS project_id,p.title,COUNT(a.judge_id) AS assigned, '
                        'COUNT(b.judge_id) AS completed FROM projects p LEFT JOIN assignments a '
                        'ON a.project_id=p.id LEFT JOIN ballots b '
                        'ON b.project_id=a.project_id AND b.judge_id=a.judge_id '
                        "WHERE p.event_id=? AND p.state='submitted' GROUP BY p.id ORDER BY p.id",(eid,)).fetchall()
        return {'event_id':eid,'projects':[dict(r)|{'pending':r['assigned']-r['completed']} for r in rows],
                'totals':{'assigned':sum(r['assigned'] for r in rows),
                          'completed':sum(r['completed'] for r in rows)}}

@router.get('/events/{eid}/results')
def results(eid: str,request: Request):
    """Raw weighted percent and shrinkage-adjusted judge-mean scores."""
    with connect() as db:
        event(db,eid);organizer(db,request,eid)
        rubric={r['criterion']:dict(r) for r in db.execute(
            'SELECT * FROM rubric_criteria WHERE event_id=?',(eid,))}
        rows=db.execute('SELECT b.judge_id,b.project_id,s.criterion,s.score FROM ballots b '
                        'JOIN projects p ON p.id=b.project_id JOIN ballot_scores s '
                        'ON s.judge_id=b.judge_id AND s.project_id=b.project_id WHERE p.event_id=?',
                        (eid,)).fetchall()
        grouped={}
        for r in rows:grouped.setdefault((r['judge_id'],r['project_id']),{})[r['criterion']]=r['score']
        weights=sum(r['weight'] for r in rubric.values())
        scores={}
        for (jid,pid),values in grouped.items():
            if set(values)!=set(rubric):continue
            score=sum((values[key]-r['min_score'])/(r['max_score']-r['min_score'])*r['weight']
                      for key,r in rubric.items())/weights*100
            scores[(jid,pid)]=score
        global_mean=sum(scores.values())/len(scores) if scores else 50.0
        judge_values={}
        for (jid,pid),value in scores.items():judge_values.setdefault(jid,[]).append(value)
        adjusted={}
        for (jid,pid),value in scores.items():
            vals=judge_values[jid];n=len(vals)
            # Shrink each judge's mean towards the event mean with 3 pseudo-reviews.
            baseline=(sum(vals)+3*global_mean)/(n+3)
            adjusted[(jid,pid)]=max(0,min(100,value-baseline+global_mean))
        projects=db.execute("SELECT id,title FROM projects WHERE event_id=? AND state='submitted' ORDER BY id",(eid,))
        output=[]
        for p in projects:
            pairs=[k for k in scores if k[1]==p['id']]
            output.append({'project_id':p['id'],'title':p['title'],'review_count':len(pairs),
                           'raw_percent':round(sum(scores[k] for k in pairs)/len(pairs),2) if pairs else None,
                           'normalized_percent':round(sum(adjusted[k] for k in pairs)/len(pairs),2) if pairs else None})
        output.sort(key=lambda x:(x['normalized_percent'] is None,-(x['normalized_percent'] or 0),x['project_id']))
        return {'event_id':eid,'method':'weighted percent of configured range; judge mean centered on event mean using 3 pseudo-reviews; final scores clipped to 0-100',
                'global_mean_percent':round(global_mean,2),'projects':output}

class JudgeIn(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    name: str = Field(min_length=1,max_length=160)
    tracks: list[str] = Field(min_length=1)

@router.post('/events/{eid}/judges')
def create_judge(eid: str,body: JudgeIn,request: Request):
    """Provision local demo judge credentials; don't email a password or invite."""
    with connect() as db:
        event(db,eid);u=organizer(db,request,eid,True)
        if len(body.tracks)!=len(set(body.tracks)):raise HTTPException(422,'Duplicate tracks')
        for tid in body.tracks:
            if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?',(tid,eid)).fetchone():
                raise HTTPException(422,'Track does not belong to event')
        email=body.email.strip().lower()
        if '@' not in email:raise HTTPException(422,'Invalid email')
        existing=db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()
        if existing: uid=existing['id']
        else:
            uid='usr_'+secrets.token_hex(10)
            salt=secrets.token_hex(16)
            password=secrets.token_urlsafe(24)
            db.execute('INSERT INTO users VALUES (?,?,?,?,?)',
                       (uid,email,body.name,salt,password_hash(password,salt)))
        if db.execute('SELECT 1 FROM judges WHERE user_id=? AND event_id=?',(uid,eid)).fetchone():
            raise HTTPException(409,'User is already a judge for this event')
        jid='jdg_'+secrets.token_hex(8)
        db.execute('INSERT INTO judges VALUES (?,?,?)',(jid,eid,uid))
        db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)',(uid,eid,'judge'))
        for tid in body.tracks:db.execute('INSERT INTO judge_tracks VALUES (?,?)',(jid,tid))
        audit(db,u['id'],eid,'judge.create',jid)
        # New credentials returned only to organizer; no automatic external disclosure.
        out={'judge_id':jid,'user_id':uid,'email':email,'tracks':body.tracks}
        if not existing:out['temporary_password']=password
        return out

class SignupIn(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    name: str = Field(min_length=1,max_length=160)
    password: str = Field(min_length=12,max_length=200)

@router.post('/invites/{token}/register')
def register_invitee(token: str,body: SignupIn):
    """Registration is permitted only with a live invite for this email."""
    with connect() as db:
        inv=db.execute('SELECT * FROM team_invites WHERE token_hash=?',
                       (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        if not inv or inv['accepted_at'] or timestamp(inv['expires_at'])<=utc_now():
            raise HTTPException(404,'Invite unavailable or expired')
        if body.email.strip().lower()!=inv['email'].lower():raise HTTPException(403,'Invite belongs to another email')
        if db.execute('SELECT 1 FROM users WHERE email=?',(body.email.strip(),)).fetchone():
            raise HTTPException(409,'Account already exists; sign in to accept invitation')
        t=db.execute('SELECT * FROM teams WHERE id=?',(inv['team_id'],)).fetchone()
        if utc_now()>=timestamp(event(db,t['event_id'])['submissions_close']):
            raise HTTPException(409,'Event submissions closed')
        if db.execute('SELECT COUNT(*) FROM team_members WHERE team_id=?',(t['id'],)).fetchone()[0]>=4:
            raise HTTPException(409,'Team is full')
        uid='usr_'+secrets.token_hex(10);salt=secrets.token_hex(16)
        db.execute('INSERT INTO users VALUES (?,?,?,?,?)',
                   (uid,body.email.strip().lower(),body.name,salt,password_hash(body.password,salt)))
        db.execute('INSERT INTO team_members VALUES (?,?)',(t['id'],uid))
        db.execute('INSERT INTO roles VALUES (?,?,?)',(uid,t['event_id'],'participant'))
        db.execute('UPDATE team_invites SET accepted_at=? WHERE token_hash=?',
                   (iso(utc_now()),inv['token_hash']))
        audit(db,uid,t['event_id'],'team.register',t['id'])
        return {'user_id':uid,'team_id':t['id'],'registered':True}

@router.get('/events/{eid}/my-ballots')
def my_ballots(eid: str,request: Request):
    with connect() as db:
        event(db,eid);u=actor(db,request)
        require_role(db,u['id'],eid,'judge')
        j=db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?',(u['id'],eid)).fetchone()
        if not j:raise HTTPException(403,'Judge identity not found in event')
        rows=db.execute('SELECT a.project_id,p.title,b.comment,b.submitted_at FROM assignments a '
                        'JOIN projects p ON p.id=a.project_id LEFT JOIN ballots b '
                        'ON b.judge_id=a.judge_id AND b.project_id=a.project_id '
                        'WHERE a.judge_id=? AND p.event_id=? ORDER BY p.id',(j['id'],eid)).fetchall()
        ballots=[]
        for row in rows:
            data=dict(row)
            data['criteria']={r['criterion']:r['score'] for r in db.execute(
                'SELECT criterion,score FROM ballot_scores WHERE judge_id=? AND project_id=?',
                (j['id'],row['project_id']))}
            ballots.append(data)
        return {'event_id':eid,'judge_id':j['id'],'ballots':ballots}

@router.get('/events/{eid}/export.csv')
def export_event_csv(eid: str,request: Request):
    import csv
    import io
    from fastapi.responses import Response
    with connect() as db:
        event(db,eid);organizer(db,request,eid)
        out=io.StringIO(newline='');writer=csv.writer(out)
        writer.writerow(['project_id','judge_id','criterion','score','comment'])
        rows=db.execute('SELECT b.project_id,b.judge_id,s.criterion,s.score,b.comment FROM ballots b '
                        'JOIN ballot_scores s ON s.judge_id=b.judge_id AND s.project_id=b.project_id '
                        'JOIN projects p ON p.id=b.project_id WHERE p.event_id=? '
                        'ORDER BY b.project_id,b.judge_id,s.criterion',(eid,))
        for row in rows:
            values=list(row)
            for i in (0,1,2,4):
                if values[i].lstrip().startswith(('=','+','-','@')):values[i]="'"+values[i]
            writer.writerow(values)
        return Response(out.getvalue(),media_type='text/csv',headers={
            'Content-Disposition':'attachment; filename="scores.csv"'})
