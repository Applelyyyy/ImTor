import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import os
f=json.loads(Path('test-results/fixtures.json').read_text());base=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3101')
assert urlparse(base).hostname in {'localhost','127.0.0.1'} and f['databaseName'].endswith('_test')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);cs=[]
 for i in [1,2]:
  c=b.new_context();c.add_cookies([{'name':'next-auth.session-token','value':f['users'][i]['token'],'url':base}]);cs.append(c)
 def api(c,method,path,data=None):
  r=c.request.fetch(base+path,method=method,data=data,headers={'Origin':base});assert r.ok,(r.status,r.text());return r.json()['data']
 m,o=cs;sel=api(m,'GET','/api/attendance/selection?storeId='+f['storeId']);market=next(x for x in sel['markets'] if x['id']==f['marketId']);a98=next(x for x in market['stalls'] if x['code']=='A98');other=api(o,'GET','/api/stores')[0]
 api(o,'POST','/api/attendance',{'storeId':other['id'],'sessionId':f['sessionId'],'stallId':a98['id'],'authorized':True})
 api(m,'POST','/api/attendance',{'storeId':f['storeId'],'sessionId':f['sessionId'],'stallId':f['stallId'],'authorized':True,'status':'OPEN'})
 print('Prepared owned fixture attendance for existing public/customer regression');b.close()
