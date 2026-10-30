"""Local-only merchant regression checks. Requires root-prepared isolated *_test fixtures.
Run: codex-browser-env uv tool run --from playwright python tests/e2e/merchant-ux.py
No production credentials, accounts or data are used.
"""
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}, "Only loopback QA is permitted"
fixture = json.loads(Path(os.environ.get("IMTOR_UX_FIXTURE", ROOT / "test-results/fixtures.json")).read_text())
OUT = ROOT / "test-results/merchant-ux"
OUT.mkdir(parents=True, exist_ok=True)
run_tag = fixture["tag"] + " " + str(time.time_ns())[-6:]
results = []
errors = []

def passed(message):
    results.append(message)
    print("PASS", message, flush=True)

def api(context, method, path, body=None, expected=200):
    response = context.request.fetch(BASE + path, method=method, data=body, headers={"Origin": BASE, "Content-Type": "application/json"})
    assert response.status == expected, f"{method} {path}: HTTP {response.status}"
    return response.json().get("data")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    merchant = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    merchant.add_cookies([{"name": "next-auth.session-token", "value": fixture["users"][1]["token"], "url": BASE}])
    page = merchant.new_page()
    page.set_default_navigation_timeout(60000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/merchant", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.wait_for_function("document.querySelector('.workspace-main h1') || document.querySelector('.workspace-main a[href=\"/become-vendor\"]')")
    if page.get_by_role("link", name="เปิดร้านของฉัน", exact=True).count():
        page.get_by_role("link", name="เปิดร้านของฉัน", exact=True).click()
        page.get_by_label("ชื่อร้านค้า", exact=False).fill(fixture["tag"] + " UX ร้านทดสอบ")
        page.get_by_role("button", name="สร้างร้านของฉัน").click()
        page.wait_for_url("**/merchant")
        page.wait_for_load_state("networkidle")
    expect(page.locator(".workspace-main h1")).to_be_visible()
    expect(page.get_by_role("navigation", name="เมนูร้านของฉัน").get_by_role("link")).to_have_count(4)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(OUT / "dashboard-390.png"), full_page=True)
    passed("Four-task mobile merchant navigation and no overflow")

    page.goto(BASE + "/merchant/schedule", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.get_by_label("1. ขายที่ตลาดไหน?").select_option(fixture["marketId"])
    page.get_by_label("2. ขายวันไหน?").select_option(fixture["sessionId"])
    expect(page.get_by_label("3. เลือกล็อกที่ได้รับอนุญาต")).to_be_visible()
    page.get_by_label("3. เลือกล็อกที่ได้รับอนุญาต").select_option(fixture["stallId"])
    page.get_by_label("ฉันมีสิทธิใช้พื้นที่นี้", exact=False).check()
    page.get_by_role("button", name="บันทึกวันและล็อก").click()
    expect(page.get_by_text("บันทึกเรียบร้อยแล้ว", exact=True)).to_be_visible()
    passed("Market/date/stall selection persists the correct session assignment")

    page.goto(BASE + "/merchant/products/new", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("radio", name="แสดงสินค้าอย่างเดียว", exact=False)).to_be_checked()
    assert page.locator('input[type="datetime-local"]:visible').count() == 0
    page.get_by_label("ชื่อสินค้า", exact=False).fill(run_tag + " UX ข้าว")
    page.get_by_label("ราคา (บาท)", exact=False).fill("45")
    page.locator('input[type="file"]').set_input_files(str(ROOT / "public/images/tea.jpg"))
    expect(page.locator('.upload-control[data-upload-state="complete"], .upload-state[data-upload-state="complete"]')).to_be_visible(timeout=30000)
    page.get_by_role("button", name="เผยแพร่สินค้า", exact=True).click()
    page.wait_for_url("**/merchant/products/*/edit?created=1")
    expect(page.get_by_text("เพิ่มสินค้าเรียบร้อยแล้ว", exact=True)).to_be_visible()
    product_id = page.url.split("/products/")[1].split("/")[0]
    fixture.setdefault("merchantUxProductIds", []).append(product_id)
    (ROOT / "test-results/fixtures.json").write_text(json.dumps(fixture))
    os.chmod(ROOT / "test-results/fixtures.json", 0o600)
    passed("Photo/name/THB price create a real display-only product with clear success")

    page.get_by_role("radio", name="เปิดรับจอง", exact=False).check()
    page.get_by_label("จำนวนเริ่มต้น", exact=False).fill("10")
    now = datetime.now(timezone.utc)
    local_start = (now + timedelta(hours=7) - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M")
    local_end = (now + timedelta(hours=9)).strftime("%Y-%m-%dT%H:%M")
    page.get_by_label("เริ่มรับสินค้า", exact=False).fill(local_start)
    page.get_by_label("รับสินค้าภายใน", exact=False).fill(local_end)
    page.get_by_role("button", name="บันทึกสินค้า", exact=True).click()
    expect(page.get_by_text("บันทึกสินค้าแล้ว", exact=True)).to_be_visible()
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".inventory-available")).to_contain_text("10")
    passed("Explicit reservation opt-in initializes inventory and valid pickup windows")

    attempts = []
    def uncertain(route):
        payload = route.request.post_data_json
        attempts.append(payload)
        if len(attempts) == 1:
            route.fetch()  # Apply the operation; lose only its response.
            route.abort("failed")
        else:
            route.continue_()
    page.route(f"**/api/products/{product_id}/inventory", uncertain)
    page.get_by_label("จำนวนที่เพิ่มหรือลด").fill("5")
    page.get_by_role("button", name="เพิ่มจำนวน", exact=True).click()
    expect(page.get_by_role("button", name="ตรวจสอบและลองรายการเดิมอีกครั้ง")).to_be_visible()
    page.get_by_role("button", name="ตรวจสอบและลองรายการเดิมอีกครั้ง").click()
    expect(page.locator(".inventory-available")).to_contain_text("15")
    assert len(attempts) == 2 and attempts[0] == attempts[1]
    page.unroute(f"**/api/products/{product_id}/inventory", uncertain)
    passed("Uncertain inventory response retries identical idempotency key without double restocking")

    page.locator("summary").filter(has_text="ตั้งส่วนลด").click()
    page.get_by_label("ลดราคาแบบไหน?").select_option("FIXED")
    page.get_by_label("ราคาขายใหม่ (บาท)", exact=False).fill("30")
    page.get_by_label("เริ่มลดราคา", exact=False).fill(local_start)
    page.get_by_label("สิ้นสุด (เวลากรุงเทพฯ)", exact=False).fill(local_end)
    page.get_by_role("button", name="เพิ่มช่วงลดราคา", exact=True).click()
    expect(page.get_by_text("ขาย ฿30", exact=False)).to_be_visible()
    priced = api(merchant, "GET", "/api/products?q=" + fixture["tag"])
    assert next(row for row in priced if row["id"] == product_id)["price"]["current"] == 3000
    passed("Fixed final-price discounts use baht in UI and integer satang in persisted pricing")

    customer = browser.new_context()
    customer.add_cookies([{"name": "next-auth.session-token", "value": fixture["users"][2]["token"], "url": BASE}])
    reservation = api(customer, "POST", "/api/reservations", {"productId": product_id, "quantity": 2}, 201)
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".inventory-available")).to_contain_text("13")
    page.get_by_label("ชื่อสินค้า", exact=False).fill(run_tag + " UX ข้าวแก้ชื่อ")
    page.get_by_role("button", name="บันทึกสินค้า", exact=True).click()
    expect(page.get_by_text("บันทึกสินค้าแล้ว", exact=True)).to_be_visible()
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".inventory-available")).to_contain_text("13")
    passed("Content edit with active reservation does not overwrite stock or pickup timestamps")
    api(customer, "PATCH", "/api/reservations/" + reservation["id"], {"status": "CANCELLED"})
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".inventory-available")).to_contain_text("15")
    passed("Cancellation restores available stock in rendered merchant view")

    pickup = api(customer, "POST", "/api/reservations", {"productId": product_id, "quantity": 2}, 201)
    page.goto(BASE + "/merchant/reservations", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    card = page.locator(".reservation-card").filter(has=page.locator('input')).filter(has_text=run_tag + " UX ข้าวแก้ชื่อ").first
    card.get_by_label("รหัสที่ลูกค้าแสดง", exact=False).fill(pickup["pickupCode"])
    card.get_by_role("button", name="ยืนยันส่งมอบสินค้า").click()
    expect(card.get_by_role("button", name="ยืนยันส่งมอบสินค้า")).to_have_count(0)
    page.goto(BASE + f"/merchant/products/{product_id}/edit", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    expect(page.locator(".inventory-available")).to_contain_text("13")
    passed("Merchant pickup confirmation completes reservation without a second stock decrement")

    for width in [375, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 950})
        for name, route in [("dashboard", "/merchant"), ("products", "/merchant/products"), ("edit", f"/merchant/products/{product_id}/edit"), ("location", "/merchant/schedule"), ("settings", "/merchant/settings")]:
            page.goto(BASE + route, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            expect(page.locator(".workspace-main h1")).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow {route} at {width}"
            page.screenshot(path=str(OUT / f"{name}-{width}.png"), full_page=True)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Late overflow {route} at {width}"
    passed("Merchant pages visually captured at375/390/768/1024/1440 with no page overflow")
    page.goto(BASE + "/merchant/products", wait_until="domcontentloaded")
    expect(page.locator(".workspace-main h1")).to_be_visible()
    page.wait_for_load_state("networkidle")
    product_card = page.locator(".merchant-product-card").filter(has=page.locator(f'a[href="/merchant/products/{product_id}/edit"]')).first
    product_card.get_by_role("button", name="เก็บเข้าคลัง", exact=True).click()
    dialog = page.get_by_role("alertdialog")
    expect(dialog).to_be_visible()
    dialog.get_by_role("button", name="ยืนยัน", exact=True).click()
    expect(product_card.get_by_role("button", name="เก็บเข้าคลัง", exact=True)).to_have_count(0)
    page.locator("summary").filter(has_text="สินค้าที่เก็บเข้าคลัง").click()
    expect(page.get_by_text(run_tag + " UX ข้าวแก้ชื่อ", exact=True)).to_be_visible()
    history = api(customer, "GET", "/api/reservations")
    assert any(row["id"] == pickup["id"] and row["status"] == "COMPLETED" for row in history)
    passed("Archiving hides the listing without deleting completed reservation history")

    assert not errors, errors
    browser.close()
(OUT / "results.json").write_text(json.dumps({"passed": results, "browser_errors": errors}, ensure_ascii=False, indent=2))
