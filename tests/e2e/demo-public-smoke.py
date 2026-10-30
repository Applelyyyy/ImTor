"""Read-only public demo smoke. No fake Google session or secret output.

Run: codex-browser-env uv tool run --from playwright python tests/e2e/demo-public-smoke.py
Optional storage probe: send {"url": signed_PUT_URL, "bytes": [..]} on stdin
with --storage-put. The URL stays in memory and is never printed.
"""
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://imtor.applely.dev"
checks = []

def passed(name):
    checks.append(name)
    print("PASS", name, flush=True)

# Work around this VM's stale negative DNS cache without changing host DNS or
# disabling TLS. Resolve the same public names through a public DNS resolver.
rules = []
for name in ["imtor.applely.dev", "media.imtor.applely.dev"]:
    with urlopen("https://dns.google/resolve?name=" + name + "&type=A", timeout=15) as r:
        answer = json.load(r)
    address = next(a["data"] for a in answer["Answer"] if a["type"] == 1)
    rules.append("MAP " + name + " " + address)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--host-resolver-rules=" + ",".join(rules)])
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(error))
    response = page.goto(BASE, wait_until="networkidle")
    assert response.status == 200
    assert page.locator("h1").count() >= 1
    product = page.locator('a[href^="/product/"]').first.get_attribute("href")
    assert product
    (ROOT / "artifacts/demo").mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ROOT / "artifacts/demo/home-desktop.png"), full_page=True)
    passed("Public HTTPS homepage and fictional sample listings")
    if "--storage-put" in sys.argv:
        payload = json.load(sys.stdin)
        result = page.evaluate("""async ({url, bytes}) => {
          const r = await fetch(url, {method:'PUT', headers:{'Content-Type':'image/jpeg'}, body:new Uint8Array(bytes)});
          return {status:r.status, etagVisible:!!r.headers.get('etag')};
        }""", payload)
        assert result["status"] == 200 and result["etagVisible"], "Browser R2 PUT/CORS/ETag check failed"
        passed("Actual browser PUT to R2 from production origin with visible ETag")
    else:
        assert page.goto(BASE + product, wait_until="networkidle").status == 200
        passed("Sample product detail opens")
        assert page.goto(BASE + "/markets", wait_until="networkidle").status == 200
        passed("Public market schedule opens")
        page.goto(BASE + "/admin", wait_until="networkidle")
        assert "/login" in page.url
        passed("Unauthenticated admin request redirects to login")
        ready = page.evaluate("async () => (await fetch('/api/health/ready')).status")
        assert ready == 200
        providers = page.evaluate("async () => (await fetch('/api/auth/providers')).json()")
        assert providers.get("google", {}).get("id") == "google"
        passed("Public readiness and configured Google provider")
        csrf = page.evaluate("async () => (await fetch('/api/auth/csrf')).json()")
        cookies = context.cookies(BASE)
        assert any(c["name"].startswith("__Host-next-auth.csrf-token") and c["secure"] and c["httpOnly"] for c in cookies)
        passed("HTTPS Secure/HttpOnly NextAuth CSRF cookie")
        page.get_by_role("button", name=re.compile("Google")).click()
        page.wait_for_url("https://accounts.google.com/**", timeout=30000)
        page.wait_for_load_state("domcontentloaded")
        body = page.locator("body").inner_text()
        assert not any(s in body for s in ["redirect_uri_mismatch", "invalid_client", "deleted_client"]), "Google rejected OAuth configuration"
        passed("Real Google authorization endpoint reached; presenter sign-in still required")
    assert not errors, f"Browser runtime errors: {len(errors)}"
    browser.close()

if "--storage-put" not in sys.argv:
    (ROOT / "artifacts/demo/browser-smoke.json").write_text(json.dumps({"checks": checks, "oauthRoundTrip": "pending presenter login"}, indent=2))
