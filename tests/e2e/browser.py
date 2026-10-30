"""Database-backed E2E. Run scripts/test-fixtures.ts first against isolated loopback services."""
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
BASE='http://localhost:3100'
fixture=json.loads((ROOT/'test-results/fixtures.json').read_text())
results=[]
errors=[]
def passed(name):
    results.append(name)
    print('PASS',name,flush=True)
def login(browser,index):
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.add_cookies([{'name':'next-auth.session-token','value':fixture['users'][index]['token'],'url':BASE}])
    return context

def api(context,method,path,body=None,expected=200):
    r=context.request.fetch(BASE+path,method=method,data=body,headers={'Origin':BASE,'Content-Type':'application/json'})
    assert r.status==expected, f'{method} {path}: HTTP {r.status}: {r.text()}'
    return r.json().get('data')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    guest=browser.new_context(viewport={'width':1440,'height':1000})
    page=guest.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    response=page.goto(BASE)
    page.wait_for_load_state('networkidle')
    assert response.status==200
    expect(page.get_by_role('heading',level=1)).to_contain_text('วันนี้กินอะไรดี')
    assert page.locator('a[href^="/product/"]').count()>0
    page.screenshot(path=str(ROOT/'test-results/home-desktop.png'),full_page=True)
    passed('Guest marketplace backed by persisted products')
    page.locator('input[name="q"]').fill('ขนมปัง')
    page.get_by_role('button',name='ค้นหา',exact=True).click()
    page.wait_for_load_state('networkidle')
    assert 'q=' in page.url
    assert page.locator('a[href^="/product/"]').count()>0
    passed('Product search')
    page.goto(BASE+'/markets/'+fixture['marketSlug']+'/map')
    page.wait_for_load_state('networkidle')
    expect(page.locator('body')).to_contain_text('A99')
    assert page.get_by_role('button').count()>0
    passed('Accessible market stall map and text stall identifiers')
    page.goto(BASE+'/admin');page.wait_for_load_state('networkidle')
    assert '/login' in page.url
    api(guest,'POST','/api/admin/markets',{'name':'forbidden'},401)
    passed('Guest admin page and API protection')

    merchant=login(browser,1)
    mp=merchant.new_page()
    mp.on('pageerror',lambda e:errors.append(str(e)))
    mp.goto(BASE+'/become-vendor');mp.wait_for_load_state('networkidle')
    mp.get_by_label('ชื่อร้านค้า',exact=False).fill(fixture['tag']+' ร้านชา')
    mp.get_by_role('button',name='สร้างร้านของฉัน').click()
    mp.wait_for_url('**/merchant');mp.wait_for_load_state('networkidle')
    stores=api(merchant,'GET','/api/stores')
    store=next(s for s in stores if s['name'].startswith(fixture['tag']))
    passed('Authenticated merchant creates persistent shop through UI')
    mp.goto(BASE+'/merchant/schedule');mp.wait_for_load_state('networkidle')
    mp.get_by_label('เลือกตลาดและวันขาย').select_option(fixture['sessionId'])
    mp.get_by_label('เลือกล็อกที่ได้รับอนุญาต').select_option(fixture['stallId'])
    mp.get_by_label('ฉันมีสิทธิใช้พื้นที่นี้',exact=False).check()
    mp.get_by_role('button',name='บันทึกตารางและตำแหน่ง').click()
    expect(mp.get_by_role('status')).to_contain_text('บันทึก')
    passed('Merchant joins actual session and self-reports authorized stall')
    mp.goto(BASE+'/merchant/products/new');mp.wait_for_load_state('networkidle')
    mp.get_by_label('ชื่อสินค้า',exact=False).fill(fixture['tag']+' ชาทดสอบ')
    mp.get_by_label('ราคาปกติ (บาท)',exact=False).fill('100')
    mp.locator('input[type=file]').set_input_files(str(ROOT/'public/images/tea.jpg'))
    expect(mp.locator('.upload-preview img')).to_be_visible(timeout=30000)
    mp.get_by_role('button',name='เผยแพร่สินค้า').click()
    mp.wait_for_url('**/merchant/products');mp.wait_for_load_state('networkidle')
    data=api(merchant,'GET','/api/products?q='+fixture['tag'])
    product=next(x for x in data if x['name'].startswith(fixture['tag']))
    assert product['price']['current']==10000 and product['price']['active'] is False
    assert product['imageUrl'].startswith('http://127.0.0.1:59000/imtor-test/approved/')
    approved=guest.request.get(product['imageUrl'])
    assert approved.status==200 and approved.headers['content-type'].startswith('image/jpeg')
    passed('Real browser PUT to S3-compatible storage, image decoding/finalization, and publication')
    page.goto(BASE+'/product/'+product['id']);page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading',level=1)).to_contain_text(fixture['tag'])
    expect(page.locator('body')).to_contain_text('A99')
    passed('Customer sees newly published normal-price product and stall')
    customer=login(browser,2)
    api(customer,'PATCH','/api/stores/'+store['id'],{'name':'not yours'},403)
    api(customer,'POST','/api/attendance',{'storeId':store['id'],'sessionId':fixture['sessionId'],'stallId':fixture['stallId'],'authorized':True},403)
    passed('Cross-owner store and attendance writes rejected')

    now=datetime.now(timezone.utc)
    pickup_start=(now-timedelta(minutes=1)).isoformat()
    pickup_end=(now+timedelta(minutes=40)).isoformat()
    api(merchant,'PATCH','/api/products/'+product['id'],{'reservable':True,'stock':1,'pickupStart':pickup_start,'pickupEnd':pickup_end,'sessionId':fixture['sessionId']})
    api(merchant,'POST','/api/products/'+product['id']+'/discounts',{'kind':'FINAL_PERCENT','value':30,'startsAt':(now-timedelta(minutes=1)).isoformat(),'endsAt':pickup_end},201)
    priced=api(merchant,'GET','/api/products?q='+fixture['tag'])[0]
    assert priced['price']['current']==3000 and priced['price']['discountPercent']==70
    cp=customer.new_page();cp.goto(BASE+'/product/'+product['id']);cp.wait_for_load_state('networkidle')
    cp.get_by_role('button',name='จองไว้ แล้วไปรับที่ร้าน').click()
    cp.wait_for_url('**/reservations');cp.wait_for_load_state('networkidle')
    reservations=api(customer,'GET','/api/reservations')
    reservation=next(r for r in reservations if r['productId']==product['id'])
    assert reservation['unitPrice']==3000
    api(merchant,'POST','/api/reservations',{'productId':product['id'],'quantity':1},409)
    api(merchant,'PATCH','/api/reservations/'+reservation['id'],{'status':'COMPLETED','pickupCode':'bad'},400)
    api(merchant,'PATCH','/api/reservations/'+reservation['id'],{'status':'COMPLETED','pickupCode':reservation['pickupCode']})
    api(merchant,'PATCH','/api/reservations/'+reservation['id'],{'status':'COMPLETED','pickupCode':reservation['pickupCode']},409)
    passed('Scheduled price snapshot, UI reservation, final-stock guard, pickup verification, and repeat-completion guard')

    admin=login(browser,0)
    ap=admin.new_page();ap.goto(BASE+'/admin');ap.wait_for_load_state('networkidle')
    expect(ap.get_by_role('heading',level=1)).to_contain_text('ภาพรวม')
    created=api(admin,'POST','/api/admin/markets',{'name':fixture['tag']+' ตลาดจัดตาราง'},201)
    rule=api(admin,'POST',f'/api/admin/markets/{created["id"]}/rules',{'weekday':1,'opens':'16:00','closes':'21:00','intervalWeeks':2,'anchorDate':'2026-01-05'},201)
    assert rule['intervalWeeks']==2
    api(admin,'DELETE','/api/admin/rules/'+rule['id'])
    # Fixture cleanup owns this extra venue as well.
    fixture['extraMarketId']=created['id']
    (ROOT/'test-results/fixtures.json').write_text(json.dumps(fixture))
    batch=api(admin,'POST','/api/admin/demo',{'stores':2,'products':6,'customers':2,'stalls':8},201)
    api(admin,'DELETE','/api/admin/demo/'+batch['id'])
    api(merchant,'PATCH','/api/admin/users/'+fixture['users'][1]['id'],{'role':'ADMIN'},403)
    origin=admin.request.post(BASE+'/api/admin/markets',data={'name':'cross-site'},headers={'Origin':'https://not-imtor.invalid'})
    assert origin.status==403
    passed('Admin persistent biweekly schedule, gated coherent demo generation/cleanup, role and CSRF guards')
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobilepage=mobile.new_page();mobilepage.goto(BASE);mobilepage.wait_for_load_state('networkidle')
    assert mobilepage.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    mobilepage.screenshot(path=str(ROOT/'test-results/home-mobile.png'),full_page=True)
    expect(mobilepage.get_by_role('navigation',name='เมนูบนมือถือ')).to_be_visible()
    passed('390px responsive layout and mobile navigation')
    assert not errors,errors
    passed('No browser runtime errors in tested flows')
    browser.close()
(ROOT/'test-results/e2e-results.json').write_text(json.dumps({'passed':results,'browser_errors':errors},ensure_ascii=False,indent=2))
print(f'{len(results)} scenarios passed',flush=True)
