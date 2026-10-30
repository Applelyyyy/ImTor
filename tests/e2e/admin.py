import json
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2]; f=json.loads((root/'test-results/fixtures.json').read_text());base='http://localhost:3100'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 c=b.new_context();c.add_cookies([{'name':'next-auth.session-token','value':f['users'][0]['token'],'url':base}]);page=c.new_page()
 mid=f['extraMarketId']
 page.goto(base+f'/admin/markets/{mid}/layout');page.wait_for_load_state('networkidle')
 page.get_by_label('ชื่อโซน เช่น A หรือ B',exact=False).fill('Z'+uuid4().hex[:5])
 page.get_by_role('button',name='เพิ่มโซน',exact=True).click()
 expect(page.locator('select[name=zoneId]')).to_be_visible()
 page.get_by_label('รหัสล็อก',exact=False).fill('Z42')
 page.get_by_label('ตำแหน่งแนวนอน X (0–1)',exact=False).fill('0.37')
 page.get_by_label('ตำแหน่งแนวตั้ง Y (0–1)',exact=False).fill('0.62')
 page.get_by_role('button',name='บันทึกล็อกและตำแหน่ง').click()
 expect(page.locator('#edit-stall')).to_contain_text('Z42')
 response=c.request.get(base+'/api/admin/markets');row=next(m for m in response.json()['data'] if m['id']==mid);stall=next(s for s in row['stalls'] if s['code']=='Z42');assert stall['x']==.37 and stall['y']==.62
 print('PASS Admin layout UI saves normalized fractional coordinates')
 page.goto(base+f'/admin/markets/{mid}/schedule');page.wait_for_load_state('networkidle')
 page.get_by_label('วันเปิด',exact=False).select_option('3')
 page.locator('input[name=opens]').first.fill('16:00')
 page.get_by_label('เวลาปิด (ข้ามเที่ยงคืนได้)',exact=False).fill('21:00')
 page.get_by_role('button',name='บันทึกกฎวันเปิด').click()
 expect(page.get_by_role('status').first).to_contain_text('บันทึก')
 response=c.request.get(base+'/api/admin/markets');row=next(m for m in response.json()['data'] if m['id']==mid);assert any(r['weekday']==3 and r['opens']=='16:00' for r in row['rules'])
 print('PASS Admin schedule editor UI saves calendar rule')
 c.request.put(base+'/api/admin/settings',data={'key':'announcement','value':'ประกาศทดสอบที่ลบหลังตรวจสอบ'},headers={'Origin':base})
 page.goto(base);page.wait_for_load_state('networkidle');expect(page.get_by_text('ประกาศทดสอบที่ลบหลังตรวจสอบ',exact=True)).to_be_visible()
 c.request.put(base+'/api/admin/settings',data={'key':'announcement','value':''},headers={'Origin':base})
 print('PASS Safe public announcement setting, then restored empty')
 b.close()
