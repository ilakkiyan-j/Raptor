"""Run with: DB_PATH=/tmp/dogfood-unit.sqlite3 python -m unittest discover -s tests"""
import json
import os
import tempfile
import unittest
from fastapi.testclient import TestClient

class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        os.environ['DB_PATH']=os.path.join(cls.temp.name,'test.sqlite3')
        from app import db
        db.DB_PATH=os.environ['DB_PATH']
        from app.main import app
        cls.context=TestClient(app)
        cls.client=cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None,None,None)
        cls.temp.cleanup()

    def test_fixture_preservation(self):
        from app.db import connect
        with connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM projects').fetchone()[0],41)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM ballots').fetchone()[0],126)
            self.assertEqual([r['id'] for r in db.execute("SELECT id FROM projects WHERE team_id='tm_07' ORDER BY id")],['prj_07','prj_41'])
            self.assertEqual(db.execute('SELECT submissions_close FROM events WHERE id=?',('evt_01',)).fetchone()[0],
                             '2026-03-01T18:00:00Z')

    def test_gallery_and_deadline(self):
        self.assertIn('Glass Signal',self.client.get('/projects').text)
        r=self.client.post('/projects/new',json={'title':'late','summary':'probe'},cookies={
            'session':'demo-pt-d7f97ed29e331c278823c9361109a54e'})
        self.assertEqual(r.status_code,409)

    def test_roles(self):
        a={'session':'demo-ja-c9e380efa065eb7f8187b4da697a180a'}
        b={'session':'demo-jb-075fd8b3282e0c498e18c273e803b268'}
        p={'session':'demo-pt-d7f97ed29e331c278823c9361109a54e'}
        o={'session':'demo-org-29ced468c7410afa403da3619178b380'}
        self.assertEqual(self.client.get('/api/judge/scores',cookies=a).status_code,200)
        self.assertEqual(self.client.get('/api/judges/jdg_07/scores',cookies=a).status_code,200)
        self.assertEqual(self.client.get('/api/judges/jdg_07/scores',cookies=b).status_code,403)
        self.assertEqual(self.client.get('/api/judge/scores',cookies=p).status_code,403)
        self.assertEqual(self.client.get('/api/export.csv').status_code,401)
        self.assertTrue(self.client.get('/api/export.csv',cookies=o).text.startswith('project_id,judge_id,'))

if __name__=='__main__':unittest.main()
