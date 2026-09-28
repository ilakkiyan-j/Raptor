"""Integration tests for direct registration, team formation, invite inspection, and submission unsubmit."""
import os
import tempfile
import unittest
from datetime import timedelta
from fastapi.testclient import TestClient


class TeamsFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ['DB_PATH'] = os.path.join(cls.tmp.name, 'teams_flow.sqlite3')
        from app import db
        db.DB_PATH = os.environ['DB_PATH']
        from app.main import app
        from app.auth import iso, utc_now
        cls.iso = staticmethod(iso)
        cls.utcnow = staticmethod(utc_now)
        cls.cm = TestClient(app)
        cls.client = cls.cm.__enter__()

        # Admin login
        cls.admin_session = cls.client.post(
            '/login', json={'email': 'admin@dogfood.local', 'password': 'dogfood-local-demo-only'}
        ).cookies['session']
        cls.admin_csrf = cls.client.get('/me', cookies={'session': cls.admin_session}).json()['csrf_token']
        cls.admin_headers = {'Cookie': f'session={cls.admin_session}', 'x-csrf-token': cls.admin_csrf}

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None, None, None)
        cls.tmp.cleanup()

    def test_complete_team_and_submission_lifecycle(self):
        # 1. Direct registration of two new participants
        res1 = self.client.post(
            '/api/auth/register',
            json={'email': 'lead@example.org', 'name': 'Team Lead', 'password': 'securepassword123'},
        )
        self.assertEqual(res1.status_code, 200, res1.text)
        lead_session = res1.cookies['session']
        lead_csrf = self.client.get('/me', cookies={'session': lead_session}).json()['csrf_token']
        lead_headers = {'Cookie': f'session={lead_session}', 'x-csrf-token': lead_csrf}

        res2 = self.client.post(
            '/api/auth/register',
            json={'email': 'builder@example.org', 'name': 'Co Builder', 'password': 'securepassword123'},
        )
        self.assertEqual(res2.status_code, 200, res2.text)
        builder_session = res2.cookies['session']
        builder_csrf = self.client.get('/me', cookies={'session': builder_session}).json()['csrf_token']
        builder_headers = {'Cookie': f'session={builder_session}', 'x-csrf-token': builder_csrf}

        # 2. Create an open event
        close = self.iso(self.utcnow() + timedelta(hours=5))
        event = self.client.post(
            '/api/events',
            json={'name': 'Spring Hack 2026', 'submissions_close': close},
            headers=self.admin_headers,
        ).json()
        eid = event['id']

        # Add a track
        tr = self.client.post(f'/api/events/{eid}/tracks', json={'name': 'Web3'}, headers=self.admin_headers).json()
        tid = tr['id']

        # 3. Team lead creates a team
        team_res = self.client.post(
            '/api/teams', json={'event_id': eid, 'name': 'Falcon Innovators'}, headers=lead_headers
        )
        self.assertEqual(team_res.status_code, 200)
        team_id = team_res.json()['id']

        # 4. Check /api/events/{eid}/my-team
        my_team = self.client.get(f'/api/events/{eid}/my-team', headers=lead_headers).json()
        self.assertTrue(my_team['has_team'])
        self.assertEqual(my_team['team']['name'], 'Falcon Innovators')

        # 5. Lead generates invite for builder
        inv_res = self.client.post(
            f'/api/teams/{team_id}/invites', json={'email': 'builder@example.org'}, headers=lead_headers
        )
        self.assertEqual(inv_res.status_code, 200)
        token = inv_res.json()['token']

        # 6. Public inspection of invite
        inspect = self.client.get(f'/api/invites/{token}')
        self.assertEqual(inspect.status_code, 200)
        self.assertEqual(inspect.json()['team_name'], 'Falcon Innovators')
        self.assertEqual(inspect.json()['email'], 'builder@example.org')
        self.assertFalse(inspect.json()['is_full'])

        # 7. Builder accepts invite
        accept = self.client.post(f'/api/invites/{token}/accept', headers=builder_headers)
        self.assertEqual(accept.status_code, 200)

        # 8. Verify team roster
        team_info = self.client.get(f'/api/teams/{team_id}').json()
        self.assertEqual(len(team_info['members']), 2)

        # 9. Create draft project
        draft = self.client.post(
            '/api/projects',
            json={
                'event_id': eid,
                'team_id': team_id,
                'track_id': tid,
                'title': 'Falcon Protocol',
                'summary': 'Next gen telemetry',
            },
            headers=lead_headers,
        ).json()
        pid = draft['id']

        # Verify draft is NOT visible in public submitted gallery
        public_draft = self.client.get(f'/api/projects/{pid}')
        self.assertEqual(public_draft.status_code, 404)

        # 10. Submit project
        sub_res = self.client.post(f'/api/projects/{pid}/submit', headers=lead_headers)
        self.assertEqual(sub_res.status_code, 200)

        # Now public project detail is accessible
        pub_proj = self.client.get(f'/api/projects/{pid}')
        self.assertEqual(pub_proj.status_code, 200)
        self.assertEqual(pub_proj.json()['title'], 'Falcon Protocol')

        # 11. Unsubmit project before deadline
        unsub = self.client.post(f'/api/projects/{pid}/unsubmit', headers=builder_headers)
        self.assertEqual(unsub.status_code, 200)
        self.assertEqual(unsub.json()['state'], 'draft')

        # 12. Delete draft project
        del_draft = self.client.delete(f'/api/projects/{pid}/draft', headers=lead_headers)
        self.assertEqual(del_draft.status_code, 200)
        self.assertTrue(del_draft.json()['deleted'])


if __name__ == '__main__':
    unittest.main()
