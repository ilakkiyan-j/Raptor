"""Tests for automated judge assignment engine, conflict avoidance, and evaluation interface."""
import os
import tempfile
import unittest
from fastapi.testclient import TestClient


class AutoAssignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ['DB_PATH'] = os.path.join(cls.tmp.name, 'auto_assign.sqlite3')
        from app import db
        db.DB_PATH = os.environ['DB_PATH']
        from app.main import app
        cls.cm = TestClient(app)
        cls.client = cls.cm.__enter__()

        cls.org_cookie = {'session': 'demo-org-29ced468c7410afa403da3619178b380'}
        cls.org_csrf = cls.client.get('/me', cookies=cls.org_cookie).json()['csrf_token']
        cls.org_headers = {'x-csrf-token': cls.org_csrf, 'Cookie': 'session=demo-org-29ced468c7410afa403da3619178b380'}

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None, None, None)
        cls.tmp.cleanup()

    def test_auto_assignment_and_conflict_free(self):
        eid = 'evt_01'

        # 1. Trigger auto-assignment targeting 3 reviews per project
        res = self.client.post(
            f'/api/events/{eid}/assignments/auto',
            json={'reviews_per_project': 3},
            headers=self.org_headers,
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data['projects_processed'], 41)
        self.assertEqual(data['fully_assigned_projects'], 41)
        self.assertEqual(data['under_assigned_projects'], 0)

        # 2. Database verification of invariants
        from app.db import connect
        with connect() as db:
            assignments = db.execute(
                """SELECT a.judge_id, a.project_id, p.track_id, p.team_id, j.user_id
                   FROM assignments a
                   JOIN projects p ON p.id=a.project_id
                   JOIN judges j ON j.id=a.judge_id
                   WHERE p.event_id=?""",
                (eid,),
            ).fetchall()

            for a in assignments:
                # Invariant 1: Judge has registered track for project
                has_track = db.execute(
                    'SELECT 1 FROM judge_tracks WHERE judge_id=? AND track_id=?',
                    (a['judge_id'], a['track_id']),
                ).fetchone()
                self.assertIsNotNone(has_track, f"Judge {a['judge_id']} assigned outside track {a['track_id']}")

                # Invariant 2: Judge is NOT a member of the project's team
                is_team_member = db.execute(
                    'SELECT 1 FROM team_members WHERE team_id=? AND user_id=?',
                    (a['team_id'], a['user_id']),
                ).fetchone()
                self.assertIsNone(is_team_member, f"Conflict: Judge {a['judge_id']} is member of team {a['team_id']}")

    def test_judge_evaluation_interface_endpoint(self):
        eid = 'evt_01'
        judge_cookie = {'session': 'demo-ja-c9e380efa065eb7f8187b4da697a180a'}
        judge_csrf = self.client.get('/me', cookies=judge_cookie).json()['csrf_token']
        judge_headers = {'Cookie': 'session=demo-ja-c9e380efa065eb7f8187b4da697a180a', 'x-csrf-token': judge_csrf}

        # Find one project assigned to judge_a (jdg_07)
        ballots_res = self.client.get(f'/api/events/{eid}/my-ballots', headers=judge_headers).json()
        self.assertTrue(len(ballots_res['ballots']) > 0)
        first_proj_id = ballots_res['ballots'][0]['project_id']

        # Fetch evaluation form
        form_res = self.client.get(f'/api/events/{eid}/ballots/{first_proj_id}', headers=judge_headers)
        self.assertEqual(form_res.status_code, 200, form_res.text)
        form = form_res.json()

        self.assertEqual(form['project']['id'], first_proj_id)
        self.assertTrue(len(form['rubric']) >= 3)
        self.assertTrue({'functionality', 'quality', 'innovation'} <= {r['criterion'] for r in form['rubric']})
        self.assertIn('scores', form['evaluation'])


if __name__ == '__main__':
    unittest.main()
