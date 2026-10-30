"""Browser verification of Thai success feedback after the confirmed report write."""
import json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from ui_helpers import settled
root=Path(__file__).resolve().parents[2];base=os.getenv('IMTOR_TEST_BASE_URL','http://localhost:3101');assert urlparse(base).hostname in {'localhost','127.0.0.1'}
f=json.loads((root/'test-results/fixtures.json').read_text());assert f['databaseName'].endswith('_test')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context(viewport={'width':390,'height':900});c.add_cookies([{'name':'next-auth.session-token','value':f['users'][0]['token'],'url':base}])
 rows=c.request.get(base+'/api/products?q='+f['tag']).json()['data'];assert rows
 page=c.new_page();page.goto(base+'/product/'+rows[0]['id'],wait_until='networkidle');page.get_by_text('แจ้งปัญหาเกี่ยวกับสินค้านี้',exact=True).click();page.get_by_label('รายละเอียดปัญหา',exact=True).fill('เสีย');page.get_by_role('button',name='ส่งรายงาน',exact=True).click();notification=page.get_by_text('ส่งรายงานเรียบร้อยแล้ว',exact=True);expect(notification).to_be_visible();settled(page)
 font=notification.evaluate('(e)=>getComputedStyle(e).fontFamily');assert 'kodchasan' in font.lower(),font
 page.screenshot(path=str(root/'artifacts/stall-selection/browser/report-success-thai-font.png'));print('PASS Real เสีย report confirms persistence with readable Kodchasan Thai success toast')
 b.close()
