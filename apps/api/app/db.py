"""SQLite connection and schema. All fixture IDs stay as TEXT."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get('DB_PATH', str(Path(__file__).resolve().parents[1] / 'data' / 'portal.sqlite3'))

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, submissions_close TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tracks (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL,
 UNIQUE(event_id,name)
);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roles (
 user_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL REFERENCES events(id),
 role TEXT NOT NULL CHECK(role IN ('participant','judge','organizer','admin')),
 PRIMARY KEY(user_id,event_id,role)
);
CREATE TABLE IF NOT EXISTS judges (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
 user_id TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS judge_tracks (
 judge_id TEXT NOT NULL REFERENCES judges(id), track_id TEXT NOT NULL REFERENCES tracks(id),
 PRIMARY KEY(judge_id,track_id)
);
CREATE TABLE IF NOT EXISTS teams (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
 team_id TEXT NOT NULL REFERENCES teams(id), user_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(team_id,user_id)
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
 team_id TEXT NOT NULL REFERENCES teams(id), track_id TEXT NOT NULL REFERENCES tracks(id),
 title TEXT NOT NULL, summary TEXT NOT NULL, repo_url TEXT NOT NULL DEFAULT '',
 submitted_at TEXT, state TEXT NOT NULL CHECK(state IN ('draft','submitted'))
);
CREATE TABLE IF NOT EXISTS rubric_criteria (
 event_id TEXT NOT NULL REFERENCES events(id), criterion TEXT NOT NULL,
 weight REAL NOT NULL CHECK(weight>0), min_score INTEGER NOT NULL, max_score INTEGER NOT NULL,
 PRIMARY KEY(event_id,criterion)
);
CREATE TABLE IF NOT EXISTS assignments (
 judge_id TEXT NOT NULL REFERENCES judges(id), project_id TEXT NOT NULL REFERENCES projects(id),
 PRIMARY KEY(judge_id,project_id)
);
CREATE TABLE IF NOT EXISTS ballots (
 judge_id TEXT NOT NULL, project_id TEXT NOT NULL,
 comment TEXT NOT NULL, submitted_at TEXT NOT NULL,
 PRIMARY KEY(judge_id,project_id),
 FOREIGN KEY(judge_id,project_id) REFERENCES assignments(judge_id,project_id)
);
CREATE TABLE IF NOT EXISTS ballot_scores (
 judge_id TEXT NOT NULL, project_id TEXT NOT NULL, criterion TEXT NOT NULL,
 score INTEGER NOT NULL, PRIMARY KEY(judge_id,project_id,criterion),
 FOREIGN KEY(judge_id,project_id) REFERENCES ballots(judge_id,project_id)
);
CREATE TABLE IF NOT EXISTS team_invites (
 token_hash TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES teams(id),
 email TEXT NOT NULL COLLATE NOCASE, expires_at TEXT NOT NULL,
 accepted_at TEXT, created_by TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL REFERENCES users(id),
 event_id TEXT NOT NULL REFERENCES events(id), action TEXT NOT NULL,
 subject_id TEXT NOT NULL, happened_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 expires_at TEXT NOT NULL, csrf_token TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_gallery ON projects(event_id,state,submitted_at);
"""

@contextmanager
def connect():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=10000')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
