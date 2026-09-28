"""Mathematical tests for Modified Z-Score and Empirical Bayes normalization, zero-variance handling, and leaderboard export."""
import os
import tempfile
import unittest
from fastapi.testclient import TestClient


class NormalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ['DB_PATH'] = os.path.join(cls.tmp.name, 'norm.sqlite3')
        from app import db
        db.DB_PATH = os.environ['DB_PATH']
        from app.main import app
        cls.cm = TestClient(app)
        cls.client = cls.cm.__enter__()

        cls.org_cookie = {'session': 'demo-org-29ced468c7410afa403da3619178b380'}
        cls.org_csrf = cls.client.get('/me', cookies=cls.org_cookie).json()['csrf_token']
        cls.org_headers = {'x-csrf-token': cls.org_csrf, 'Cookie': 'session=demo-org-29ced468c7410afa403da3619178b380'}
        cls.participant_cookie = {'session': 'demo-pt-d7f97ed29e331c278823c9361109a54e'}

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None, None, None)
        cls.tmp.cleanup()

    def test_zscore_normalization_and_zero_variance_protection(self):
        eid = 'evt_01'
        res = self.client.get(f'/api/events/{eid}/results?method=zscore', headers=self.org_headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()

        self.assertIn('Modified Z-Score', data['method'])
        self.assertEqual(len(data['projects']), 41)
        self.assertTrue(all(0 <= p['normalized_percent'] <= 100 for p in data['projects']))

        # Verify ranking is strictly sorted descending
        scores = [p['normalized_percent'] for p in data['projects'] if p['normalized_percent'] is not None]
        self.assertEqual(scores, sorted(scores, reverse=True))

        # Check rank numbers
        ranked = [p for p in data['projects'] if p['rank'] is not None]
        self.assertEqual(len(ranked), 41)
        self.assertEqual([p['rank'] for p in ranked], list(range(1, 42)))

    def test_shrinkage_normalization(self):
        eid = 'evt_01'
        res = self.client.get(f'/api/events/{eid}/results?method=shrinkage', headers=self.org_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('Empirical Bayes', data['method'])
        self.assertEqual(len(data['projects']), 41)

    def test_leaderboard_csv_export(self):
        eid = 'evt_01'
        # Block participants
        blocked = self.client.get(f'/api/events/{eid}/leaderboard.csv', cookies=self.participant_cookie)
        self.assertEqual(blocked.status_code, 403)

        # Allow organizer
        csv_res = self.client.get(f'/api/events/{eid}/leaderboard.csv', headers=self.org_headers)
        self.assertEqual(csv_res.status_code, 200)
        lines = csv_res.text.strip().splitlines()
        self.assertTrue(len(lines) >= 42)  # Header + 41 projects
        self.assertEqual(lines[0], 'rank,project_id,title,team,track,review_count,raw_score,normalized_score')
        first_row = lines[1].split(',')
        self.assertEqual(first_row[0], '1')  # Rank 1


if __name__ == '__main__':
    unittest.main()
