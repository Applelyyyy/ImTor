"""Inspect raw RSC response bytes: a redirected browser URL alone does not prove secrecy."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
f=json.loads((root/'test-results/fixtures.json').read_text())
base='http://localhost:3100'
with sync_playwright() as p:
 private='PRIVATE_STREAM_CUSTOMER_'+f['tag']
 customer=p.request.new_context(extra_http_headers={'Cookie':'next-auth.session-token='+f['users'][2]['token'],'Origin':base})
 changed=customer.patch(base+'/api/profile',data={'name':private})
 assert changed.status==200
 customer.dispose()
 request=p.request.new_context()
 raw=request.get(base+'/admin/reservations',max_redirects=0)
 assert private not in raw.text(),'Guest raw admin stream exposes private fixture records before redirect'
 # Also check a signed-in non-admin, not just guests.
 request.dispose()
 request=p.request.new_context(extra_http_headers={'Cookie':'next-auth.session-token='+f['users'][1]['token']})
 raw=request.get(base+'/admin/reservations',max_redirects=0)
 assert private not in raw.text(),'Non-admin raw stream exposes private admin records before redirect'
 request.dispose()
 print('PASS Guest and non-admin raw RSC responses contain no private fixture markers')
