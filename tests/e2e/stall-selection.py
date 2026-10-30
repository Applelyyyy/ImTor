"""Real authenticated merchant selector and admin map flow; loopback *_test only."""
import json,os,re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from ui_helpers import settled
ROOT=Path(__file__).resolve().parents[2]
BASE=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3101')
assert urlparse(BASE).hostname in {'localhost','127.0.0.1'}
f=json.loads((ROOT/'test-results/fixtures.json').read_text());assert f['databaseName'].endswith('_test')
out=ROOT/'artifacts/stall-selection/browser';out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ok(s):checks.append(s);print('PASS',s,flush=True)
def api(c,method,path,body=None,status=200):
 r=c.request.fetch(BASE+path,method=method,data=body,headers={'Origin':BASE,'Content-Type':'application/json'});assert r.status==status,(method,path,r.status,r.text());return r.json().get('data')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 contexts=[]
 for i in range(3):
  c=b.new_context(viewport={'width':1440,'height':1000});c.add_cookies([{'name':'next-auth.session-token','value':f['users'][i]['token'],'url':BASE}]);contexts.append(c)
 admin,merchant,other=contexts
 # Upload a purpose-made2:1 market diagram through the actual existing admin/S3 flow.
 a=admin.new_page();a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/markets/'+f['marketId']+'/layout',wait_until='networkidle');a.get_by_role('button',name='ภาพพื้นหลัง',exact=True).click();ad=a.get_by_role('dialog')
 ad.locator('input[type=file]').set_input_files(str(ROOT/'test-results/market-layout-qa.png'))
 expect(ad.locator('[data-upload-state=complete]')).to_be_visible(timeout=30000)
 ad.get_by_role('button',name='บันทึกภาพพื้นหลัง',exact=True).click();expect(ad).not_to_be_visible();expect(a.get_by_text('บันทึกภาพพื้นหลังแล้ว',exact=True)).to_be_visible()
 canvas=a.locator('[data-map-canvas]');expect(canvas.locator('img')).to_be_visible();a.wait_for_function('document.querySelector("[data-map-canvas] img").naturalWidth>0')
 assert abs(canvas.evaluate('(e)=>e.clientWidth/e.clientHeight')-2)<.02
 settled(a);a.screenshot(path=str(out/'admin-uploaded-layout.png'),full_page=True)
 # Keyboard edit persists normalized geometry used by both maps.
 marker=a.get_by_role('button',name='ล็อก A99 เลือกหรือใช้ปุ่มลูกศรเพื่อย้าย',exact=True)
 marker.focus();marker.press('ArrowRight');a.get_by_role('button',name='บันทึกตำแหน่ง (1)',exact=True).click();expect(a.get_by_text('บันทึกตำแหน่ง 1 ล็อกแล้ว',exact=True)).to_be_visible()
 ok('Admin actual S3 layout upload keeps2:1 aspect and keyboard position edits persist')
 stores=api(other,'GET','/api/stores');comp=next(iter(stores),None) or api(other,'POST','/api/stores',{'name':f['tag']+' ร้านอื่น','kind':'MARKET'},201)
 selection=api(merchant,'GET','/api/attendance/selection?storeId='+f['storeId']);small=next(m for m in selection['markets'] if m['id']==f['marketId']);a98=next(s for s in small['stalls'] if s['code']=='A98');a97=next(s for s in small['stalls'] if s['code']=='A97');a99=next(s for s in small['stalls'] if s['code']=='A99')
 api(other,'POST','/api/attendance',{'storeId':comp['id'],'sessionId':f['sessionId'],'stallId':a98['id'],'authorized':True},201)
 page=merchant.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def open_picker(width=1440):
  page.set_viewport_size({'width':width,'height':900});page.goto(BASE+'/merchant',wait_until='networkidle');page.get_by_role('button',name='เลือกวันและตลาด',exact=True).or_(page.get_by_role('button',name='เปลี่ยนวันหรือล็อก',exact=True)).click();d=page.get_by_role('dialog');expect(d.get_by_role('radiogroup',name='เลือกตลาด')).to_be_visible();return d
 def choose(d,code):
  direct=d.get_by_role('button',name='ล็อก '+code+' โซน',exact=False)
  if direct.count():direct.click()
  else:
   d.get_by_role('button',name=re.compile('^ตำแหน่งร่วมกัน .*'+re.escape(code))).click();d.locator('[data-cluster-choice]').filter(has_text='· '+code+' ·').click()
  expect(d.locator('[data-attendance-selector] section h2')).to_contain_text('ล็อก '+code)
 d=open_picker();expect(d.get_by_role('radio',name='ตลาดเล็กทดสอบ',exact=True)).to_be_checked();assert len(d.get_by_role('radiogroup',name='เลือกรอบตลาด').get_by_role('radio').all())==2
 expect(d.locator('[data-map-canvas]')).to_have_attribute('data-schematic','false');assert abs(d.locator('[data-map-canvas]').evaluate('(e)=>e.clientWidth/e.clientHeight')-2)<.02
 choose(d,'A98');expect(d.locator('section')).to_contain_text('ล็อกนี้มีร้านลงทะเบียนแล้ว');expect(d.get_by_role('button',name='ยืนยันล็อก A98')).to_have_count(0)
 choose(d,'A99');button=d.get_by_role('button',name='ยืนยันล็อก A99',exact=True);expect(button).to_be_disabled();ack=d.get_by_role('checkbox',name='ฉันยืนยันว่ามีสิทธิ์ใช้ล็อกนี้',exact=True);expect(ack).not_to_be_checked()
 assert ack.bounding_box()['width']<=20 and ack.bounding_box()['height']<=20
 ack.focus();ack.press('Space');expect(ack).to_be_checked();expect(button).to_be_enabled();ack.press('Space');expect(ack).not_to_be_checked()
 d.get_by_text('ฉันยืนยันว่ามีสิทธิ์ใช้ล็อกนี้',exact=True).click();expect(ack).to_be_checked();button.click();expect(d).not_to_be_visible();expect(page.get_by_text('บันทึกตำแหน่งเรียบร้อย',exact=True)).to_be_visible()
 after=api(merchant,'GET','/api/attendance/selection?storeId='+f['storeId']);current=next(s for m in after['markets'] for s in m['sessions'] if s['id']==f['sessionId'])['currentAttendance'];assert current['stallId']==a99['id'];attendance_id=current['id']
 ok('Visual selection rejects occupied stall; compact required checkbox supports label/Space and real save persists')
 # Five responsive selected panels: no page jump, action and acknowledgement immediately visible.
 for width in [360,390,768,1024,1440]:
  d=open_picker(width);before=page.evaluate('scrollY');choose(d,'A99');expect(d.get_by_role('button',name='ยืนยันล็อก A99',exact=True)).to_be_in_viewport();expect(d.get_by_role('checkbox')).to_be_in_viewport()
  assert abs(page.evaluate('scrollY')-before)<2;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  expect(d.locator('[data-stall-id="'+a99['id']+'"]').first).to_have_attribute('data-selected','true');settled(page);page.screenshot(path=str(out/f'selected-{width}.png'))
  # Close selected mobile panel first, then outer dialog. No unsaved changes exist.
  page.keyboard.press('Escape')
  if d.is_visible():page.keyboard.press('Escape')
  expect(d).not_to_be_visible()
 ok('Own selection/checkbox/actions visible at360/390/768/1024/1440 without page jump or horizontal overflow')
 d=open_picker();choose(d,'A97');d.get_by_role('checkbox').check();d.get_by_role('button',name='ยืนยันล็อก A97',exact=True).click();expect(d).not_to_be_visible()
 data=api(merchant,'GET','/api/attendance/selection?storeId='+f['storeId']);current=next(s for m in data['markets'] for s in m['sessions'] if s['id']==f['sessionId'])['currentAttendance'];assert current['id']==attendance_id and current['stallId']==a97['id']
 page.reload(wait_until='networkidle');expect(page.locator('.merchant-location')).to_contain_text('A97')
 pub=api(merchant,'GET','/api/markets/'+f['marketSlug']+'?session='+f['sessionId']);assert next(s for s in pub['stalls'] if s['id']==a97['id'])['vendor']['name'].startswith(f['tag'])
 ok('Changing stall updates same attendance, survives refresh and matches public map')
 # Conflict after opening: server wins; old attendance preserved and session remains selected.
 d=open_picker();choose(d,'A99');d.get_by_role('checkbox').check()
 api(other,'POST','/api/attendance',{'storeId':comp['id'],'sessionId':f['sessionId'],'stallId':a99['id'],'authorized':True},201)
 d.get_by_role('button',name='ยืนยันล็อก A99',exact=True).click();expect(d.get_by_text('ล็อกนี้ถูกเลือกไปแล้ว กรุณาเลือกล็อกอื่น',exact=True)).to_be_visible();expect(d.locator('section')).to_contain_text('มีร้านลงทะเบียนแล้ว');expect(d.get_by_role('radio',name='ตลาดเล็กทดสอบ',exact=True)).to_be_checked();expect(d.get_by_role('button',name='ยืนยันล็อก A99',exact=True)).to_have_count(0);expect(d.get_by_text('ล็อกนี้ถูกเลือกไปแล้ว กรุณาเลือกล็อกอื่น',exact=True)).to_be_visible()
 data=api(merchant,'GET','/api/attendance/selection?storeId='+f['storeId']);assert next(s for m in data['markets'] for s in m['sessions'] if s['id']==f['sessionId'])['currentAttendance']['stallId']==a97['id']
 settled(page);page.screenshot(path=str(out/'conflict-refresh.png'));ok('Stale claim rejected409; availability refresh retains market/session and original assignment')
 # A different market renders its own geometry, disabled and edge stalls; no stale small-market marker.
 d.get_by_role('radio',name='ตลาดใหญ่ทดสอบ',exact=True).click();expect(d.locator('[data-map-canvas]')).to_have_attribute('data-schematic','true');expect(d.get_by_role('button',name='ล็อก A97',exact=False)).to_have_count(0)
 expect(d.get_by_role('radiogroup',name='เลือกรอบตลาด').get_by_role('radio')).to_have_count(1)
 choose(d,'B13');expect(d.locator('section')).to_contain_text('ปิดใช้งาน');expect(d.get_by_role('button',name='ยืนยันล็อก B13')).to_have_count(0)
 edge=d.get_by_role('button',name='ล็อก B00 โซน',exact=False);edge.focus();edge.press('Enter');expect(d.locator('section')).to_contain_text('ล็อก B00');expect(edge).to_have_attribute('aria-pressed','true')
 d.get_by_role('button',name='ขยาย +',exact=True).click();expect(d.get_by_text('125%',exact=True)).to_be_visible();d.get_by_role('button',name='คืนมุมมอง',exact=True).click();expect(d.get_by_text('100%',exact=True)).to_be_visible()
 # Drag must not change selection.
 region=d.get_by_role('region',name='ผังล็อกที่เลื่อนได้');box=region.bounding_box();page.mouse.move(box['x']+box['width']*.6,box['y']+box['height']*.7);page.mouse.down();page.mouse.move(box['x']+box['width']*.3,box['y']+box['height']*.6,steps=8);page.mouse.up();expect(edge).to_have_attribute('aria-pressed','true')
 d.get_by_role('checkbox').check();d.get_by_role('button',name='ยืนยันล็อก B00',exact=True).click();expect(d).not_to_be_visible();ok('Large-market schematic, disabled stall, edge marker, keyboard, zoom/reset/pan and second-market save work')
 d=open_picker(390);d.get_by_role('radio',name='ตลาดใหญ่ทดสอบ',exact=True).click();cluster=d.locator('[data-map-cluster]');cluster.click();expect(d.locator('[data-map-cluster-chooser]')).to_be_visible();settled(page);page.screenshot(path=str(out/'mobile-cluster-chooser.png'));page.keyboard.press('Escape');expect(d.locator('[data-map-cluster-chooser]')).to_have_count(0);expect(cluster).to_be_focused();choose(d,'B11');d.get_by_role('button',name='กลับไปเลือก',exact=True).click();page.keyboard.press('Escape');expect(d.get_by_role('heading',name='ละทิ้งการเปลี่ยนแปลง?')).to_be_visible();d.get_by_role('button',name='แก้ไขต่อ').click();expect(d.locator('[data-selected=true][data-stall-id]')).to_be_visible();page.keyboard.press('Escape');d.get_by_role('button',name='ละทิ้งการเปลี่ยนแปลง').click();expect(d).not_to_be_visible();ok('Mobile panel stays in single focus trap; dirty close supports resume/discard')
 # Both market layouts and selected controls fit at every requested width.
 for width in [360,390,768,1024,1440]:
  d=open_picker(width);d.get_by_role('radio',name='ตลาดใหญ่ทดสอบ',exact=True).click();before=page.evaluate('scrollY');choose(d,'B12');expect(d.get_by_role('button',name='ยืนยันล็อก B12',exact=True)).to_be_in_viewport();expect(d.get_by_role('checkbox')).to_be_in_viewport();assert abs(page.evaluate('scrollY')-before)<2;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');settled(page);page.screenshot(path=str(out/f'large-schematic-{width}.png'))
  page.keyboard.press('Escape')
  if not d.get_by_role('heading',name='ละทิ้งการเปลี่ยนแปลง?').count():page.keyboard.press('Escape')
  d.get_by_role('button',name='ละทิ้งการเปลี่ยนแปลง').click();expect(d).not_to_be_visible()
 ok('Large-market schematic and contextual confirmation fit all five requested widths')
 d=open_picker(390);d.get_by_role('radio',name='ตลาดใหญ่ทดสอบ',exact=True).click();d.get_by_text('เลือกล็อกจากรายการข้อความ',exact=True).click();d.get_by_label('ค้นหาโซนหรือรหัสล็อก',exact=True).fill('B12');d.get_by_role('button',name='โซน B · B12 · เลือกได้',exact=True).click();expect(d.get_by_role('button',name='ยืนยันล็อก B12',exact=True)).to_be_in_viewport();page.keyboard.press('Escape');page.keyboard.press('Escape');d.get_by_role('button',name='ละทิ้งการเปลี่ยนแปลง').click();ok('Searchable text alternative selects the same persisted stall on mobile')
 # Canceled-session conflict must never silently become a draft for another date.
 d=open_picker();d.get_by_role('radio',name='ตลาดเล็กทดสอบ',exact=True).click();d.get_by_role('radiogroup',name='เลือกรอบตลาด').get_by_role('radio').last.click();choose(d,'A98');d.get_by_role('checkbox').check()
 api(admin,'PATCH','/api/admin/sessions/'+f['nextSessionId'],{'status':'CANCELLED'})
 d.get_by_role('button',name='ยืนยันล็อก A98',exact=True).click();expect(d.get_by_text('รอบตลาดนี้ไม่เปิดให้เลือกล็อก',exact=True)).to_be_visible();expect(d.locator('[data-map-canvas]')).to_have_count(0);expect(d.get_by_role('radiogroup',name='เลือกรอบตลาด').locator('[aria-checked=true]')).to_have_count(0)
 api(admin,'PATCH','/api/admin/sessions/'+f['nextSessionId'],{'status':'SCHEDULED'})
 page.keyboard.press('Escape');expect(d).not_to_be_visible();ok('Canceled-session conflict clears pending stall/date instead of silently moving it to another session')
 # Technical read failure stays Thai and recovers through the real endpoint.
 page.route('**/api/attendance/selection?*',lambda route:route.fulfill(status=500,content_type='application/json',body=json.dumps({'error':{'message':'Prisma StackTrace internalStoreId'}})))
 page.get_by_role('button',name='เลือกวันและตลาด',exact=True).or_(page.get_by_role('button',name='เปลี่ยนวันหรือล็อก',exact=True)).click();d=page.get_by_role('dialog');expect(d.get_by_text('โหลดแผนผังไม่สำเร็จ กรุณาลองอีกครั้ง',exact=True)).to_be_visible();expect(d.get_by_text('Prisma',exact=False)).to_have_count(0)
 page.unroute('**/api/attendance/selection?*');d.get_by_role('button',name='ลองอีกครั้ง',exact=True).click();expect(d.get_by_role('radiogroup',name='เลือกตลาด')).to_be_visible();page.keyboard.press('Escape');expect(d).not_to_be_visible();ok('Loading failure sanitizes technical messages and retry recovers authoritative data')
 assert not errors,errors
 b.close()
(out/'results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
