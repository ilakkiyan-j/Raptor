"""Unit and integration tests for Hackathon Prize configuration (T1 Core)."""
import os
import tempfile
import unittest
from fastapi.testclient import TestClient


class PrizeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ['DB_PATH'] = os.path.join(cls.tmp.name, 'prizes.sqlite3')
        from app import db
        db.DB_PATH = os.environ['DB_PATH']
        from app.main import app
        cls.cm = TestClient(app)
        cls.client = cls.cm.__enter__()

        # Fetch auth tokens
        cls.org_cookie = {'session': 'demo-org-29ced468c7410afa403da3619178b380'}
        cls.participant_cookie = {'session': 'demo-pt-d7f97ed29e331c278823c9361109a54e'}
        cls.org_csrf = cls.client.get('/me', cookies=cls.org_cookie).json()['csrf_token']
        cls.org_headers = {'x-csrf-token': cls.org_csrf, 'Cookie': 'session=demo-org-29ced468c7410afa403da3619178b380'}

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None, None, None)
        cls.tmp.cleanup()

    def test_prize_lifecycle(self):
        eid = 'evt_01'

        # 1. Unauthenticated / participant cannot create prize
        unauth = self.client.post(f'/api/events/{eid}/prizes', json={'title': 'Grand Prize', 'amount': '$1,000'})
        self.assertEqual(unauth.status_code, 401)

        forbidden = self.client.post(
            f'/api/events/{eid}/prizes',
            json={'title': 'Grand Prize', 'amount': '$1,000'},
            cookies=self.participant_cookie,
        )
        self.assertEqual(forbidden.status_code, 403)

        # 2. Organizer creates prize
        res = self.client.post(
            f'/api/events/{eid}/prizes',
            json={
                'title': 'Grand Champion',
                'description': 'Best overall hackathon submission',
                'amount': '$1,500 USD',
                'rank_order': 1,
            },
            headers=self.org_headers,
        )
        self.assertEqual(res.status_code, 200, res.text)
        prize = res.json()
        self.assertEqual(prize['title'], 'Grand Champion')
        self.assertTrue(prize['id'].startswith('prz_'))
        pid = prize['id']

        # 3. Create second prize associated with a specific track
        track_res = self.client.post(
            f'/api/events/{eid}/prizes',
            json={
                'title': 'Best Dev Tool',
                'description': 'Awarded to the top project in developer tools',
                'amount': '$500 USD',
                'track_id': 'trk_01',
                'rank_order': 2,
            },
            headers=self.org_headers,
        )
        self.assertEqual(track_res.status_code, 200)
        track_pid = track_res.json()['id']

        # 4. Public listing of prizes (no auth required)
        list_res = self.client.get(f'/api/events/{eid}/prizes')
        self.assertEqual(list_res.status_code, 200)
        prizes = list_res.json()['prizes']
        self.assertEqual(len(prizes), 2)
        self.assertEqual(prizes[0]['title'], 'Grand Champion')
        self.assertEqual(prizes[1]['track_id'], 'trk_01')

        # 5. Update prize (patch)
        patch_res = self.client.patch(
            f'/api/events/{eid}/prizes/{pid}',
            json={'amount': '$2,000 USD', 'title': 'Grand Champion (Upgraded)'},
            headers=self.org_headers,
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()['amount'], '$2,000 USD')
        self.assertEqual(patch_res.json()['title'], 'Grand Champion (Upgraded)')

        # 6. Delete prize
        del_res = self.client.delete(f'/api/events/{eid}/prizes/{track_pid}', headers=self.org_headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()['deleted'])

        # Verify only 1 prize remains
        final_list = self.client.get(f'/api/events/{eid}/prizes').json()['prizes']
        self.assertEqual(len(final_list), 1)
        self.assertEqual(final_list[0]['id'], pid)


if __name__ == '__main__':
    unittest.main()
