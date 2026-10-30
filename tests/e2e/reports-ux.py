"""Report validation, feedback and admin visibility on isolated local fixtures."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}, "Loopback only"
fixture = json.loads((ROOT / "test-results/fixtures.json").read_text())
assert fixture.get("databaseName", "").endswith("_test"), "Isolated *_test database required"
OUT = ROOT / "test-results/reports-ux"
OUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
def ok(name):
    checks.append(name)
    print("PASS", name, flush=True)
def signin(browser, index):
    context = browser.new_context(viewport={"width": 390, "height": 900})
    context.add_cookies([{"name": "next-auth.session-token", "value": fixture["users"][index]["token"], "url": BASE}])
    return context
def api(context, method, path, data=None, status=200):
    response = context.request.fetch(BASE + path, method=method, data=data, headers={"Origin": BASE, "Content-Type": "application/json"})
    assert response.status == status, f"{method} {path}: HTTP {response.status}"
    return response.json().get("data")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    admin = signin(browser, 0)
    merchant = signin(browser, 1)
    customer = signin(browser, 2)
    store = next(row for row in api(merchant, "GET", "/api/stores") if row["name"].startswith(fixture["tag"]))
    product = api(merchant, "POST", "/api/products", {
        "storeId": store["id"], "categoryId": fixture["categoryId"],
        "name": fixture["tag"] + " รายงานปัญหาสั้น", "imageUrl": "/images/rice.jpg",
        "price": 1000, "reservable": False, "stock": 1,
    }, status=201)
    page = customer.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/product/" + product["id"], wait_until="networkidle")
    page.get_by_text("แจ้งปัญหาเกี่ยวกับสินค้านี้", exact=True).click()
    field = page.get_by_label("รายละเอียดปัญหา", exact=True)
    report_form = page.locator("form").filter(has=field)
    submit = page.get_by_role("button", name="ส่งรายงาน", exact=True)
    expect(submit).to_be_enabled()
    field.fill(" \n\t ")
    submit.click()
    expect(report_form.get_by_role("alert")).to_have_text("กรุณาระบุปัญหาที่พบ")
    expect(field).to_be_focused()
    ok("Whitespace-only report has a concise Thai field error and focuses the field")

    # Simulate an upstream technical error; it must not be shown to the user.
    page.route("**/api/reports", lambda route: route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"message": "reason: Too small: expected string to have >=5 characters"}})))
    field.fill("เสีย")
    submit.click()
    expect(report_form.get_by_role("alert")).to_have_text("ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง")
    expect(page.get_by_text("Too small", exact=False)).to_have_count(0)
    expect(field).to_have_value("เสีย")
    ok("Technical API failure is replaced by Thai feedback and preserves the report for retry")
    page.unroute("**/api/reports")

    for reason in ["ก", "เน่า"]:
        field.fill("  " + reason + "  ")
        with page.expect_response(lambda response: response.url.endswith("/api/reports") and response.request.method == "POST") as response_info:
            submit.click()
        response = response_info.value
        assert response.status == 201
        saved = response.json()["data"]
        assert saved["reason"] == reason
        expect(page.get_by_text("ส่งรายงานเรียบร้อยแล้ว", exact=True)).to_be_visible()
        expect(field).to_have_value("")
        expect(report_form.get_by_role("alert")).to_have_count(0)
        rows = api(admin, "GET", "/api/admin/reports")
        assert any(row["id"] == saved["id"] and row["reason"] == reason for row in rows)
    ok("One-character Thai and เน่า submit through the real API, trim, reset, notify and remain visible to admin")

    for width in [360, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 900})
        field.fill(" ")
        submit.click()
        expect(report_form.get_by_role("alert")).to_have_text("กรุณาระบุปัญหาที่พบ")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Report page overflow at {width}"
        field.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f"report-{width}.png"))
    ok("Accessible inline report validation remains readable at all five viewport widths")
    admin_page = admin.new_page()
    admin_page.goto(BASE + "/admin/reports", wait_until="networkidle")
    expect(admin_page.get_by_text("เน่า", exact=True).first).to_be_visible()
    expect(admin_page.get_by_role("link", name=product["name"], exact=True).first).to_be_visible()
    admin_page.screenshot(path=str(OUT / "admin-report.png"))
    ok("Actual admin dashboard renders the persisted short report")
    assert not errors, errors
    browser.close()

(OUT / "results.json").write_text(json.dumps({"checks": checks, "errors": errors}, ensure_ascii=False, indent=2))
