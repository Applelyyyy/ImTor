"""Read-only route/layout audit using isolated local admin fixture sessions."""
import json,os
from pathlib import Path
from ui_helpers import settled
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];BASE=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3100')
assert urlparse(BASE).hostname in {'localhost','127.0.0.1','::1'}
f=json.loads((ROOT/'test-results/fixtures.json').read_text());out=ROOT/'test-results/admin-route-audit';out.mkdir(parents=True,exist_ok=True)
errors=[];checks=[]
routes=['','users','stores','products','stalls','attendance','reservations','analytics','demo-generator','settings','audit-logs','reports']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context();c.add_cookies([{'name':'next-auth.session-token','value':f['users'][0]['token'],'url':BASE}]);page=c.new_page();page.set_default_navigation_timeout(60000);page.on('pageerror',lambda e:errors.append(str(e)))
 for width in [360,390,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':950})
  for route in routes:
   r=page.goto(BASE+'/admin'+('/'+route if route else ''), wait_until="domcontentloaded");assert r.status==200
   page.wait_for_load_state('networkidle');expect(page.locator('.workspace-main h1').first).to_be_visible();page.evaluate('document.fonts.ready')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{route} overflow {width}'
   settled(page);page.screenshot(path=str(out/f'{route or "dashboard"}-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{route} lateoverflow {width}'
   if width <= 768 and page.locator('.data-table tbody tr').count():
    assert page.locator('.data-table tbody tr').first.locator('td').evaluate_all('(cells)=>cells.every(td=>{const r=td.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth})'),f'{route} hides management cells off-screen at{width}'
   if route=='analytics':assert page.get_by_role('heading',name='นับอย่างตรงไปตรงมา').count()==0
   if route=='demo-generator':assert page.locator('form').count()>0 and page.locator('[data-slot="input"]').count()>0
  checks.append(f'12 admin routes rendered with no overflow at{width}px');print('PASS',checks[-1],flush=True)
 assert not errors,errors
 b.close()
(out/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'screenshots':60},indent=2))
