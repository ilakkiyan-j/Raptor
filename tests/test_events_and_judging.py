"""Integration checks for new event lifecycle, judging isolation and report math."""
import os
import tempfile
import unittest
from datetime import timedelta
from fastapi.testclient import TestClient

<<<<<<<< HEAD:tests/test_events_and_judging.py
class EventsAndJudgingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        os.environ['DB_PATH']=os.path.join(cls.tmp.name,'events_judging.sqlite3')
========
class EventWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        os.environ['DB_PATH']=os.path.join(cls.tmp.name,'event_workflows.sqlite3')
>>>>>>>> origin/main:tests/test_event_workflows.py
        from app import db
        db.DB_PATH=os.environ['DB_PATH']
        from app.main import app
        from app.auth import iso,utc_now
        cls.iso=staticmethod(iso);cls.utcnow=staticmethod(utc_now)
        cls.cm=TestClient(app);cls.client=cls.cm.__enter__()
        cls.admin={'session':cls.client.post('/login',json={'email':'admin@dogfood.local',
                          'password':'dogfood-local-demo-only'}).cookies['session']}
        cls.client.cookies.clear()
        cls.participant={'session':'demo-pt-d7f97ed29e331c278823c9361109a54e'}
        cls.judge={'session':'demo-ja-c9e380efa065eb7f8187b4da697a180a'}
        cls.organizer={'session':'demo-org-29ced468c7410afa403da3619178b380'}
        cls.headers={role:{'x-csrf-token':cls.client.get('/me',cookies=cookie).json()['csrf_token']}
                     for role,cookie in [('admin',cls.admin),('participant',cls.participant),('judge',cls.judge),('organizer',cls.organizer)]}

    @classmethod
    def tearDownClass(cls):
        cls.cm.__exit__(None,None,None);cls.tmp.cleanup()

    def send(self,method,url,role='admin',**kwargs):
        return self.client.request(method,url,headers={**self.headers[role], 'Cookie':'session='+getattr(self,role)['session']},**kwargs)

    def test_fixture_rubric_locked_and_progress(self):
        self.assertEqual(self.send('PUT','/api/events/evt_01/rubric',role='organizer',json={'criteria':[
            {'criterion':'quality','weight':2,'min_score':1,'max_score':5}]}).status_code,409)
        dashboard=self.send('GET','/api/events/evt_01/dashboard',role='organizer').json()
        self.assertEqual(dashboard['totals'],{'assigned':126,'completed':126})
        result=self.send('GET','/api/events/evt_01/results',role='organizer')
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json()['projects']),41)
        self.assertTrue(all(p['review_count']>=2 and 0<=p['normalized_percent']<=100 for p in result.json()['projects']))
        self.assertEqual(self.send('GET','/api/events/evt_01/results',role='participant').status_code,403)
        self.assertEqual(self.send('PUT','/api/events/evt_01/ballots/prj_01',role='judge',json={
            'criteria':{'functionality':4,'quality':4,'innovation':4}}).status_code,403)

    def test_open_event_team_invite_assignment_ballot(self):
        close=self.iso(self.utcnow()+timedelta(hours=2))
        judging=self.iso(self.utcnow()+timedelta(hours=4))
        event=self.send('POST','/api/events',json={'name':'Test open event',
            'submissions_close':close,'judging_close':judging})
        self.assertEqual(event.status_code,200,event.text);eid=event.json()['id']
        self.assertEqual(self.send('POST','/api/events',role='participant',json={
            'name':'Illegal','submissions_close':close}).status_code,403)
        rubric=self.send('PUT',f'/api/events/{eid}/rubric',json={'criteria':[
            {'criterion':'quality','weight':2,'min_score':1,'max_score':5},
            {'criterion':'innovation','weight':1,'min_score':1,'max_score':5}]})
        self.assertEqual(rubric.status_code,200,rubric.text)
        tr=self.send('POST',f'/api/events/{eid}/tracks',json={'name':'Prototype'})
        tid=tr.json()['id']
        team=self.send('POST','/api/teams',json={'event_id':eid,'name':'Builders'})
        team_id=team.json()['id']
        invite=self.send('POST',f'/api/teams/{team_id}/invites',json={'email':'guest@example.org'})
        self.assertEqual(invite.status_code,200,invite.text)
        token=invite.json()['token']
        self.assertEqual(self.client.post(f'/api/invites/{token}/register',json={
            'email':'not-guest@example.org','name':'Other','password':'long-safe-password'}).status_code,403)
        signup=self.client.post(f'/api/invites/{token}/register',json={
            'email':'guest@example.org','name':'Guest','password':'long-safe-password'})
        self.assertEqual(signup.status_code,200,signup.text)
        self.assertEqual(self.client.post(f'/api/invites/{token}/register',json={
            'email':'guest@example.org','name':'Guest','password':'long-safe-password'}).status_code,404)
        guest={'session':self.client.post('/login',json={'email':'guest@example.org',
                       'password':'long-safe-password'}).cookies['session']}
        csrf=self.client.get('/me',headers={'Cookie':'session='+guest['session']}).json()['csrf_token']
        draft=self.client.post('/api/projects',headers={'Cookie':'session='+guest['session'],'x-csrf-token':csrf},json={
            'event_id':eid,'team_id':team_id,'track_id':tid,'title':'Alpha','summary':'Demo'})
        self.assertEqual(draft.status_code,200,draft.text);pid=draft.json()['id']
        self.assertEqual(self.client.post(f'/api/projects/{pid}/submit',cookies=guest,
                         headers={'x-csrf-token':csrf}).status_code,200)
        j=self.send('POST',f'/api/events/{eid}/judges',json={'email':'judge@example.org',
            'name':'Judge','tracks':[tid]})
        self.assertEqual(j.status_code,200,j.text)
        jid=j.json()['judge_id'];pw=j.json()['temporary_password']
        # A participant on the submitting team cannot judge their own project.
        conflict=self.send('POST',f'/api/events/{eid}/judges',json={
            'email':'guest@example.org','name':'Guest','tracks':[tid]})
        self.assertEqual(conflict.status_code,200,conflict.text)
        own=self.send('POST',f'/api/events/{eid}/assignments',json={
            'judge_id':conflict.json()['judge_id'],'project_id':pid})
        self.assertEqual(own.status_code,409)
        assignment=self.send('POST',f'/api/events/{eid}/assignments',json={
            'judge_id':jid,'project_id':pid})
        self.assertEqual(assignment.status_code,200,assignment.text)
        self.assertEqual(self.send('POST',f'/api/events/{eid}/assignments',json={
            'judge_id':jid,'project_id':pid}).status_code,409)
        judge={'session':self.client.post('/login',json={'email':'judge@example.org',
                         'password':pw}).cookies['session']}
        jcsrf=self.client.get('/me',headers={'Cookie':'session='+judge['session']}).json()['csrf_token']
        early=self.client.put(f'/api/events/{eid}/ballots/{pid}',headers={'Cookie':'session='+judge['session'],
            'x-csrf-token':jcsrf},json={'criteria':{'quality':5,'innovation':4}})
        self.assertEqual(early.status_code,409)
        # Make the open submission window close, then judge the submitted entry.
        from app.db import connect
        with connect() as db:
            db.execute('UPDATE events SET submissions_close=? WHERE id=?',
                       (self.iso(self.utcnow()-timedelta(minutes=1)),eid))
        bad=self.client.put(f'/api/events/{eid}/ballots/{pid}',headers={'Cookie':'session='+judge['session'],
            'x-csrf-token':jcsrf},json={'criteria':{'quality':6,'innovation':4}})
        self.assertEqual(bad.status_code,422)
        good=self.client.put(f'/api/events/{eid}/ballots/{pid}',headers={'Cookie':'session='+judge['session'],
            'x-csrf-token':jcsrf},json={'criteria':{'quality':5,'innovation':4},'comment':'Works'})
        self.assertEqual(good.status_code,200,good.text)
        self.assertEqual(self.client.get(f'/api/events/{eid}/my-ballots',headers={
            'Cookie':'session='+judge['session']}).json()['ballots'][0]['criteria']['quality'],5)
        self.assertEqual(self.send('GET',f'/api/events/{eid}/my-ballots',role='participant').status_code,403)
        self.assertTrue(self.send('GET',f'/api/events/{eid}/export.csv').text.startswith('project_id,judge_id,'))
        self.assertEqual(self.send('GET',f'/api/events/{eid}/export.csv',role='participant').status_code,403)
        self.assertEqual(self.send('GET',f'/api/events/{eid}/dashboard').json()['totals'],
                         {'assigned':1,'completed':1})
        result=self.send('GET',f'/api/events/{eid}/results').json()['projects']
        self.assertEqual(result[0]['review_count'],1)
        self.assertEqual(result[0]['raw_percent'],91.67)
        self.assertEqual(result[0]['normalized_percent'],91.67)
        self.assertEqual(self.send('PUT',f'/api/events/{eid}/rubric',json={
            'criteria':[{'criterion':'quality','weight':1,'min_score':1,'max_score':5}]}).status_code,409)

if __name__=='__main__': unittest.main()
