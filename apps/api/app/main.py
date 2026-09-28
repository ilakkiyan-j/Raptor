import csv
import io
import secrets
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from .auth import actor, create_session, csrf, iso, password_hash, require_role, token_hash, utc_now
from .db import connect
from .seed import init

@asynccontextmanager
async def lifespan(app: FastAPI):
    init()
    yield

app = FastAPI(title='DOGFOOD portal', version='0.1.0', lifespan=lifespan)
templates = Jinja2Templates(directory=str(Path(__file__).parent / 'templates'))
app.mount('/static',StaticFiles(directory=str(Path(__file__).parent / 'static')),name='static')
EVENT = 'evt_01'

def item(row):
    return dict(row) if row else None

def event_or_404(db, event_id):
    event=db.execute('SELECT * FROM events WHERE id=?',(event_id,)).fetchone()
    if not event:
        raise HTTPException(404,'Event not found')
    return event

def deadline(event):
    close=datetime.fromisoformat(event['submissions_close'].replace('Z','+00:00'))
    if utc_now() >= close:
        raise HTTPException(409,'Submissions are closed for this event')

def own_team(db, uid, team_id, event_id):
    team=db.execute('SELECT * FROM teams WHERE id=? AND event_id=?',(team_id,event_id)).fetchone()
    if not team or not db.execute('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?',
                                  (team_id,uid)).fetchone():
        raise HTTPException(403,'Not a member of this event team')

@app.get('/', response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse('home.html',{'request':request})

@app.get('/events/{event_id}')
def event_detail(event_id: str):
    with connect() as db:
        e=event_or_404(db,event_id)
        tracks=db.execute('SELECT id,name FROM tracks WHERE event_id=? ORDER BY name',(event_id,)).fetchall()
        return {'event':item(e),'tracks':[item(t) for t in tracks]}

@app.get('/projects', response_class=HTMLResponse)
def gallery(request: Request, q: str='', track: str=''):
    with connect() as db:
        rows=db.execute('''SELECT p.id,p.title,p.summary,p.repo_url,p.submitted_at,
                           t.name AS track_name,tm.name AS team_name
                           FROM projects p JOIN tracks t ON p.track_id=t.id
                           JOIN teams tm ON p.team_id=tm.id
                           WHERE p.state='submitted' AND p.title LIKE ? AND (?='' OR p.track_id=?)
                           ORDER BY p.id LIMIT 100''',('%'+q+'%',track,track)).fetchall()
        tracks=db.execute('SELECT id,name FROM tracks ORDER BY name').fetchall()
        return templates.TemplateResponse('projects.html',{'request':request,'projects':rows,
                                                             'tracks':tracks,'q':q,'track':track})

@app.get('/api/projects')
def projects_json(q: str='',track: str=''):
    with connect() as db:
        rows=db.execute('SELECT id,title,summary,repo_url,team_id,track_id,submitted_at FROM projects '
                        "WHERE state='submitted' AND title LIKE ? AND (?='' OR track_id=?) ORDER BY id LIMIT 100",
                        ('%'+q+'%',track,track)).fetchall()
        return {'projects':[item(r) for r in rows]}

@app.get('/projects/{project_id}', response_class=HTMLResponse)
def project_page(request: Request,project_id: str):
    with connect() as db:
        p=db.execute("SELECT p.*,t.name AS track_name,tm.name AS team_name FROM projects p "
                     "JOIN tracks t ON t.id=p.track_id JOIN teams tm ON tm.id=p.team_id "
                     "WHERE p.id=? AND p.state='submitted'",(project_id,)).fetchone()
        if not p: raise HTTPException(404,'Project not found')
        return templates.TemplateResponse('project.html',{'request':request,'p':p})

@app.get('/api/projects/{project_id}')
def project_json(project_id: str):
    with connect() as db:
        p=db.execute("SELECT p.*,t.name AS track_name,tm.name AS team_name FROM projects p "
                     "JOIN tracks t ON t.id=p.track_id JOIN teams tm ON tm.id=p.team_id "
                     "WHERE p.id=? AND p.state='submitted'",(project_id,)).fetchone()
        if not p: raise HTTPException(404,'Project not found')
        return item(p)

@app.get('/login', response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse('login.html',{'request':request})

@app.post('/login')
async def login(request: Request):
    content_type=request.headers.get('content-type','')
    if 'application/json' in content_type:
        body=await request.json(); email=body.get('email',''); password=body.get('password','')
    else:
        form=await request.form();email=str(form.get('email',''));password=str(form.get('password',''))
    with connect() as db:
        u=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
        if not u or not secrets.compare_digest(password_hash(password,u['salt']),u['password_hash']):
            raise HTTPException(401,'Invalid credentials')
        token=create_session(db,u['id'])
        response=Response(content='{"ok":true}',media_type='application/json') if 'application/json' in content_type else RedirectResponse('/me',status_code=303)
        response.set_cookie('session',token,httponly=True,samesite='lax',secure=request.url.scheme=='https',max_age=86400)
        return response

@app.get('/me')
def me(request: Request):
    with connect() as db:
        u=actor(db,request)
        roles=db.execute('SELECT event_id,role FROM roles WHERE user_id=?',(u['id'],)).fetchall()
        return {'id':u['id'],'email':u['email'],'name':u['name'],
                'roles':[item(r) for r in roles],'csrf_token':u['csrf_token']}

@app.post('/logout')
async def logout(request: Request):
    with connect() as db:
        csrf(db,request,request.headers.get('x-csrf-token'))
        db.execute('DELETE FROM sessions WHERE token_hash=?',(token_hash(request.cookies['session']),))
        response=Response(content='{"ok":true}',media_type='application/json')
        response.delete_cookie('session')
        return response

class ProjectInput(BaseModel):
    event_id: str = EVENT
    team_id: str | None = None
    track_id: str | None = None
    title: str = Field(min_length=1,max_length=200)
    summary: str = Field(default='',max_length=4000)
    repo_url: str = Field(default='',max_length=1000)

@app.get('/projects/new',response_class=HTMLResponse)
def new_project_page(request: Request):
    with connect() as db:
        u=actor(db,request)
        teams=db.execute('SELECT t.id,t.name FROM teams t JOIN team_members m ON m.team_id=t.id '
                         'WHERE m.user_id=?',(u['id'],)).fetchall()
        tracks=db.execute('SELECT id,name FROM tracks WHERE event_id=?',(EVENT,)).fetchall()
        return templates.TemplateResponse('new.html',{'request':request,'teams':teams,
                                                        'tracks':tracks,'csrf':u['csrf_token']})

@app.post('/projects/new')
@app.post('/api/projects')
async def new_project(request: Request):
    with connect() as db:
        u=actor(db,request)
        content_type=request.headers.get('content-type','')
        if 'application/json' in content_type:
            data=await request.json(); supplied=request.headers.get('x-csrf-token')
        else:
            form=await request.form();data=dict(form);supplied=str(form.get('csrf_token',''))
        # The event's close is checked before validation or any write. The fixture probe omits fields.
        event=event_or_404(db,data.get('event_id',EVENT))
        require_role(db,u['id'],event['id'],'participant')
        deadline(event)
        csrf(db,request,supplied)
        try:
            p=ProjectInput(**data)
        except Exception:
            raise HTTPException(422,'Invalid project fields')
        if not p.team_id or not p.track_id:
            raise HTTPException(422,'Team and track required')
        own_team(db,u['id'],p.team_id,event['id'])
        if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?',(p.track_id,event['id'])).fetchone():
            raise HTTPException(422,'Track does not belong to event')
        project_id='prj_'+secrets.token_hex(12)
        db.execute('INSERT INTO projects(id,event_id,team_id,track_id,title,summary,repo_url,submitted_at,state) VALUES (?,?,?,?,?,?,?,?,?)',
                   (project_id,event['id'],p.team_id,p.track_id,p.title,p.summary,p.repo_url,None,'draft'))
        return {'id':project_id,'state':'draft'}

@app.get('/api/projects/{project_id}/draft')
def own_draft(project_id: str,request: Request):
    with connect() as db:
        u=actor(db,request)
        p=db.execute('SELECT * FROM projects WHERE id=? AND state=?',(project_id,'draft')).fetchone()
        if not p:raise HTTPException(404,'Draft not found')
        own_team(db,u['id'],p['team_id'],p['event_id'])
        return item(p)

@app.patch('/api/projects/{project_id}/draft')
async def edit_draft(project_id: str,request: Request):
    with connect() as db:
        u=actor(db,request)
        p=db.execute('SELECT * FROM projects WHERE id=? AND state=?',(project_id,'draft')).fetchone()
        if not p:raise HTTPException(404,'Draft not found')
        own_team(db,u['id'],p['team_id'],p['event_id'])
        deadline(event_or_404(db,p['event_id']))
        csrf(db,request,request.headers.get('x-csrf-token'))
        body=await request.json()
        allowed={'title','summary','repo_url','track_id'}
        if not body or set(body)-allowed:raise HTTPException(422,'Only title, summary, repo_url and track_id may change')
        updated={**item(p),**body}
        try: updated=ProjectInput(**updated)
        except Exception:raise HTTPException(422,'Invalid project fields')
        if not db.execute('SELECT 1 FROM tracks WHERE id=? AND event_id=?',
                          (updated.track_id,p['event_id'])).fetchone():raise HTTPException(422,'Invalid track')
        db.execute('UPDATE projects SET title=?,summary=?,repo_url=?,track_id=? WHERE id=?',
                   (updated.title,updated.summary,updated.repo_url,updated.track_id,project_id))
        return {'id':project_id,'state':'draft'}

@app.post('/api/projects/{project_id}/submit')
def submit_draft(project_id: str,request: Request):
    with connect() as db:
        u=actor(db,request)
        p=db.execute('SELECT * FROM projects WHERE id=? AND state=?',(project_id,'draft')).fetchone()
        if not p:raise HTTPException(404,'Draft not found')
        own_team(db,u['id'],p['team_id'],p['event_id'])
        deadline(event_or_404(db,p['event_id']))
        csrf(db,request,request.headers.get('x-csrf-token'))
        db.execute('UPDATE projects SET state=?,submitted_at=? WHERE id=?',
                   ('submitted',iso(utc_now()),project_id))
        return {'id':project_id,'state':'submitted'}

@app.get('/api/judge/scores')
def own_scores(request: Request):
    with connect() as db:
        u=actor(db,request)
        require_role(db,u['id'],EVENT,'judge')
        judge=db.execute('SELECT id FROM judges WHERE user_id=? AND event_id=?',(u['id'],EVENT)).fetchone()
        if not judge:raise HTTPException(403,'Not a judge for this event')
        return {'judge_id':judge['id'],'scores':list(_scores(db,judge['id']))}

def _scores(db,judge_id):
    ballots=db.execute('SELECT b.project_id,b.comment,b.submitted_at FROM ballots b '
                       'WHERE b.judge_id=? ORDER BY b.project_id',(judge_id,)).fetchall()
    for b in ballots:
        result=item(b)
        result['criteria']={r['criterion']:r['score'] for r in db.execute(
            'SELECT criterion,score FROM ballot_scores WHERE judge_id=? AND project_id=?',
            (judge_id,b['project_id']))}
        yield result

@app.get('/api/judges/{judge_id}/scores')
def judge_scores(judge_id: str,request: Request):
    with connect() as db:
        u=actor(db,request)
        require_role(db,u['id'],EVENT,'judge','organizer','admin')
        judge=db.execute('SELECT id,user_id FROM judges WHERE id=? AND event_id=?',
                         (judge_id,EVENT)).fetchone()
        if not judge:raise HTTPException(404,'Judge not found')
        if judge['user_id']!=u['id']:
            require_role(db,u['id'],EVENT,'organizer','admin')
        return {'judge_id':judge_id,'scores':list(_scores(db,judge_id))}

@app.get('/api/export.csv')
def export_csv(request: Request):
    with connect() as db:
        u=actor(db,request)
        require_role(db,u['id'],EVENT,'organizer','admin')
        out=io.StringIO(newline='');writer=csv.writer(out)
        writer.writerow(['project_id','judge_id','criterion','score','comment'])
        rows=db.execute('SELECT b.project_id,b.judge_id,s.criterion,s.score,b.comment FROM ballots b '
                        'JOIN ballot_scores s ON s.judge_id=b.judge_id AND s.project_id=b.project_id '
                        'JOIN projects p ON p.id=b.project_id WHERE p.event_id=? '
                        'ORDER BY b.project_id,b.judge_id,s.criterion',(EVENT,))
        for row in rows:
            # Escape formula cells if opened in a spreadsheet. Fixture comments stay unchanged in DB.
            values=list(row)
            for i in (0,1,2,4):
                if values[i].lstrip().startswith(('=','+','-','@')):values[i]="'"+values[i]
            writer.writerow(values)
        return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="scores.csv"'})

from .auth import router as auth_router
from .events import router as events_router
from .teams import router as teams_router
from .submissions import router as submissions_router
from .judging import router as judging_router
from .integrations import router as integrations_router

app.include_router(auth_router)
app.include_router(events_router)
app.include_router(teams_router)
app.include_router(submissions_router)
app.include_router(judging_router)
app.include_router(integrations_router)

@app.get('/api/health')
def health():
    with connect() as db:
        db.execute('SELECT 1').fetchone()
    return {'status':'ok','project':'Raptor','database':'ready'}

@app.get('/api/gallery')
def gallery_json(q: str='',track: str='',page: int=1,limit: int=20):
    """React starter's paginated contract, backed by real submitted records."""
    if page<1 or limit<1 or limit>100:
        raise HTTPException(422,'page must be >= 1 and limit 1-100')
    with connect() as db:
        where="p.state='submitted' AND p.title LIKE ? AND (?='' OR p.track_id=?)"
        args=('%'+q+'%',track,track)
        total=db.execute('SELECT COUNT(*) FROM projects p WHERE '+where,args).fetchone()[0]
        rows=db.execute('SELECT p.id,p.title,p.summary,p.repo_url,p.submitted_at, '
                        'p.team_id,p.track_id,tm.name AS team,t.name AS track '
                        'FROM projects p JOIN teams tm ON tm.id=p.team_id '
                        'JOIN tracks t ON t.id=p.track_id WHERE '+where+
                        ' ORDER BY p.id LIMIT ? OFFSET ?',(*args,limit,(page-1)*limit)).fetchall()
        return {'items':[dict(row) for row in rows],'page':page,'limit':limit,'total':total}
