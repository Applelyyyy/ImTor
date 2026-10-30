"""Contextual search/map/settings/pickup and uncertain-response regressions; local *_test only."""
import json,os,time
from datetime import datetime,timedelta,timezone
from pathlib import Path
from ui_helpers import settled
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];BASE=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3100')
f=json.loads((ROOT/'test-results/fixtures.json').read_text());assert f['databaseName'].endswith('_test') and urlparse(BASE).hostname in {'localhost','127.0.0.1','::1'}
out=ROOT/'test-results/contextual-public';out.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
def ok(s):checks.append(s);print('PASS',s,flush=True)
def api(c,method,path,body=None,status=200):
 r=c.request.fetch(BASE+path,method=method,data=body,headers={'Origin':BASE,'Content-Type':'application/json'});assert r.status==status,(path,r.status);return r.json().get('data')
def visit(page,path):
 page.goto(BASE+path,wait_until='networkidle');expect(page.locator('h1').first).to_be_visible();page.evaluate('document.fonts.ready')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);m=b.new_context();c=b.new_context();a=b.new_context();guest=b.new_context()
 for ctx,i in [(m,1),(c,2),(a,0)]:ctx.add_cookies([{'name':'next-auth.session-token','value':f['users'][i]['token'],'url':BASE}])
 store=api(m,'GET','/api/stores')[0];now=datetime.now(timezone.utc)
 product=api(m,'POST','/api/products',{'storeId':store['id'],'categoryId':f['categoryId'],'name':f['tag']+' Context ข้าวผัด '+str(time.time_ns())[-8:],'imageUrl':'/images/rice.jpg','price':4500,'stock':10,'reservable':True,'pickupStart':(now-timedelta(minutes=1)).isoformat(),'pickupEnd':(now+timedelta(minutes=45)).isoformat()},201)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));visit(page,'/')
 page.get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True).first.click();d=page.get_by_role('dialog');inp=d.get_by_role('textbox');inp.fill(product['name']);inp.press('Enter');expect(d.get_by_role('link',name=product['name'],exact=False)).to_be_visible();expect(d).to_contain_text('฿45');ok('Global search Enter shows real product/current price in the same dialog')
 inp.fill(store['name']);d.get_by_role('button',name='ค้นหา',exact=True).click();expect(d.get_by_role('link',name=product['name'],exact=False)).to_be_visible()
 inp.fill('no-such-product-'+f['tag']);inp.press('Enter');expect(d.get_by_role('heading',name='ไม่พบสินค้าที่ค้นหา')).to_be_visible();ok('Store-name and no-result global searches stay beside the input')
 page.keyboard.press('Escape');expect(d).not_to_be_visible()
 # Older request must never replace newer results, even when its delayed response arrives last.
 page.get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True).first.click();held=[]
 def stale(route):
  if 'q=first' in route.request.url:held.append(route)
  else:route.fulfill(status=200,content_type='application/json',body=json.dumps({'data':[product|{'store':{'name':store['name']},'location':'QA','price':{'current':4500}}]}))
 page.route('**/api/products?*',stale);inp.fill('first');inp.press('Enter');page.wait_for_timeout(100);inp.fill('second');inp.press('Enter');expect(d.get_by_role('link',name=product['name'],exact=False)).to_be_visible()
 for route in held:
  try:route.fulfill(status=200,content_type='application/json',body='{"data":[]}')
  except Exception:pass
 expect(d.get_by_role('link',name=product['name'],exact=False)).to_be_visible();page.unroute('**/api/products?*',stale);page.keyboard.press('Escape');ok('Aborted stale search response cannot overwrite the latest result')
 # Complete HTTP201 headers with a truncated body must preserve reservation retry identity.
 visit(page,'/product/'+product['id']);attempts=[]
 def truncate(route):
  attempts.append(route.request.post_data_json)
  if len(attempts)==1:route.fetch();route.fulfill(status=201,content_type='application/json',body='{')
  else:route.continue_()
 page.route('**/api/reservations',truncate);page.get_by_role('button',name='จองไว้ แล้วไปรับที่ร้าน',exact=True).click();page.get_by_label('จำนวนที่ต้องการจอง',exact=False).fill('2');page.get_by_role('button',name='จองไว้ แล้วไปรับที่ร้าน').click();expect(page.get_by_role('alert')).to_be_visible();expect(page.get_by_label('จำนวนที่ต้องการจอง',exact=False)).to_have_attribute('readonly','');page.get_by_role('button',name='ตรวจสอบคำขอจองเดิมอีกครั้ง').click();page.wait_for_url('**/reservations');assert attempts[0]==attempts[1]
 rows=api(c,'GET','/api/reservations');r=next(x for x in rows if x['productId']==product['id']);assert len([x for x in rows if x['productId']==product['id']])==1;assert api(m,'GET',f'/api/products/{product["id"]}/inventory')['available']==8;ok('Truncated201 response retries original reservation key; exactly one booking and8 available')
 page.unroute('**/api/reservations',truncate)
 # Pickup remains contextual and never decrements the already-reserved availability twice.
 mp=m.new_page();visit(mp,'/merchant/reservations');card=mp.locator('.reservation-card').filter(has_text=product['name']);card.get_by_role('button',name='ยืนยันส่งมอบสินค้า',exact=True).click();pickup=mp.get_by_role('dialog');pickup.get_by_label('รหัสที่ลูกค้าแสดง',exact=False).fill(r['pickupCode']);pickup.get_by_role('button',name='ยืนยันส่งมอบสินค้า',exact=True).click();expect(pickup).not_to_be_visible();assert api(m,'GET',f'/api/products/{product["id"]}/inventory')['available']==8;ok('Pickup confirmation dialog completes without a second stock debit')
 visit(mp,'/merchant/settings');mp.get_by_role('button',name='แก้ไขข้อมูลร้าน',exact=True).click();sd=mp.get_by_role('dialog');sd.get_by_label('ชื่อร้าน',exact=False).fill(store['name']+' unsaved');sd.get_by_role('button',name='ยกเลิก',exact=True).click();expect(sd.get_by_role('heading',name='ละทิ้งการเปลี่ยนแปลง?')).to_be_visible();sd.get_by_role('button',name='ละทิ้งการเปลี่ยนแปลง',exact=True).click();assert api(m,'GET','/api/stores')[0]['name']==store['name'];ok('Store settings open contextually; dirty cancel preserves persisted store')
 # Map selection at five widths; desktop panel adjacent, mobile sheet immediately visible.
 for width in [360,390,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':950});visit(page,'/markets/'+f['marketSlug']+'/map?session='+f['sessionId']);field=page.get_by_role('search',name='ค้นหาในแผนผังตลาด').get_by_role('searchbox');field.fill(product['name']);scroll=page.evaluate('scrollY');field.press('Enter');marker=page.get_by_role('button',name='ล็อก A99',exact=False,include_hidden=True);expect(marker).to_have_attribute('aria-pressed','true')
  if width<768:
   detail=page.get_by_role('dialog');expect(detail).to_be_visible();expect(detail).to_contain_text('฿45');expect(detail.get_by_role('link',name='ดูร้านและสินค้า',exact=True)).to_be_in_viewport();settled(page);page.screenshot(path=str(out/f'map-selected-{width}.png'));switcher=detail.get_by_role('button',name='ล็อกถัดไป');switcher=switcher if switcher.is_enabled() else detail.get_by_role('button',name='ล็อกก่อนหน้า');switcher.click();expect(detail.get_by_role('heading')).to_contain_text('A98');page.keyboard.press('Escape')
  else:
   detail=page.locator('[data-map-workspace] section');expect(detail).to_contain_text('฿45');bounds=detail.bounding_box();mapbox=page.get_by_role('region',name='ผังล็อกที่เลื่อนได้').bounding_box();assert bounds['x']>=mapbox['x']+mapbox['width']-2;assert abs(page.evaluate('scrollY')-scroll)<2;expect(detail.get_by_role('link',name='ดูร้านและสินค้า',exact=True)).to_be_in_viewport();settled(page);page.screenshot(path=str(out/f'map-selected-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 ok('Stall product search focuses marker; five widths show adjacent details/mobile sheet and real prices without page scrolling')
 for zoom in [1,1.1,1.25]:
  page.set_viewport_size({'width':1440,'height':1000});page.evaluate('(zoom)=>document.documentElement.style.zoom=zoom',zoom);visit(page,'/');page.get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True).first.click();d=page.get_by_role('dialog');expect(d.get_by_role('textbox')).to_be_in_viewport();assert d.bounding_box()['x']>=0;settled(page);page.screenshot(path=str(out/f'search-zoom-{zoom}.png'));page.keyboard.press('Escape')
 ok('Search dialog is reachable at desktop100/110/125 percent zoom')
 assert not errors,errors;b.close()
(out/'results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
