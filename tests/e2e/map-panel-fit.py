"""Read-only desktop map action-fit regression; requires existing loopback QA fixtures."""
import json
import os
import re
from pathlib import Path
from ui_helpers import settled
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}
fixture = json.loads((ROOT / "test-results/fixtures.json").read_text())
OUT = ROOT / "artifacts/modal-ux"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in [768, 1024, 1440]:
        page = browser.new_page(viewport={"width": width, "height": 950})
        page.goto(f'{BASE}/markets/{fixture["marketSlug"]}/map?session={fixture["sessionId"]}', wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        search = page.get_by_role("search", name="ค้นหาในแผนผังตลาด").get_by_role("searchbox")
        search.fill("A99")
        before = page.evaluate("scrollY")
        search.press("Enter")
        panel = page.locator("[data-map-workspace] section")
        link = panel.get_by_role("link", name="ดูร้านและสินค้า", exact=True)
        expect(link).to_be_visible()
        price = panel.locator('a[href^="/product/"]').first.locator("span").filter(has_text=re.compile(r"^฿")).last
        settled(page);page.screenshot(path=str(OUT / f"map-panel-fit-{width}.png"))
        expect(link).to_be_in_viewport(ratio=1)
        expect(price).to_be_in_viewport(ratio=1)
        assert link.evaluate("el => {const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}"), "Store action must not sit behind fixed navigation"
        assert page.evaluate("scrollY") == before, "Selecting a result must not scroll the page to its actions"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        # Existing selection remains fitted after resizing, without another search/click.
        page.set_viewport_size({"width": width, "height": 900})
        expect(link).to_be_in_viewport(ratio=1)
        expect(price).to_be_in_viewport(ratio=1)
        print(f"PASS map first price + store action in viewport at {width}, resize950→900, no page scroll", flush=True)
        page.close()
    browser.close()
