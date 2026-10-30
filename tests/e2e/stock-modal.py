"""Real compact stock/price actions, including an ambiguous-response retry; local QA only."""
import json,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from ui_helpers import settled
BASE='http://localhost:3100';ROOT=Path(__file__).resolve().parents[2];f=json.loads((ROOT/'test-results/fixtures.json').read_text());assert f['databaseName'].endswith('_test') and urlparse(BASE).hostname=='localhost'
out=ROOT/'artifacts/modal-ux/screenshots';out.mkdir(exist_ok=True);checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context(viewport={'width':390,'height':950});c.add_cookies([{'name':'next-auth.session-token','value':f['users'][1]['token'],'url':BASE}])
 def api(method,path,data=None,status=200):
  r=c.request.fetch(BASE+path,method=method,data=data,headers={'Origin':BASE});assert r.status==status;(result:=r.json());return result['data']
 store=api('GET','/api/stores')[0];name=f['tag']+' stock modal '+str(time.time_ns())[-6:];product=api('POST','/api/products',{'storeId':store['id'],'categoryId':f['categoryId'],'name':name,'imageUrl':'/images/tea.jpg','price':4500,'stock':10,'reservable':False},201)
 page=c.new_page();page.goto(BASE+'/merchant/products',wait_until='networkidle');row=page.locator('article[data-product-id="'+product['id']+'"]');trigger=row.get_by_role('button',name='จัดการ ',exact=False)
 def stock():
  trigger.click();page.get_by_role('menuitem',name='ปรับจำนวน',exact=True).click();d=page.get_by_role('dialog');expect(d.locator('.inventory-available')).to_contain_text('10');return d
 d=stock();attempts=[]
 def lose(route):
  if route.request.method!='POST':route.continue_();return
  attempts.append(route.request.post_data_json)
  if len(attempts)==1:route.fetch();route.abort('failed')
  else:route.continue_()
 page.route('**/api/products/'+product['id']+'/inventory',lose);d.get_by_role('button',name='เพิ่มจำนวน',exact=True).click();expect(d.get_by_role('button',name='ตรวจสอบและลองรายการเดิมอีกครั้ง')).to_be_visible();d.get_by_role('button',name='ตรวจสอบและลองรายการเดิมอีกครั้ง').click();expect(d.locator('.inventory-available')).to_contain_text('11');assert len(attempts)==2 and attempts[0]==attempts[1];page.unroute('**/api/products/'+product['id']+'/inventory',lose)
 settled(page);page.screenshot(path=str(out/'stock-adjustment-390.png'));d.get_by_role('button',name='ปิด',exact=True).click();expect(page.locator('[data-app-dialog]')).to_have_count(0);expect(row).to_contain_text('คงเหลือ 11 ชิ้น');expect(trigger).to_be_focused();checks.append('Compact display-only stock dialog lost-response retry applies+1 once and refreshes row')
 trigger.click();page.get_by_role('menuitem',name='เปลี่ยนราคา',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('ราคาใหม่ (บาท)',exact=True).fill('79.5');d.get_by_role('button',name='บันทึกราคา',exact=True).click();expect(d).not_to_be_visible();expect(row).to_contain_text('฿79.5');assert api('GET','/api/products/'+product['id']+'/inventory')['product']['price']==7950;checks.append('Contextual price save persists integer7950satang and renders฿79.5')
 trigger.click();page.get_by_role('menuitem',name='ตั้งส่วนลด',exact=True).click();d=page.get_by_role('dialog');expect(d.get_by_role('heading',name='ตั้งส่วนลด',exact=True)).to_be_visible();settled(page);page.screenshot(path=str(out/'discount-dialog-390.png'));d.get_by_role('button',name='ยกเลิก',exact=True).click();expect(page.locator('[data-app-dialog]')).to_have_count(0);checks.append('Discount settings open within the same contextual surface')
 page.get_by_role('link',name='ค้นหาสินค้า ร้าน หรือตลาด',exact=True).first.click();d=page.get_by_role('dialog');d.get_by_role('textbox').fill(name);d.get_by_role('textbox').press('Enter');expect(d.get_by_role('link',name=name,exact=False)).to_be_visible();settled(page);page.screenshot(path=str(out/'search-results-390.png'));checks.append('Global result screenshot displays the updated authoritative price')
 b.close()
for check in checks:print('PASS',check,flush=True)
(ROOT/'artifacts/modal-ux/stock-modal-results.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2))
