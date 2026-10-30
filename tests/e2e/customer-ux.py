"""Customer UX regression on root-prepared isolated loopback fixtures only."""
import json, os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from ui_helpers import settled
from urllib.parse import quote, urlparse
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
BASE=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3100')
assert urlparse(BASE).hostname in {'localhost','127.0.0.1','::1'}
F=ROOT/'test-results/fixtures.json'; fixture=json.loads(F.read_text())
OUT=ROOT/'test-results/customer-ux'; OUT.mkdir(parents=True,exist_ok=True)
checks=[]; errors=[]
def ok(name): checks.append(name); print('PASS',name,flush=True)
def api(c,method,path,body=None,status=200):
 r=c.request.fetch(BASE+path,method=method,data=body,headers={'Origin':BASE,'Content-Type':'application/json'})
 assert r.status==status, f'{method} {path}: HTTP{r.status}'
 return r.json().get('data')
def signin(b,i):
 c=b.new_context(viewport={'width':390,'height':900}); c.add_cookies([{'name':'next-auth.session-token','value':fixture['users'][i]['token'],'url':BASE}]); return c
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 m=signin(b,1); c=signin(b,2); guest=b.new_context()
 stores=api(m,'GET','/api/stores'); store=next(x for x in stores if x['name'].startswith(fixture['tag']))
 now=datetime.now(timezone.utc)
 product=api(m,'POST','/api/products',{'storeId':store['id'],'categoryId':fixture['categoryId'],'name':fixture['tag']+' ลูกค้าจองข้าว','imageUrl':'/images/rice.jpg','price':4500,'reservable':True,'stock':10,'pickupStart':(now-timedelta(minutes=1)).isoformat(),'pickupEnd':(now+timedelta(minutes=45)).isoformat()},201)
 # Root cleanup owns all products of these isolated fixture users.
 page=c.new_page(); page.set_default_navigation_timeout(60000); page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE, wait_until="domcontentloaded");page.wait_for_load_state('networkidle');expect(page.locator('h1').first).to_be_visible()
 page.locator('input[name=q]').fill(fixture['tag']+' ลูกค้าจองข้าว');page.get_by_role('button',name='ค้นหา',exact=True).click()
 page.wait_for_url('**/explore?q=*');expect(page.locator(f'a[href="/product/{product["id"]}"]').first).to_be_visible();ok('Homepage search finds the persisted customer test product')
 page.goto(BASE+'/markets/'+fixture['marketSlug']+'/map?session='+fixture['sessionId'], wait_until="domcontentloaded");page.wait_for_load_state('networkidle');expect(page.locator('h1').first).to_be_visible()
 marker=page.get_by_role('button',name='ล็อก A99',exact=False); marker.click();expect(page.get_by_role('link',name='ดูร้าน',exact=False).first).to_be_visible();page.get_by_role('link',name='ดูร้าน',exact=False).first.click();page.wait_for_url('**/store/'+store['slug']);expect(page.locator('h1').first).to_contain_text(store['name']);ok('Session-specific stall map opens the actual merchant store')
 page.goto(BASE+'/product/'+product['id'], wait_until="domcontentloaded");page.wait_for_load_state('networkidle');expect(page.locator('h1')).to_contain_text(product['name'])
 attempts=[]
 def uncertain(route):
  attempts.append(route.request.post_data_json)
  if len(attempts)==1: route.fetch();route.abort('failed')
  else: route.continue_()
 page.route('**/api/reservations',uncertain)
 page.get_by_role('button',name='จองสินค้า',exact=True).click()
 page.get_by_label('จำนวนที่ต้องการจอง',exact=False).fill('2')
 page.get_by_role('button',name='จองสินค้า').click()
 expect(page.get_by_role('alert')).to_be_visible()
 expect(page.get_by_label('จำนวนที่ต้องการจอง',exact=False)).to_have_attribute('readonly','')
 expect(page.get_by_role('link',name='ตรวจสอบการจองของฉัน')).to_be_visible()
 page.get_by_role('button',name='ตรวจสอบคำขอจองเดิมอีกครั้ง').click()
 page.wait_for_url('**/reservations');page.wait_for_load_state('networkidle')
 page.unroute('**/api/reservations',uncertain)
 assert len(attempts)==2 and attempts[0]==attempts[1] and attempts[0].get('idempotencyKey')
 rows=api(c,'GET','/api/reservations');selected=[r for r in rows if r['productId']==product['id']];assert len(selected)==1 and selected[0]['quantity']==2
 assert api(m,'GET',f'/api/products/{product["id"]}/inventory')['available']==8
 ok('Lost reservation response retries one identical request; only one booking and two-unit decrement')
 card=page.locator('.reservation-card').filter(has_text=product['name']);card.get_by_role('button',name='ยกเลิกการจอง',exact=True).click()
 dialog=page.get_by_role('alertdialog');expect(dialog).to_be_visible();dialog.get_by_role('button',name='ยืนยัน',exact=True).click();expect(dialog).not_to_be_visible();expect(card.get_by_role('button',name='ยกเลิกการจอง',exact=True)).to_have_count(0)
 assert api(m,'GET',f'/api/products/{product["id"]}/inventory')['available']==10
 ok('Customer cancellation UI restores stock exactly once')
 api(c,'PATCH',f'/api/products/{product["id"]}',{'name':'forbidden'},403)
 api(c,'DELETE',f'/api/stores/{store["id"]}',{},status=403)
 api(guest,'GET','/api/profile',status=401)
 bad=m.request.patch(BASE+f'/api/products/{product["id"]}',data={'name':'forbidden'},headers={'Origin':'https://foreign.invalid'})
 assert bad.status==403;ok('Cross-owner, unauthenticated and cross-origin writes remain rejected')
 routes=[('home','/'),('explore','/explore?q='+quote(fixture['tag'])),('markets','/markets'),('market','/markets/'+fixture['marketSlug']),('map','/markets/'+fixture['marketSlug']+'/map?session='+fixture['sessionId']),('store','/store/'+store['slug']),('product','/product/'+product['id']),('reservations','/reservations'),('profile','/profile'),('login','/login')]
 for w in [360,390,768,1024,1440]:
  page.set_viewport_size({'width':w,'height':950})
  for name,route in routes:
   page.goto(BASE+route, wait_until="domcontentloaded");page.wait_for_load_state('networkidle');expect(page.locator('h1').first).to_be_visible()
   page.evaluate('document.fonts.ready')
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'{name} overflow at{w}'
   settled(page);page.screenshot(path=str(OUT/f'{name}-{w}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'{name} late overflow at{w}'
 ok('Ten customer/public routes captured at all five widths without page overflow')
 page.goto(BASE+'/profile', wait_until="domcontentloaded");page.wait_for_load_state('networkidle');expect(page.locator('h1')).to_be_visible()
 font=page.locator('input').first.evaluate('(el)=>getComputedStyle(el).fontFamily');assert 'Kodchasan' in font or 'kodchasan' in font.lower()
 page.emulate_media(reduced_motion='reduce');duration=page.locator('button').first.evaluate('(el)=>getComputedStyle(el).transitionDuration');assert all(float(v.strip().removesuffix('s'))<=0.01 for v in duration.split(','))
 ok('Rendered functional font and reduced-motion behavior verified')
 assert not errors,errors
 b.close()
(OUT/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'screenshots':50},ensure_ascii=False,indent=2))
