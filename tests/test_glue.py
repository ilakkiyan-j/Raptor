"""Frontend-facing JSON shape and seeded content."""
import os
import tempfile
import unittest
from fastapi.testclient import TestClient

class GlueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        os.environ['DB_PATH']=os.path.join(cls.tmp.name,'glue.sqlite3')
        from app import db
        db.DB_PATH=os.environ['DB_PATH']
        from app.main import app
        cls.cm=TestClient(app);cls.client=cls.cm.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None,None,None);cls.tmp.cleanup()

    def test_health_and_gallery(self):
        self.assertEqual(self.client.get('/api/health').json()['status'],'ok')
        first=self.client.get('/api/gallery').json()
        self.assertEqual(first['total'],41)
        self.assertEqual((first['page'],first['limit'],len(first['items'])),(1,20,20))
        self.assertTrue({'team','track','title','id'} <= set(first['items'][0]))
        self.assertEqual(len(self.client.get('/api/gallery?page=3').json()['items']),1)
        self.assertIn('Glass Signal',self.client.get('/projects').text)
        self.assertEqual(self.client.get('/api/gallery?limit=101').status_code,422)

    def test_me_contract(self):
        cookie='session=demo-pt-d7f97ed29e331c278823c9361109a54e'
        r=self.client.get('/me',headers={'Cookie':cookie})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['roles'][0]['role'],'participant')
        self.assertTrue(r.json()['csrf_token'])

if __name__=='__main__':unittest.main()
