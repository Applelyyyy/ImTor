"""Modal-first merchant flows against isolated loopback *_test fixtures only.
Run with root's fixture server via IMTOR_TEST_BASE_URL and IMTOR_UX_FIXTURE.
"""
import json
import os
import time
from pathlib import Path
from ui_helpers import settled
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
expect.set_options(timeout=15000)

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}
fixture = json.loads(Path(os.environ.get("IMTOR_UX_FIXTURE", ROOT / "test-results/fixtures.json")).read_text())
OUT = ROOT / "test-results/merchant-modal"
OUT.mkdir(parents=True, exist_ok=True)
name = fixture["tag"] + " modal " + str(time.time_ns())[-8:]
results = []
errors = []

def passed(message):
    results.append(message)
    print("PASS", message, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.add_cookies([{"name": "next-auth.session-token", "value": fixture["users"][1]["token"], "url": BASE}])
    page = context.new_page()
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/merchant", wait_until="networkidle")
    if page.get_by_role("link", name="เปิดร้านของฉัน", exact=True).count():
        page.get_by_role("link", name="เปิดร้านของฉัน", exact=True).click()
        page.get_by_label("ชื่อร้านค้า", exact=False).fill(fixture["tag"] + " modal ร้านทดสอบ")
        page.get_by_role("button", name="สร้างร้านของฉัน", exact=True).click()
        page.wait_for_url("**/merchant")
        page.wait_for_load_state("networkidle")
    page.goto(BASE + "/merchant/schedule", wait_until="networkidle")
    page.get_by_role("button", name="เลือกตลาดและล็อก", exact=True).click()
    picker = page.get_by_role("dialog")
    picker.get_by_role("radio", name="ตลาดเล็กทดสอบ", exact=True).check()
    picker.locator('[data-map-stall]').filter(has_text="A99").click()
    picker.get_by_role("checkbox", name="ฉันยืนยันว่ามีสิทธิ์ใช้ล็อกนี้", exact=True).check()
    picker.get_by_role("button", name="ยืนยันล็อก A99", exact=True).click()
    expect(picker).not_to_be_visible()
    expect(page.get_by_text("บันทึกตำแหน่งเรียบร้อย", exact=True)).to_be_visible()
    passed("Merchant authorized attendance persists through the UI")
    page.goto(BASE + "/merchant/products", wait_until="networkidle")
    page.get_by_role("button", name="+ เพิ่มสินค้า", exact=True).click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_role("heading", name="เพิ่มสินค้า", exact=True)).to_be_visible()
    assert page.locator('input[type="datetime-local"]:visible').count() == 0
    dialog.get_by_label("ชื่อสินค้า", exact=False).fill(name)
    dialog.get_by_label("ราคา (บาท)", exact=False).fill("9999")
    dialog.locator('input[type="file"]').set_input_files(str(ROOT / "public/images/tea.jpg"))
    expect(dialog.locator('.upload-control[data-upload-state="complete"], .upload-state[data-upload-state="complete"]')).to_be_visible()
    dialog.get_by_role("switch", name="ติดตามจำนวนสินค้า", exact=True).check()
    dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False).fill("100")
    dialog.get_by_role("button", name="เพิ่มสินค้า", exact=True).click()
    expect(dialog).not_to_be_visible()
    row = page.locator("article[data-product-id]").filter(has_text=name)
    expect(row).to_contain_text("คงเหลือ 100 ชิ้น")
    expect(row).to_contain_text("฿9,999")
    product_id = row.get_attribute("data-product-id")
    assert product_id
    passed("Create tracked display-only product in place; authoritative 100 and ฿9,999")

    row.get_by_role("button", name="แก้ไข", exact=True).click()
    expect(dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False)).to_have_value("100")
    dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False).fill("50")
    dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง").click()
    expect(dialog).not_to_be_visible()
    expect(row).to_contain_text("คงเหลือ 50 ชิ้น")
    page.reload(wait_until="networkidle")
    expect(row).to_contain_text("คงเหลือ 50 ชิ้น")
    row.get_by_role("button", name="แก้ไข", exact=True).click()
    expect(dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False)).to_have_value("50")
    passed("Edit 100 → 50 persists after refresh and reopening")

    dialog.get_by_label("ชื่อสินค้า", exact=False).fill(name + " unsaved")
    dialog.get_by_role("button", name="ยกเลิก", exact=True).click()
    expect(dialog.get_by_role("heading", name="ละทิ้งการเปลี่ยนแปลง?")).to_be_visible()
    dialog.get_by_role("button", name="แก้ไขต่อ", exact=True).click()
    expect(dialog.get_by_label("ชื่อสินค้า", exact=False)).to_have_value(name + " unsaved")
    page.keyboard.press("Escape")
    dialog.get_by_role("button", name="ละทิ้งการเปลี่ยนแปลง", exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(row.get_by_role("button", name="แก้ไข", exact=True)).to_be_focused()
    expect(row).to_contain_text(name)
    passed("Cancel and ESC protect dirty draft; discard restores focus")

    attempts = []
    def lose_stock_response(route):
        if route.request.method != "PATCH":
            route.continue_()
            return
        payload = route.request.post_data_json
        attempts.append(payload)
        if len(attempts) == 1:
            route.fetch()
            route.abort("failed")
        else:
            route.continue_()
    page.route(f"**/api/products/{product_id}", lose_stock_response)
    row.get_by_role("button", name="แก้ไข", exact=True).click()
    dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False).fill("40")
    dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง").click()
    expect(dialog.get_by_role("button", name="ตรวจสอบและลองรายการเดิม", exact=True)).to_be_visible()
    expect(dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False)).to_be_disabled()
    dialog.get_by_role("button", name="ตรวจสอบและลองรายการเดิม", exact=True).click()
    expect(dialog).not_to_be_visible()
    assert len(attempts) == 2 and attempts[0] == attempts[1]
    assert attempts[0]["expectedStock"] == 50 and attempts[0]["stock"] == 40
    assert attempts[0]["stockAdjustmentKey"]
    expect(row).to_contain_text("คงเหลือ 40 ชิ้น")
    page.unroute(f"**/api/products/{product_id}", lose_stock_response)
    passed("Lost stock PATCH response replays exact payload/key without double adjustment")

    row.get_by_role("button", name="แก้ไข", exact=True).click()
    dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False).fill("0")
    dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง").click()
    expect(dialog).not_to_be_visible()
    expect(row).to_contain_text("สินค้าหมด")
    row.get_by_role("button", name="แก้ไข", exact=True).click()
    expect(dialog.get_by_label("จำนวนสินค้าคงเหลือ", exact=False)).to_have_value("0")
    dialog.get_by_role("switch", name="ติดตามจำนวนสินค้า", exact=True).uncheck()
    dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง").click()
    expect(dialog).not_to_be_visible()
    expect(row).to_contain_text("ไม่ติดตามจำนวน")
    passed("Tracked zero is sold-out; explicit tracking-off is a separate state")

    before = row.bounding_box()
    row.get_by_role("button", name="จัดการ " + name, exact=True).click()
    page.get_by_role("menuitem", name="ซ่อนสินค้า", exact=True).click()
    expect(row.get_by_text("พักขาย", exact=True)).to_be_visible()
    expect(page.locator("[data-sonner-toast]").filter(has_text="ซ่อนสินค้าเรียบร้อย")).to_be_visible()
    after = row.bounding_box()
    assert abs(before["height"] - after["height"]) < 1
    assert row.locator('.form-success,[role="status"]').count() == 0
    passed("Backend-confirmed publication toast leaves row geometry unchanged")

    for width in [360, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width":width,"height":900})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        row.get_by_role("button", name="แก้ไข", exact=True).click()
        expect(dialog.get_by_label("ชื่อสินค้า", exact=False)).to_be_visible()
        box = dialog.bounding_box()
        assert box["x"] >= 0 and box["x"] + box["width"] <= width + 1
        assert box["height"] <= 901
        dialog.get_by_role("button", name="ยกเลิก", exact=True).click()
        settled(page);page.screenshot(path=str(OUT / f"products-{width}.png"),full_page=True)
    passed("Five responsive widths: reachable modal and stable rows without horizontal overflow")
    for zoom in [1, 1.1, 1.25]:
        page.set_viewport_size({"width":1440,"height":1000})
        page.evaluate("(zoom) => { document.documentElement.style.zoom = zoom; }", zoom)
        row.get_by_role("button", name="แก้ไข", exact=True).click()
        dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง").scroll_into_view_if_needed()
        expect(dialog.get_by_role("button", name="บันทึกการเปลี่ยนแปลง")).to_be_in_viewport()
        settled(page);page.screenshot(path=str(OUT / f"edit-zoom-{zoom}.png"))
        dialog.get_by_role("button", name="ยกเลิก", exact=True).click()
    page.evaluate("document.documentElement.style.zoom = 1")
    passed("Desktop 100/110/125 percent zoom keeps save actions accessible")

    row.get_by_role("button", name="จัดการ " + name, exact=True).click()
    page.get_by_role("menuitem", name="ลบสินค้า / เก็บเข้าคลัง", exact=True).click()
    expect(dialog.get_by_role("heading",name="เก็บสินค้าเข้าคลัง?")).to_be_visible()
    dialog.get_by_role("button", name="ยืนยันเก็บเข้าคลัง",exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(page.get_by_text("สินค้าที่เก็บเข้าคลัง",exact=False)).to_be_visible()
    passed("Archive action requires confirmation and preserves product history")
    assert not errors, errors
    (OUT / "results.json").write_text(json.dumps({"passed":results,"pageErrors":errors,"productId":product_id},ensure_ascii=False,indent=2))
    browser.close()
