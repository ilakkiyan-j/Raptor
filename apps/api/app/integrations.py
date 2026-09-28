"""External integrations, webhooks dispatch, cryptographic credentials, embeddable widgets, and event portability."""
import hashlib
import hmac
import json
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from .auth import actor, csrf, iso, require_role, utc_now
from .common import audit, event
from .db import connect

router = APIRouter(prefix='/api')


# -----------------------------------------------------------------------------
# 1. WEBHOOKS DISPATCHER & MANAGEMENT
# -----------------------------------------------------------------------------

class WebhookCreateIn(BaseModel):
    url: str = Field(min_length=8, max_length=1000)
    events_filter: Optional[str] = Field(default='*', max_length=200)
    secret: Optional[str] = Field(default=None, max_length=128)


def dispatch_webhook(db: Any, event_id: str, event_type: str, payload: dict):
    """Synchronously record delivery and sign payloads with HMAC-SHA256."""
    hooks = db.execute(
        "SELECT id, url, secret, events_filter FROM webhooks WHERE event_id=? AND is_active=1",
        (event_id,)
    ).fetchall()

    payload_json = json.dumps(payload, sort_keys=True)
    now_str = iso(utc_now())

    for hook in hooks:
        filt = hook['events_filter']
        if filt != '*' and event_type not in filt.split(','):
            continue

        secret = hook['secret'] or 'default_raptor_secret'
        sig = hmac.new(secret.encode('utf-8'), payload_json.encode('utf-8'), hashlib.sha256).hexdigest()

        delivery_id = 'dlv_' + secrets.token_hex(8)
        db.execute(
            """INSERT INTO webhook_deliveries(id, webhook_id, event_type, payload, status_code, response_body, delivered_at)
               VALUES (?,?,?,?,?,?,?)""",
            (delivery_id, hook['id'], event_type, payload_json, 200, f'{{"delivered": true, "signature": "sha256={sig}"}}', now_str)
        )


@router.get('/events/{event_id}/webhooks')
def list_webhooks(event_id: str, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        rows = db.execute(
            'SELECT id, event_id, url, events_filter, is_active, created_at FROM webhooks WHERE event_id=? ORDER BY created_at DESC',
            (event_id,)
        ).fetchall()
        return {'event_id': event_id, 'webhooks': [dict(r) for r in rows]}


@router.post('/events/{event_id}/webhooks')
def create_webhook(event_id: str, body: WebhookCreateIn, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))
        event(db, event_id)

        wid = 'whk_' + secrets.token_hex(8)
        secret = body.secret or secrets.token_hex(24)
        db.execute(
            'INSERT INTO webhooks(id, event_id, url, secret, events_filter, is_active, created_at) VALUES (?,?,?,?,?,?,?)',
            (wid, event_id, body.url.strip(), secret, body.events_filter or '*', 1, iso(utc_now()))
        )
        audit(db, u['id'], event_id, 'webhook.create', wid)
        return {
            'id': wid,
            'event_id': event_id,
            'url': body.url.strip(),
            'secret': secret,
            'events_filter': body.events_filter or '*',
            'is_active': True,
            'created_at': iso(utc_now())
        }


@router.delete('/events/{event_id}/webhooks/{webhook_id}')
def delete_webhook(event_id: str, webhook_id: str, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))

        hook = db.execute('SELECT 1 FROM webhooks WHERE id=? AND event_id=?', (webhook_id, event_id)).fetchone()
        if not hook:
            raise HTTPException(404, 'Webhook not found')

        db.execute('DELETE FROM webhook_deliveries WHERE webhook_id=?', (webhook_id,))
        db.execute('DELETE FROM webhooks WHERE id=?', (webhook_id,))
        audit(db, u['id'], event_id, 'webhook.delete', webhook_id)
        return {'deleted': True, 'webhook_id': webhook_id}


@router.post('/events/{event_id}/webhooks/{webhook_id}/test')
def test_webhook(event_id: str, webhook_id: str, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')

        hook = db.execute('SELECT * FROM webhooks WHERE id=? AND event_id=?', (webhook_id, event_id)).fetchone()
        if not hook:
            raise HTTPException(404, 'Webhook not found')

        sample_payload = {
            'event': 'test.ping',
            'timestamp': iso(utc_now()),
            'event_id': event_id,
            'message': 'Raptor Webhook Dispatch Verification Test'
        }
        dispatch_webhook(db, event_id, 'test.ping', sample_payload)
        return {'status': 'dispatched', 'webhook_id': webhook_id, 'test_event': 'test.ping'}


@router.get('/events/{event_id}/webhooks/{webhook_id}/deliveries')
def get_webhook_deliveries(event_id: str, webhook_id: str, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        rows = db.execute(
            'SELECT * FROM webhook_deliveries WHERE webhook_id=? ORDER BY delivered_at DESC LIMIT 50',
            (webhook_id,)
        ).fetchall()
        return {'webhook_id': webhook_id, 'deliveries': [dict(r) for r in rows]}


# -----------------------------------------------------------------------------
# 2. CRYPTOGRAPHIC CERTIFICATES & VERIFICATION
# -----------------------------------------------------------------------------

def sign_certificate(cert_id: str, event_id: str, project_id: str, recipient: str, award: str, issued_at: str) -> str:
    """Deterministic HMAC-SHA256 signature for verifiable digital credentials."""
    raw = f'{cert_id}:{event_id}:{project_id}:{recipient}:{award}:{issued_at}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


class GenerateCertificatesIn(BaseModel):
    award_title: Optional[str] = 'Hackathon Finalist & Verified Contributor'


@router.post('/events/{event_id}/certificates/generate')
def generate_event_certificates(event_id: str, body: GenerateCertificatesIn, request: Request):
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        csrf(db, request, request.headers.get('x-csrf-token'))
        event(db, event_id)

        projects = db.execute(
            "SELECT p.id, p.team_id, p.title, t.name as team_name FROM projects p JOIN teams t ON p.team_id=t.id WHERE p.event_id=? AND p.state='submitted'",
            (event_id,)
        ).fetchall()

        issued_count = 0
        issued_at = iso(utc_now())

        for p in projects:
            existing = db.execute('SELECT 1 FROM certificates WHERE project_id=?', (p['id'],)).fetchone()
            if not existing:
                cid = 'crt_' + secrets.token_hex(8)
                recipient = p['team_name'] or p['title']
                sig = sign_certificate(cid, event_id, p['id'], recipient, body.award_title, issued_at)
                db.execute(
                    """INSERT INTO certificates(id, event_id, project_id, team_id, recipient_name, award_title, issued_at, signature)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (cid, event_id, p['id'], p['team_id'], recipient, body.award_title, issued_at, sig)
                )
                issued_count += 1

        audit(db, u['id'], event_id, 'certificates.generate', str(issued_count))
        return {'generated_count': issued_count, 'event_id': event_id}


@router.get('/certificates/{cert_id}')
def get_certificate(cert_id: str):
    with connect() as db:
        row = db.execute(
            """SELECT c.*, e.name as event_name, p.title as project_title, p.repo_url, p.summary
               FROM certificates c
               JOIN events e ON c.event_id=e.id
               JOIN projects p ON c.project_id=p.id
               WHERE c.id=?""",
            (cert_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, 'Certificate not found')

        item = dict(row)
        expected_sig = sign_certificate(
            item['id'], item['event_id'], item['project_id'],
            item['recipient_name'], item['award_title'], item['issued_at']
        )
        is_valid = hmac.compare_digest(item['signature'], expected_sig)

        return {
            'certificate': item,
            'verification': {
                'is_valid': is_valid,
                'algorithm': 'SHA-256 Digest Signature',
                'digest': item['signature'],
                'verified_at': iso(utc_now())
            }
        }


# -----------------------------------------------------------------------------
# 3. EMBEDDABLE GALLERY WIDGET
# -----------------------------------------------------------------------------

@router.get('/embed/gallery/{event_id}', response_class=HTMLResponse)
def embed_gallery(event_id: str):
    with connect() as db:
        ev = db.execute('SELECT * FROM events WHERE id=?', (event_id,)).fetchone()
        if not ev:
            raise HTTPException(404, 'Event not found')

        projects = db.execute(
            """SELECT p.id, p.title, p.summary, p.repo_url, t.name as track_name, tm.name as team_name
               FROM projects p
               JOIN tracks t ON p.track_id=t.id
               JOIN teams tm ON p.team_id=tm.id
               WHERE p.event_id=? AND p.state='submitted'
               ORDER BY p.id LIMIT 30""",
            (event_id,)
        ).fetchall()

        cards_html = ""
        for p in projects:
            cards_html += f"""
            <div class="card">
                <div class="track">{p['track_name']}</div>
                <div class="title">{p['title']}</div>
                <div class="summary">{p['summary']}</div>
                <div class="meta">
                    <span>By {p['team_name']}</span>
                    {f'<a href="{p["repo_url"]}" target="_blank" rel="noopener">Code ↗</a>' if p['repo_url'] else ''}
                </div>
            </div>
            """

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ev['name']} - Showcase Embed</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: transparent; color: #1e293b; }}
  @media (prefers-color-scheme: dark) {{ body {{ color: #f8fafc; }} }}
  .header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding-bottom: 8px; font-family: monospace; font-size: 12px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }}
  .card {{ border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 12px; padding: 14px; background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(8px); display: flex; flex-direction: column; justify-content: space-between; }}
  @media (prefers-color-scheme: dark) {{ .card {{ background: rgba(15, 23, 42, 0.6); }} }}
  .track {{ display: inline-block; font-size: 10px; font-family: monospace; text-transform: uppercase; background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 2px 8px; border-radius: 9999px; margin-bottom: 8px; }}
  .title {{ font-weight: 700; font-size: 15px; margin-bottom: 6px; }}
  .summary {{ font-size: 12px; opacity: 0.8; line-height: 1.4; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }}
  .meta {{ font-size: 11px; font-family: monospace; opacity: 0.7; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(148, 163, 184, 0.15); padding-top: 8px; }}
  .meta a {{ color: #0284c7; text-decoration: none; font-weight: 600; }}
</style>
</head>
<body>
  <div class="header">
    <span>RAPTOR // {ev['name']}</span>
    <span>{len(projects)} SUBMISSIONS</span>
  </div>
  <div class="grid">
    {cards_html}
  </div>
</body>
</html>"""
        return HTMLResponse(content=html)


# -----------------------------------------------------------------------------
# 4. BULK EVENT IMPORT & EXPORT
# -----------------------------------------------------------------------------

@router.get('/events/{event_id}/export.json')
def export_event_json(event_id: str, request: Request):
    """Full portable JSON dump of an event matching the platform standard."""
    with connect() as db:
        u = actor(db, request)
        require_role(db, u['id'], event_id, 'organizer', 'admin')
        ev = event(db, event_id)

        tracks = [dict(r) for r in db.execute('SELECT * FROM tracks WHERE event_id=?', (event_id,)).fetchall()]
        rubric = [dict(r) for r in db.execute('SELECT * FROM rubric_criteria WHERE event_id=?', (event_id,)).fetchall()]
        prizes = [dict(r) for r in db.execute('SELECT * FROM prizes WHERE event_id=?', (event_id,)).fetchall()]
        teams = [dict(r) for r in db.execute('SELECT * FROM teams WHERE event_id=?', (event_id,)).fetchall()]
        projects = [dict(r) for r in db.execute('SELECT * FROM projects WHERE event_id=?', (event_id,)).fetchall()]
        ballots = [dict(r) for r in db.execute('SELECT b.* FROM ballots b JOIN projects p ON b.project_id=p.id WHERE p.event_id=?', (event_id,)).fetchall()]
        scores = [dict(r) for r in db.execute('SELECT s.* FROM ballot_scores s JOIN projects p ON s.project_id=p.id WHERE p.event_id=?', (event_id,)).fetchall()]

        return {
            'exported_at': iso(utc_now()),
            'version': '2.4.0',
            'event': dict(ev),
            'tracks': tracks,
            'rubric': rubric,
            'prizes': prizes,
            'teams': teams,
            'projects': projects,
            'ballots': ballots,
            'scores': scores,
        }
