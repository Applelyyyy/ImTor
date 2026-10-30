"""Motion and geometry on the actual built app; only loopback *_test sessions.
Run: codex-browser-env uv tool run --from playwright python tests/e2e/motion-overhaul.py
"""
import json,os,tempfile,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];BASE=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3100');OUT=ROOT/'artifacts/motion-overhaul';OUT.mkdir(parents=True,exist_ok=True)
f=json.loads((ROOT/'test-results/fixtures.json').read_text());assert urlparse(BASE).hostname in ['localhost','127.0.0.1'] and f['databaseName'].endswith('_test')
checks=[];errors=[];failure=None;metrics=[];watched=set()
def ok(name,**detail):checks.append({'check':name,**detail});print('PASS',name,detail,flush=True)
def go(page,path):
 if id(page) not in watched:page.on('pageerror',lambda e:errors.append(str(e)));watched.add(id(page))
 response=page.goto(BASE+path,wait_until='networkidle');assert response.status==200,(path,response.status)
def settle(page):page.evaluate("async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})))}")
def shell(page):return page.evaluate("()=>{const m=document.querySelector('main').getBoundingClientRect(),f=document.querySelector('footer').getBoundingClientRect();return{top:m.top,footer:f.top,width:m.width,scroll:document.querySelector('main').scrollTop}}")
def same(page,before):
 after=shell(page);assert all(abs(after[k]-before[k])<1 for k in before),(before,after)
def sample(page,selector,ms=340):
 return page.evaluate('''async({selector,ms})=>{let rows=[],start=performance.now();await new Promise(resolve=>{function frame(now){const e=document.querySelector(selector);if(e){const r=e.getBoundingClientRect(),s=getComputedStyle(e);rows.push({t:now-start,x:r.x,y:r.y,w:r.width,h:r.height,opacity:Number(s.opacity),scale:s.scale,transform:s.transform})}if(now-start<ms)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});return rows}''',{'selector':selector,'ms':ms})
def cookie(i):return {'name':'next-auth.session-token','value':f['users'][i]['token'],'url':BASE}
def api(context,method,path,data=None,status=200):
 r=context.request.fetch(BASE+path,method=method,data=data,headers={'Origin':BASE});assert r.status==status,(path,r.status);return r.json().get('data')
with sync_playwright()as p:
 browser=p.chromium.launch(headless=True);contexts=[]
 try:
  for width in [360,390,768,1024,1440]:
   c=browser.new_context(viewport={'width':width,'height':1000 if width>780 else 844},has_touch=width<768,record_video_dir=str(OUT/'after-video') if width in [390,1440] else None);contexts.append(c);pg=c.new_page();
   pg.add_init_script("window.__motionStarts=[];document.addEventListener('animationstart',e=>window.__motionStarts.push({name:e.animationName,tag:e.target.tagName}));window.__shifts=[];new PerformanceObserver(l=>window.__shifts.push(...l.getEntries().filter(e=>!e.hadRecentInput).map(e=>e.value))).observe({type:'layout-shift',buffered:true});window.__long=[];new PerformanceObserver(l=>window.__long.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});")
   go(pg,'/');settle(pg);assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth');assert pg.locator('.category-filters .navigation-pending').count()==0;expect(pg.locator('footer nav')).to_have_count(0)
   starts=pg.evaluate('window.__motionStarts');assert sum(x['name']=='imtor-enter' for x in starts)<=11
   before=shell(pg);trigger=pg.locator('header').get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True);trigger.click();rows=sample(pg,'[data-app-dialog]');same(pg,before);assert rows and rows[-1]['opacity']==1
   assert all(abs(r['x']+r['w']/2-width/2)<1.5 for r in rows) if width>=640 else all(r['x']>=-1 and r['w']<=width+1 for r in rows)
   d=pg.get_by_role('dialog');assert d.locator('input').evaluate('e=>document.activeElement===e');d.locator('input').fill('ขนม');d.locator('input').press('Enter');expect(d.locator('p[role=status]')).not_to_contain_text('กำลังค้นหา');settle(pg);pg.keyboard.press('Escape');expect(d).not_to_be_visible();expect(trigger).to_be_focused();same(pg,before)
   pg.screenshot(path=str(OUT/f'home-{width}.png'));ok('Home, centered filters, overlays/search/focus and responsive shell',width=width,heroStarts=len(starts))
   metrics.append({'width':width,'route':'/','cls':pg.evaluate('window.__shifts.reduce((a,b)=>a+b,0)'),'longTasks':pg.evaluate('window.__long')})
   product=pg.locator('.product-photo').first.get_attribute('href');go(pg,product);expect(pg.locator('h1')).to_be_visible();store=pg.locator('a[href^="/store/"]').first.get_attribute('href');go(pg,store);expect(pg.locator('h1')).to_be_visible()
   metrics.append({'width':width,'cls':pg.evaluate('window.__shifts.reduce((a,b)=>a+b,0)'),'longTasks':pg.evaluate('window.__long')});c.close()
  c=browser.new_context(viewport={'width':1440,'height':1000});contexts.append(c);pg=c.new_page();go(pg,'/markets?type=SMALL');old=pg.locator('.market-results').inner_text()
  pg.get_by_role('link',name='ตลาดใหญ่',exact=True).click();pg.wait_for_url('**type=LARGE*');expect(pg.locator('.market-switcher a[aria-current=page]')).to_contain_text('ตลาดใหญ่');frames=sample(pg,'.market-switcher-indicator');metrics.append({'interaction':'market indicator','frameIntervalsMs':[round(frames[i]['t']-frames[i-1]['t'],2)for i in range(1,len(frames))]});assert len(set(round(r['x'],1)for r in frames))>1,'indicator must move after committed navigation';assert 'LARGE' in pg.locator('.market-results').inner_text()
  pg.get_by_role('link',name='ตลาดเล็ก',exact=True).click();pg.wait_for_url('**type=SMALL*');pg.emulate_media(reduced_motion='reduce');assert pg.locator('.market-switcher-indicator').evaluate("e=>e.getAnimations().filter(a=>a.playState==='running').length")==0;pg.emulate_media(reduced_motion='no-preference');pg.get_by_role('link',name='ตลาดใหญ่',exact=True).click();expect(pg.locator('.market-switcher a[aria-current=page]')).to_contain_text('ตลาดใหญ่');assert 'LARGE' in pg.locator('.market-results').inner_text();ok('Committed market indicator moves and rapid navigation keeps label/data together')
  go(pg,'/markets/'+f['marketSlug']+'/map?session='+f['sessionId']);viewport=pg.get_by_role('region',name='ผังล็อกที่เลื่อนได้');marker=pg.locator('[data-map-stall]').first;marker.click();expect(marker).to_have_attribute('data-selected','true');settle(pg);before=shell(pg)
  pg.get_by_role('button',name='ขยาย +',exact=True).click()
  drift=pg.evaluate('''async()=>{let max=0;await new Promise(resolve=>{let start=performance.now();function tick(now){const c=document.querySelector('[data-map-canvas]').getBoundingClientRect();for(const e of document.querySelectorAll('[data-map-stall]')){const r=e.getBoundingClientRect(),x=parseFloat(e.style.left)/100,y=parseFloat(e.style.top)/100;max=Math.max(max,Math.abs(r.x+r.width/2-c.x-c.width*x),Math.abs(r.y+r.height/2-c.y-c.height*y))}if(now-start<320)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});return max}''');assert drift<2,drift;same(pg,before)
  selected=marker.get_attribute('data-stall-id');box=viewport.bounding_box();pg.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);pg.mouse.down();pg.mouse.move(box['x']+box['width']/2-70,box['y']+box['height']/2-30,steps=6);pg.mouse.up();expect(pg.locator('[data-map-stall][data-selected=true]')).to_have_attribute('data-stall-id',selected);ok('Map zoom maintains marker/image geometry and pan never selects',maxDriftPx=drift)
  pg.get_by_role('button',name='คืนมุมมอง',exact=True).click();settle(pg);assert viewport.evaluate('e=>e.scrollLeft<1&&e.scrollTop<1'),'reset must restore zero'
  pg.evaluate("()=>{const e=document.querySelector('[aria-label=\"ผังล็อกที่เลื่อนได้\"]');const scroll=e.scrollTo.bind(e);e.__centerCalls=0;e.scrollTo=(...a)=>{e.__centerCalls++;return scroll(...a)}}")
  pg.get_by_role('button',name='ขยาย +',exact=True).click();pg.locator('.stall-list-item').last.click();pg.wait_for_timeout(500);assert viewport.evaluate('e=>e.__centerCalls>0'),'selection during zoom must center after zoom'
  viewport.evaluate('e=>e.scrollTo({left:400,top:150,behavior:"instant"})');pg.locator('.stall-list-item').first.click();pg.emulate_media(reduced_motion='reduce');pg.wait_for_timeout(50)
  scrolls=pg.evaluate('''async()=>{const e=document.querySelector('[aria-label="ผังล็อกที่เลื่อนได้"]');let xs=[],start=performance.now();await new Promise(resolve=>{function frame(now){xs.push([e.scrollLeft,e.scrollTop]);if(now-start<180)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});return xs}''');assert max(x[0]for x in scrolls)-min(x[0]for x in scrolls)<1 and max(x[1]for x in scrolls)-min(x[1]for x in scrolls)<1
  pg.emulate_media(reduced_motion='no-preference');ok('Reset, mid-zoom selection and changing reduced motion preserve final map state')
  for slug,session in [(f['marketSlug'],f['sessionId']),(f['largeMarketSlug'],f['largeSessionId'])]:
   go(pg,'/markets/'+slug+'/map?session='+session);expect(pg.locator('[data-map-canvas]')).to_be_visible();pg.screenshot(path=str(OUT/('large-map.png' if slug==f['largeMarketSlug'] else 'small-map.png')))
  c.close()
  c=browser.new_context(viewport={'width':390,'height':844},has_touch=True,record_video_dir=str(OUT/'after-video'));contexts.append(c);pg=c.new_page();go(pg,'/markets/'+f['marketSlug']+'/map?session='+f['sessionId']);marker=pg.locator('[data-map-stall]').first;marker.click();sheet=pg.get_by_role('dialog');expect(sheet).to_be_visible();settle(pg);before=shell(pg);handle=pg.get_by_role('button',name='ปิดรายละเอียดล็อก',exact=True);r=handle.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
  pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x,y+20,steps=8);pg.mouse.up();settle(pg);expect(sheet).to_be_visible();same(pg,before)
  r=handle.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2;pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x,y+125,steps=8);pg.mouse.up();expect(sheet).not_to_be_visible();expect(marker).to_be_focused();ok('Mobile bottom sheet drag snaps back or dismisses; focus restored')
  marker.click();settle(pg);handle=pg.get_by_role('button',name='ปิดรายละเอียดล็อก',exact=True);handle.focus();handle.press('Enter');expect(sheet).not_to_be_visible();ok('Bottom sheet has keyboard dismissal equivalent')
  c.close()
  c=browser.new_context(viewport={'width':1440,'height':1000});contexts.append(c);c.add_cookies([cookie(1)]);pg=c.new_page();go(pg,'/merchant/products');pg.get_by_role('button',name='+ เพิ่มสินค้า',exact=True).first.click();d=pg.get_by_role('dialog');expect(d.get_by_label('ชื่อสินค้า',exact=False)).to_be_visible();settle(pg);d.get_by_role('button',name='ปิด',exact=True).click();assert pg.locator('[data-app-dialog][data-state=closed] input').count()>0,'exit must retain form contents';expect(d).not_to_be_visible();pg.get_by_role('button',name='+ เพิ่มสินค้า',exact=True).first.click();expect(pg.get_by_role('dialog').get_by_label('ชื่อสินค้า',exact=False)).to_be_visible();pg.keyboard.press('Escape');expect(d).not_to_be_visible();ok('Product dialog exit retains form; immediate reopen has current contents')
  pg.get_by_role('button',name='จัดการ',exact=False).first.click();menu=pg.get_by_role('menu');expect(menu).to_be_visible();assert menu.evaluate("e=>getComputedStyle(e).animationName")=='imtor-popup-in';pg.keyboard.press('Escape');expect(menu).not_to_be_visible();ok('Anchored dropdown uses one bounded enter/exit')
  go(pg,'/merchant/products');row=pg.locator('[data-product-id="'+f['productId']+'"]');row.get_by_role('button',name='จัดการ',exact=False).click();pg.get_by_role('menuitem',name='ปรับจำนวน',exact=True).click();d=pg.get_by_role('dialog');expect(d.get_by_text('กำลังตรวจสอบจำนวน…',exact=True)).not_to_be_visible();counter=d.locator('.inventory-available .change-feedback');assert counter.evaluate('e=>e.getAnimations().length')==0
  pg.evaluate("()=>{window.__confirmedRuns=0;const animate=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.matches('.inventory-available .change-feedback'))window.__confirmedRuns++;return animate.apply(this,args)}}")
  old=int(counter.inner_text());d.get_by_role('button',name='เพิ่มจำนวน',exact=True).click();expect(counter).to_contain_text(str(old+1));settle(pg);assert pg.evaluate('window.__confirmedRuns')==1;pg.keyboard.press('Escape');expect(d).not_to_be_visible();ok('Inventory changes only after actual backend confirmation; initial value does not animate')
  c.close()
  c=browser.new_context(viewport={'width':390,'height':844});contexts.append(c);c.add_cookies([cookie(0)]);pg=c.new_page();go(pg,'/admin');before=shell(pg);pg.get_by_role('button',name='เมนูผู้ดูแล',exact=True).click();settle(pg);same(pg,before);expect(pg.get_by_role('dialog')).to_be_visible();pg.keyboard.press('Escape');expect(pg.get_by_role('dialog')).not_to_be_visible();same(pg,before);ok('Admin directional navigation sheet preserves shell and keyboard dismissal');c.close()
  for width in [390,1440]:
   c=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce');contexts.append(c);pg=c.new_page();go(pg,'/');
   if width==1440:
    card=pg.locator('.product-card').first;card.hover();assert card.evaluate("e=>getComputedStyle(e).transform==='none'&&getComputedStyle(e.querySelector('img')).transform==='none'")
   assert pg.evaluate("document.getAnimations().filter(a=>a.playState==='running').length")==0;pg.locator('header').get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True).click();expect(pg.get_by_role('dialog')).to_be_visible();assert pg.evaluate("document.getAnimations().filter(a=>a.playState==='running').length")==0;pg.keyboard.press('Escape');expect(pg.get_by_role('dialog')).not_to_be_visible();ok('Reduced motion shows final state immediately with full keyboard function',width=width);c.close()
  assert not errors,errors
 except Exception as e:failure=str(e);print('FAIL',failure,flush=True)
 finally:
  for c in contexts:
   try:c.close()
   except:pass
  browser.close();(OUT/'browser-final.json').write_text(json.dumps({'passed':failure is None,'checks':checks,'metrics':metrics,'javascriptErrors':errors,'failure':failure},indent=2))
assert failure is None,failure
