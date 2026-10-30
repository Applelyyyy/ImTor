"""Motion QA against owned scripts/test-fixtures.ts users on loopback imtor_test only.
Run after browser.py; never use public/demo origin or real Google sessions.
"""
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://localhost:3100'
OUT = ROOT / 'artifacts/motion'
FIXTURE = json.loads((ROOT / 'test-results/fixtures.json').read_text())
RESULTS = []
ERRORS = []

async def passed(name, **details):
    RESULTS.append({'name': name, **details})
    print('PASS', name, flush=True)
    (OUT/'results.json').write_text(json.dumps({'completed':False,'passed':RESULTS,'browser_errors':ERRORS},ensure_ascii=False,indent=2))

async def go(page, path):
    response = await page.goto(BASE + path)
    assert response.status == 200, (path, response.status)
    await page.wait_for_load_state('networkidle')
    await page.evaluate('document.fonts.ready')

async def api(context, method, path, data=None):
    response = await context.request.fetch(BASE + path, method=method, data=data,
        headers={'Origin': BASE, 'Content-Type': 'application/json'})
    assert response.ok, (path, response.status)
    return (await response.json()).get('data')

async def context(browser, user=None, **kwargs):
    ctx = await browser.new_context(**kwargs)
    if user is not None:
        await ctx.add_cookies([{'name': 'next-auth.session-token',
            'value': FIXTURE['users'][user]['token'], 'url': BASE}])
    ctx.on('page', lambda page: page.on('pageerror', lambda e: ERRORS.append(str(e))))
    return ctx

async def hold_requests(page, pattern):
    gate, seen = asyncio.Event(), asyncio.Event()
    async def handler(route):
        seen.set()
        await gate.wait()
        await route.continue_()
    await page.route(pattern, handler)
    return gate, seen, handler

async def main():
    assert urlparse(BASE).hostname in ('localhost', '127.0.0.1')
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        guest = await context(browser, viewport={'width':1440,'height':1000})
        page = await guest.new_page()
        # All requested widths, actual public/merchant/admin rendered screens.
        for width in (375, 390, 768, 1440):
            for user, label, path in ((None,'home','/'),(None,'markets-small','/markets?type=SMALL'),
                    (None,'markets-large','/markets?type=LARGE'),
                    (None,'map',f'/markets/{FIXTURE["marketSlug"]}/map'),
                    (1,'merchant','/merchant'),(1,'product-form','/merchant/products/new'),
                    (0,'admin','/admin'),(0,'admin-form','/admin/markets')):
                ctx = await context(browser, user, viewport={'width':width,'height':900})
                view = await ctx.new_page()
                await go(view,path)
                assert await view.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,label,'overflow')
                await view.screenshot(path=str(OUT/f'{label}-{width}.png'), full_page=True)
                if label == 'map':
                    assert await view.locator('.form-submit').evaluate('(el)=>getComputedStyle(el).color !== getComputedStyle(el).backgroundColor')
                    stage = view.locator('[data-map-stage]'); canvas=view.locator('[data-map-canvas]')
                    for zoom in (1,2):
                        if zoom == 2:
                            for _ in range(4): await view.get_by_role('button',name='ขยาย +').click()
                        await view.wait_for_timeout(210) # inspect final CSS geometry, not request timing
                        s,c = await stage.bounding_box(),await canvas.bounding_box()
                        assert abs(s['height']-c['height']-96) < 2,(width,zoom,s['height'],c['height'])
                    await expect(view.get_by_role('button',name='ขยาย +')).to_be_disabled()
                await ctx.close()
            await passed(f'{width}px viewport: eight pages, no horizontal overflow, map geometry at 1×/2×')

        # Real search navigation: hold only local RSC requests, not a fake pending clock.
        await go(page,'/')
        button=page.get_by_role('button',name='ค้นหา',exact=True)
        ready=await button.bounding_box()
        gate,seen,handler=await hold_requests(page,'**/explore?**')
        await page.locator('input[name=q]').fill('ขนมปัง')
        await button.click()
        await asyncio.wait_for(seen.wait(),10)
        pending=page.locator('button[aria-busy=true]')
        await expect(pending).to_be_disabled()
        bounds=await pending.bounding_box()
        assert abs(ready['width']-bounds['width'])<1,('search button layout shift',ready['width'],bounds['width'])
        assert await pending.inner_text() and 'กำลังค้นหา' in await pending.inner_text()
        gate.set();await page.wait_for_url('**/explore?q=*')
        await page.unroute('**/explore?**',handler)
        await expect(page.locator('a[href^="/product/"]').first).to_be_visible()
        await passed('Search uses true pending feedback without button layout shift')

        await go(page,'/markets?type=SMALL')
        old=await page.locator('.market-results').inner_text()
        gate,seen,handler=await hold_requests(page,'**/markets?**type=LARGE**')
        await page.get_by_role('link',name='ตลาดใหญ่',exact=True).click()
        await asyncio.wait_for(seen.wait(),10)
        await expect(page.locator('.market-switcher a[aria-current=page]')).to_have_text('ตลาดเล็ก')
        assert await page.locator('.market-results').inner_text()==old
        await expect(page.locator('.navigation-pending[data-pending=true]')).to_be_visible()
        gate.set();await page.wait_for_url('**type=LARGE*')
        await expect(page.locator('.market-switcher a[aria-current=page]')).to_have_text('ตลาดใหญ่')
        await page.unroute('**/markets?**type=LARGE**',handler)
        await expect(page.locator('.market-card')).to_have_count(1)
        assert 'LARGE' in await page.locator('.market-card').inner_text()
        await passed('Slow market switch keeps committed label/data together and shows pending')

        await go(page,f'/markets/{FIXTURE["marketSlug"]}/map')
        a99=page.locator('[data-map-stall]').filter(has_text='A99')
        await a99.focus();await page.keyboard.press('Enter')
        await expect(a99).to_have_attribute('aria-pressed','true')
        panel=page.locator('.location-panel'); await expect(panel).to_contain_text('A99')
        await panel.evaluate('(el)=>el.dataset.persisted="yes"')
        a98=page.locator('.stall-list-item').filter(has_text='A98')
        await a98.focus();await page.keyboard.press('Space')
        await expect(panel).to_contain_text('A98')
        assert await panel.get_attribute('data-persisted')=='yes'
        assert await a98.evaluate('(el)=>el===document.activeElement')
        await expect(page.locator('[data-map-stall][aria-pressed=true]')).to_contain_text('A98')
        await expect(page.get_by_role('button',name='ย่อ −')).to_be_disabled()
        await page.locator('#map-session').select_option(FIXTURE['nextSessionId'])
        await page.get_by_role('button',name='ดูตำแหน่ง',exact=True).click()
        await page.wait_for_url('**session='+FIXTURE['nextSessionId'])
        await expect(page.locator('[data-map-stall][aria-pressed=true]')).to_have_count(0)
        await expect(panel).to_be_hidden()
        await passed('Keyboard stall selection preserves focus/panel and session switch clears selection')

        touch=await context(browser,viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        tp=await touch.new_page();await go(tp,'/')
        card=tp.locator('.product-card').first;await card.hover()
        assert await card.evaluate('(el)=>getComputedStyle(el).transform')=='none'
        await go(tp,f'/markets/{FIXTURE["marketSlug"]}/map')
        await tp.locator('[data-map-stall]').filter(has_text='A99').tap()
        await expect(tp.locator('.location-panel')).to_contain_text('A99')
        await passed('Touch cards have no sticky hover transform; map tap remains functional')
        await touch.close()

        reduced=await context(browser,viewport={'width':390,'height':844},reduced_motion='reduce')
        rp=await reduced.new_page();await go(rp,'/')
        assert await rp.locator('.hero-copy').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
        await go(rp,f'/markets/{FIXTURE["marketSlug"]}/map')
        disabled=rp.get_by_role('button',name='ย่อ −')
        await disabled.evaluate('(el)=>el.style.pointerEvents="auto"')
        await disabled.hover();await rp.mouse.down()
        assert await disabled.evaluate('(el)=>getComputedStyle(el).transform')=='none'
        await rp.mouse.up()
        await rp.get_by_role('button',name='ขยาย +').click()
        assert await rp.locator('[data-map-canvas]').evaluate('(el)=>getComputedStyle(el).transitionDuration')=='0s'
        await rp.locator('.stall-list-item').filter(has_text='A98').click()
        await expect(rp.locator('.location-panel')).to_contain_text('A98')
        assert await rp.locator('.stall-details').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
        await passed('Reduced motion removes entrance/slide/spin transitions but preserves zoom/selection')
        await reduced.close()

        merchant=await context(browser,1,viewport={'width':1440,'height':1000})
        mp=await merchant.new_page();await go(mp,'/merchant/products/new')
        await mp.get_by_label('ชื่อสินค้า',exact=False).fill(FIXTURE['tag']+' motion tea')
        await mp.get_by_label('ราคาปกติ (บาท)',exact=False).fill('20')
        # Controlled failure is locally intercepted. No row/object is created for this failure.
        async def fail(route):
            await route.fulfill(status=503,json={'error':{'message':'ทดสอบเครือข่ายขัดข้อง'}})
        await mp.route('**/api/uploads',fail)
        file=mp.locator('input[type=file]');save=mp.get_by_role('button',name='เผยแพร่สินค้า',exact=True)
        await file.set_input_files(str(ROOT/'public/images/tea.jpg'))
        await expect(mp.locator('[data-upload-state=error]')).to_be_visible()
        await expect(mp.locator('.form-error[role=alert]')).to_contain_text('ทดสอบเครือข่ายขัดข้อง')
        await expect(mp.locator('.upload-preview')).to_have_count(0)
        await mp.screenshot(path=str(OUT/'upload-failed-1440.png'),full_page=True)
        await mp.unroute('**/api/uploads',fail)
        uploadgate,uploadseen,uploadhandler=await hold_requests(mp,'**/api/uploads')
        finalgate,finalseen,finalhandler=await hold_requests(mp,'**/api/uploads/*/finalize')
        await file.set_input_files(str(ROOT/'public/images/tea.jpg'))
        await asyncio.wait_for(uploadseen.wait(),10)
        await expect(mp.locator('[data-upload-state=uploading]')).to_be_visible()
        await expect(save).to_be_disabled();await expect(file).to_be_disabled()
        await expect(mp.locator('.upload-preview')).to_have_count(0)
        uploadgate.set();await asyncio.wait_for(finalseen.wait(),15)
        await expect(mp.locator('[data-upload-state=verifying]')).to_be_visible()
        await expect(save).to_be_disabled()
        await expect(mp.locator('.upload-preview')).to_have_count(0)
        await mp.screenshot(path=str(OUT/'upload-verifying-1440.png'),full_page=True)
        finalgate.set()
        await expect(mp.locator('[data-upload-state=complete]')).to_be_visible(timeout=30000)
        await expect(mp.locator('.upload-preview img')).to_be_visible()
        await expect(save).to_be_enabled()
        await mp.screenshot(path=str(OUT/'upload-approved-1440.png'),full_page=True)
        await mp.unroute('**/api/uploads',uploadhandler);await mp.unroute('**/api/uploads/*/finalize',finalhandler)
        savegate,saveseen,savehandler=await hold_requests(mp,'**/api/products')
        requests=[]
        mp.on('request',lambda r:requests.append(r.url) if r.method=='POST' and r.url==BASE+'/api/products' else None)
        ready_save=await save.bounding_box()
        await save.click();await asyncio.wait_for(saveseen.wait(),10)
        await expect(save).to_be_disabled();await expect(save).to_have_attribute('aria-busy','true')
        busy_save=await save.bounding_box()
        assert abs(ready_save['width']-busy_save['width'])<1
        await expect(mp.locator('.form-success')).to_have_count(0)
        await save.evaluate('(el)=>{el.click();el.click()}')
        assert len(requests)==1
        savegate.set();await mp.wait_for_url('**/merchant/products')
        await expect(mp.locator('tbody')).to_contain_text(FIXTURE['tag']+' motion tea')
        await mp.unroute('**/api/products',savehandler)
        await passed('Upload failure/same-file retry, real PUT/finalize phases, blocked save and single confirmed publication')

        stores=await api(merchant,'GET','/api/stores')
        store=next(s for s in stores if s['name'].startswith(FIXTURE['tag']))
        await api(merchant,'PATCH','/api/stores/'+store['id'],{'kind':'BOTH','address':'ข้อมูลทดสอบ ไม่ใช่สถานที่จริง','open':False})
        await go(mp,'/merchant')
        status=mp.locator('.status-inline');await expect(status).to_contain_text('ร้านประจำปิดอยู่')
        gate,seen,handler=await hold_requests(mp,'**/api/stores/'+store['id'])
        openbtn=mp.get_by_role('button',name='ยืนยันเปิดร้านประจำ',exact=True)
        open_ready=await openbtn.bounding_box()
        await openbtn.click();await asyncio.wait_for(seen.wait(),10)
        await expect(openbtn).to_be_disabled();await expect(status).to_contain_text('ร้านประจำปิดอยู่')
        assert abs(open_ready['width']-(await openbtn.bounding_box())['width'])<1
        await expect(mp.locator('.form-success')).to_have_count(0)
        gate.set();await expect(status).to_contain_text('ร้านประจำเปิดอยู่')
        await expect(mp.locator('.form-success')).to_contain_text('บันทึกเรียบร้อยแล้ว')
        await mp.unroute('**/api/stores/'+store['id'],handler)
        # A failed real UI action must keep the last backend-confirmed status.
        await mp.route('**/api/stores/'+store['id'],fail)
        await mp.get_by_role('button',name='ปิดร้านประจำ',exact=True).click()
        await expect(mp.locator('.form-error[role=alert]')).to_contain_text('ทดสอบเครือข่ายขัดข้อง')
        await expect(status).to_contain_text('ร้านประจำเปิดอยู่')
        await expect(mp.locator('.form-success')).to_have_count(0)
        await passed('Store status waits for backend confirmation; failed write preserves last true state')

        nojs=await context(browser,java_script_enabled=False,viewport={'width':390,'height':844})
        nj=await nojs.new_page();await go(nj,'/markets?type=SMALL')
        assert await nj.locator('h1').count()==1 and await nj.locator('.market-card').count()>0
        await passed('Server response contains market content; existing streamed reveal requires JavaScript')
        assert not ERRORS, ERRORS
        await passed('No browser page errors across motion checks')
        await browser.close()
    (OUT/'results.json').write_text(json.dumps({'completed':True,'passed':RESULTS,'browser_errors':ERRORS},ensure_ascii=False,indent=2))

asyncio.run(main())
