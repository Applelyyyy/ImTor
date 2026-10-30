"""Real loopback-only admin/editor regression checks. Uses isolated *_test QA fixtures.
Run: codex-browser-env uv tool run --from playwright python tests/e2e/admin-ux.py
Creates only uniquely named owned resources and deletes only those resources.
"""
import json
import os
import re
import time
from pathlib import Path
from ui_helpers import settled
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}
fixture = json.loads((ROOT / "test-results/fixtures.json").read_text())
OUT = ROOT / "test-results/admin-ux"
OUT.mkdir(parents=True, exist_ok=True)
tag = f"admin-ux-{time.time_ns()}"
owned = []
results = []
errors = []
manifest = {"tag": tag, "marketIds": owned, "mediaUrls": []}
def record():
    path = OUT / "owned.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)); os.chmod(path, 0o600)
def passed(text):
    results.append(text); print("PASS", text, flush=True)
def api(context, method, path, body=None, expected=200):
    try:
        response = context.request.fetch(BASE + path, method=method, data=body, headers={"Origin": BASE, "Content-Type": "application/json"}, max_retries=2 if method == "GET" else 0)
    except Exception as error:
        raise AssertionError(f"{method} {path}: request failed ({type(error).__name__})") from None
    assert response.status == expected, f"{method} {path}: HTTP {response.status}"
    return response.json().get("data")
def market(context, id):
    return next(row for row in api(context, "GET", "/api/admin/markets") if row["id"] == id)
def goto(page, path):
    page.goto(BASE + path, wait_until="domcontentloaded"); page.wait_for_load_state("networkidle")
    expect(page.locator(".workspace-main h1")).to_be_visible(timeout=20000)
    page.evaluate("document.fonts.ready")
def dialog(page): return page.get_by_role("dialog")
def cleanup(context):
    for id in list(owned):
        rows = api(context, "GET", "/api/admin/markets")
        rows = [row for row in rows if row["id"] == id]
        if not rows: continue
        row = rows[0]
        assert row["name"].startswith(tag), "Never delete unowned QA resources"
        for stall in row.get("stalls", []): api(context, "DELETE", f'/api/admin/stalls/{stall["id"]}', {"confirmName": stall["code"]})
        for zone in row.get("zones", []): api(context, "DELETE", f'/api/admin/zones/{zone["id"]}', {"confirmName": zone["name"]})
        api(context, "DELETE", f"/api/admin/markets/{id}", {"confirmName": row["name"]})
    manifest["resourcesCleaned"] = True; record()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    admin = browser.new_context(viewport={"width": 1440, "height": 1000})
    admin.add_cookies([{"name": "next-auth.session-token", "value": fixture["users"][0]["token"], "url": BASE}])
    page = admin.new_page(); page.set_default_navigation_timeout(120000); page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        goto(page, "/admin/markets")
        create_trigger = page.get_by_role("button", name="เพิ่มตลาด", exact=True)
        create_trigger.click()
        expect(dialog(page).get_by_role("heading", name="เพิ่มตลาด", exact=True)).to_be_visible()
        expect(dialog(page).get_by_label("ชื่อตลาด", exact=False)).to_be_focused()
        dialog(page).get_by_label("ชื่อตลาด", exact=False).fill(tag + " empty")
        page.keyboard.press("Escape")
        expect(dialog(page).get_by_role("heading", name="ละทิ้งการเปลี่ยนแปลง?", exact=True)).to_be_visible()
        dialog(page).get_by_role("button", name="แก้ไขต่อ", exact=True).click()
        expect(dialog(page).get_by_label("ชื่อตลาด", exact=False)).to_have_value(tag + " empty")
        dialog(page).get_by_label(re.compile("^ประเภท")).select_option("SMALL")
        settled(page);page.screenshot(path=str(OUT / "create-market-dialog.png"), full_page=True)
        dialog(page).get_by_role("button", name="สร้างตลาด", exact=True).click()
        expect(dialog(page)).to_have_count(0)
        expect(page).to_have_url(BASE + "/admin/markets")
        expect(create_trigger).to_be_focused()
        empty = next(row for row in api(admin, "GET", "/api/admin/markets") if row["name"] == tag + " empty")
        owned.append(empty["id"]); record()
        row = page.get_by_role("row").filter(has_text=tag + " empty")
        edit_trigger = row.get_by_role("button", name=re.compile("^แก้ไขตลาด"))
        edit_trigger.click()
        expect(dialog(page).get_by_label("ชื่อตลาด", exact=False)).to_have_value(tag + " empty")
        expect(dialog(page).get_by_label(re.compile("^ประเภท"))).to_have_value("SMALL")
        dialog(page).get_by_label("ชื่อตลาด", exact=False).fill(tag + " edited")
        dialog(page).get_by_label(re.compile("^ประเภท")).select_option("LARGE")
        dialog(page).get_by_role("button", name="บันทึกข้อมูลตลาด", exact=True).click()
        expect(dialog(page)).to_have_count(0)
        assert market(admin, empty["id"])["type"] == "LARGE"
        assert market(admin, empty["id"])["name"] == tag + " edited"
        expect(page).to_have_url(BASE + "/admin/markets")
        row = page.get_by_role("row").filter(has_text=tag + " edited")
        row.get_by_role("button", name=re.compile("^ลบตลาด")).click()
        expect(dialog(page).get_by_role("button", name="ยืนยันลบตลาดถาวร")).to_be_disabled()
        dialog(page).get_by_label(re.compile("^กรอก")).fill(tag + " edited")
        dialog(page).get_by_role("button", name="ยืนยันลบตลาดถาวร").click()
        expect(dialog(page)).to_have_count(0)
        assert not any(row["id"] == empty["id"] for row in api(admin, "GET", "/api/admin/markets"))
        passed("Contextual create/edit with dirty-close draft preservation, focus return and named-confirmation delete use persisted API data")

        main = api(admin, "POST", "/api/admin/markets", {"name": tag + " layout", "type": "SMALL"}, 201)
        owned.append(main["id"]); record()
        path = f'/admin/markets/{main["id"]}/layout'
        goto(page, path)
        zone_trigger = page.get_by_role("button", name="เพิ่มโซน", exact=True)
        zone_trigger.click(); expect(dialog(page).get_by_label("ชื่อโซน")).to_be_focused()
        page.keyboard.press("Escape"); expect(dialog(page)).to_have_count(0); expect(zone_trigger).to_be_focused()
        zone_trigger.click(); dialog(page).get_by_label("ชื่อโซน").fill("A")
        dialog(page).get_by_role("button", name="บันทึกโซน").click(); expect(dialog(page)).to_have_count(0)
        page.get_by_role("button", name="เพิ่มล็อก", exact=True).click()
        canvas = page.locator("[data-layout-canvas]")
        canvas.click(position={"x": 180, "y": 180})
        page.get_by_label("รหัสล็อก", exact=True).fill("A01")
        page.get_by_role("button", name="สร้างล็อกที่ตำแหน่งนี้").click()
        expect(page.get_by_role("status").filter(has_text="บันทึกข้อมูลล็อกแล้ว")).to_be_visible()
        first = market(admin, main["id"])["stalls"][0]
        marker = canvas.get_by_role("button", name=re.compile("^ล็อก A01"))
        page.get_by_label("จุดสังเกต", exact=True).fill("draft survives movement")
        marker.focus(); page.keyboard.press("ArrowRight")
        expect(page.get_by_label("จุดสังเกต", exact=True)).to_have_value("draft survives movement")
        page.get_by_role("button", name=re.compile("^บันทึกตำแหน่ง")).click()
        expect(page.get_by_role("status").filter(has_text="บันทึกตำแหน่ง 1 ล็อกแล้ว")).to_be_visible()
        updated = market(admin, main["id"])["stalls"][0]
        assert abs(updated["x"] - first["x"] - .01) < 1e-8
        page.get_by_role("button", name="บันทึกข้อมูลล็อก", exact=True).click()
        expect(page.get_by_role("status").filter(has_text="บันทึกข้อมูลล็อกแล้ว")).to_be_visible()
        page.reload(); page.wait_for_load_state("networkidle"); expect(page.locator(".workspace-main h1")).to_be_visible()
        canvas = page.locator("[data-layout-canvas]"); marker = canvas.get_by_role("button", name=re.compile("^ล็อก A01"))
        marker.click(); expect(page.get_by_label("จุดสังเกต", exact=True)).to_have_value("draft survives movement")
        passed("Zone/stall creation, keyboard positioning and metadata drafts persist without XY remount")

        unzoomed = canvas.bounding_box()
        page.get_by_role("button", name="ขยายผัง", exact=True).click()
        assert abs(canvas.bounding_box()["width"] / unzoomed["width"] - 1.25) < .01
        rect = canvas.bounding_box(); start = marker.bounding_box()
        page.mouse.move(start["x"] + start["width"] / 2, start["y"] + start["height"] / 2)
        page.mouse.down(); page.mouse.move(rect["x"] + rect["width"] * .45, rect["y"] + rect["height"] * .45, steps=8); page.mouse.up()
        assert page.get_by_role("button", name="ย้อนกลับ", exact=True).is_enabled()
        page.get_by_role("button", name="เพิ่มหลายล็อก", exact=True).click()
        dialog(page).get_by_label("ตัวอักษรนำหน้า").fill("B")
        dialog(page).get_by_label("จำนวนล็อก", exact=True).fill("3")
        dialog(page).get_by_role("button", name="สร้างชุดล็อก").click(); expect(dialog(page)).to_have_count(0)
        expect(canvas.get_by_role("button")).to_have_count(4)
        expect(page.get_by_role("button", name="ย้อนกลับ", exact=True)).to_be_disabled()
        passed("Persisted batch creation clears pre-batch undo history so saved stalls cannot disappear")
        page.get_by_role("button", name=re.compile("^บันทึกตำแหน่ง")).click()
        expect(page.get_by_role("status").filter(has_text="บันทึกตำแหน่ง 1 ล็อกแล้ว")).to_be_visible()
        dragged = next(row for row in market(admin, main["id"])["stalls"] if row["id"] == first["id"])
        assert abs(dragged["x"] - .45) < .02 and abs(dragged["y"] - .45) < .02
        page.reload(); page.wait_for_load_state("networkidle"); expect(page.locator(".workspace-main h1")).to_be_visible()
        canvas = page.locator("[data-layout-canvas]"); marker = canvas.get_by_role("button", name=re.compile("^ล็อก A01"))
        marker.focus(); page.keyboard.press("ArrowRight")
        api(admin, "POST", f'/api/admin/markets/{main["id"]}/layout', {"positions": [{"id": first["id"], "x": .7, "y": .7}]})
        page.get_by_role("button", name=re.compile("^บันทึกตำแหน่ง")).click()
        expect(page.get_by_role("alert").filter(has_text="ตำแหน่งถูกเปลี่ยน")).to_be_visible()
        assert next(row for row in market(admin, main["id"])["stalls"] if row["id"] == first["id"])["x"] == .7
        page.get_by_role("button", name="คืนค่า", exact=True).click(); dialog(page).get_by_role("button", name="ยืนยันคืนค่า").click()
        page.reload(); page.wait_for_load_state("networkidle"); expect(page.locator(".workspace-main h1")).to_be_visible()
        passed("Zoom-aware pointer drag persists and concurrent edits are rejected without overwrite")

        page.get_by_role("button", name="ภาพพื้นหลัง", exact=True).click()
        dialog(page).locator('input[type="file"]').set_input_files(str(ROOT / "public/images/tea.jpg"))
        expect(dialog(page).locator('[data-upload-state="complete"]')).to_be_visible(timeout=30000)
        dialog(page).get_by_role("button", name="บันทึกภาพพื้นหลัง", exact=True).click(); expect(dialog(page)).to_have_count(0)
        image = market(admin, main["id"])["layoutImage"]; assert image
        manifest["mediaUrls"].append(image); record()
        page.get_by_role("button", name="ภาพพื้นหลัง", exact=True).click()
        dialog(page).get_by_label("แสดงผังเปล่าเฉพาะหน้าจอนี้").check()
        page.keyboard.press("Escape"); expect(dialog(page)).to_have_count(0)
        assert market(admin, main["id"])["layoutImage"] == image
        page.get_by_role("button", name="ภาพพื้นหลัง", exact=True).click()
        dialog(page).get_by_role("button", name="นำภาพออก", exact=True).click()
        expect(dialog(page).get_by_role("heading", name="เอาภาพออกจากผังตลาด?")).to_be_visible()
        assert market(admin, main["id"])["layoutImage"] == image
        dialog(page).get_by_role("button", name="ยืนยันเอาภาพออกจากตลาด", exact=True).click(); expect(dialog(page)).to_have_count(0)
        assert market(admin, main["id"])["layoutImage"] is None
        passed("Uploaded background persists, neutral preview is local, and inline removal requires explicit null confirmation")

        for width in [360, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 1000})
            for label, route in [("markets", "/admin/markets"), ("layout", path), ("schedule", f'/admin/markets/{main["id"]}/schedule')]:
                goto(page, route)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow {label} {width}"
                if label == "layout":
                    boxes = page.locator("[data-layout-canvas] button").evaluate_all("buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})")
                    for i, a in enumerate(boxes):
                        for b in boxes[i+1:]:
                            overlap = min(a["x"]+a["w"],b["x"]+b["w"]) > max(a["x"],b["x"]) and min(a["y"]+a["h"],b["y"]+b["h"]) > max(a["y"],b["y"])
                            assert not overlap, f"Overlapping touch targets at {width}"
                settled(page);page.screenshot(path=str(OUT / f"{label}-{width}.png"), full_page=True)
            if width < 900:
                page.get_by_role("button", name="เมนูผู้ดูแล", exact=True).click()
                expect(dialog(page).get_by_role("link", name="ตลาดและผัง", exact=True)).to_have_attribute("aria-current", "page")
                page.keyboard.press("Escape"); expect(dialog(page)).to_have_count(0)
        passed("Market list/layout/schedule settled screenshots at360/390/768/1024/1440 without page overflow or overlapping touch targets; responsive menu works")
        assert not errors, errors
    except Exception:
        try:
            print("INVALID_QA_FIELDS", page.locator("input:invalid").evaluate_all("inputs => inputs.map(input => ({id:input.id,value:input.value,message:input.validationMessage}))"), flush=True)
            settled(page);page.screenshot(path=str(OUT / "failure.png"), full_page=True)
        except Exception:
            pass
        raise
    finally:
        try:
            cleanup(admin)
        finally:
            (OUT / "results.json").write_text(json.dumps({"passed": results, "browser_errors": errors, "cleanup": manifest.get("resourcesCleaned", False)}, ensure_ascii=False, indent=2))
            browser.close()
