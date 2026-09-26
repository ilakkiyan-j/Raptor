"""One-transaction import. Never overwrite a seeded database or drop duplicate titles."""
import json
import hashlib
from pathlib import Path
from .auth import create_session, password_hash
from .db import SCHEMA, connect

FIXTURE = Path(__file__).resolve().parents[1] / 'fixtures.json'
if not FIXTURE.exists():
    FIXTURE = Path(__file__).resolve().parents[3] / 'fixtures.json'
DEMO_PASSWORD = 'dogfood-local-demo-only'
TOKENS = {
 'organizer': 'demo-org-29ced468c7410afa403da3619178b380',
 'judge_a': 'demo-ja-c9e380efa065eb7f8187b4da697a180a',
 'judge_b': 'demo-jb-075fd8b3282e0c498e18c273e803b268',
 'participant': 'demo-pt-d7f97ed29e331c278823c9361109a54e',
}

def init():
    f = json.loads(FIXTURE.read_text())
    event = f['event']; eid=event['id']
    with connect() as db:
        db.executescript(SCHEMA)
        if 'judging_close' not in [r['name'] for r in db.execute('PRAGMA table_info(events)')]:
            db.execute('ALTER TABLE events ADD COLUMN judging_close TEXT')
        if db.execute('SELECT 1 FROM events WHERE id=?',(eid,)).fetchone():
            return
        def user(email, name):
            uid = 'usr_' + hashlib.sha256(email.lower().encode()).hexdigest()[:20]
            salt = hashlib.sha256(('local-demo-salt:' + uid).encode()).hexdigest()[:32]
            db.execute('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?)',
                       (uid,email,name,salt,password_hash(DEMO_PASSWORD,salt)))
            return uid
        db.execute('INSERT INTO events(id,name,submissions_close) VALUES (?,?,?)',
                   (eid,event['name'],event['submissions_close']))
        for t in f['tracks']:
            db.execute('INSERT INTO tracks VALUES (?,?,?)',(t['id'],eid,t['name']))
        members={}
        for t in f['teams']:
            db.execute('INSERT INTO teams VALUES (?,?,?)',(t['id'],eid,t['name']))
            for email in t['members']:
                uid=user(email,email.split('@')[0])
                db.execute('INSERT INTO team_members VALUES (?,?)',(t['id'],uid))
                db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)',(uid,eid,'participant'))
                members.setdefault(t['id'],[]).append(uid)
        judges={}
        for j in f['judges']:
            uid=user(j['email'],j['name']); judges[j['id']]=uid
            db.execute('INSERT INTO judges VALUES (?,?,?)',(j['id'],eid,uid))
            db.execute('INSERT OR IGNORE INTO roles VALUES (?,?,?)',(uid,eid,'judge'))
            for track in j['tracks']:
                db.execute('INSERT INTO judge_tracks VALUES (?,?)',(j['id'],track))
        for p in f['projects']:
            db.execute('INSERT INTO projects VALUES (?,?,?,?,?,?,?, ?,?)',
                       (p['id'],eid,p['team'],p['track'],p['title'],p['summary'],p['repo_url'],p['submitted_at'],'submitted'))
        for criterion in ('functionality','quality','innovation'):
            db.execute('INSERT INTO rubric_criteria VALUES (?,?,?,?,?)',(eid,criterion,1.0,1,5))
        for s in f['scores']:
            db.execute('INSERT INTO assignments VALUES (?,?)',(s['judge'],s['project']))
            db.execute('INSERT INTO ballots VALUES (?,?,?,?)',
                       (s['judge'],s['project'],s['comment'],'2026-03-01T18:00:00Z'))
            for criterion,score in s['criteria'].items():
                db.execute('INSERT INTO ballot_scores VALUES (?,?,?,?)',
                           (s['judge'],s['project'],criterion,score))
        # Demo organizer/admin are app-owned, not fixture identities.
        org=user('organizer@dogfood.local','Demo organizer')
        adm=user('admin@dogfood.local','Demo admin')
        db.execute('INSERT INTO roles VALUES (?,?,?)',(org,eid,'organizer'))
        db.execute('INSERT INTO roles VALUES (?,?,?)',(adm,eid,'admin'))
        for role,uid in [('organizer',org),('judge_a',judges['jdg_07']),
                         ('judge_b',judges['jdg_08']),('participant',members['tm_01'][0])]:
            create_session(db,uid,TOKENS[role],days=3650)
        for table,expected in [('tracks',8),('judges',30),('teams',40),('projects',41),('ballots',126)]:
            actual=db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]
            if actual!=expected:
                raise ValueError(f'{table}: expected {expected}, got {actual}')
