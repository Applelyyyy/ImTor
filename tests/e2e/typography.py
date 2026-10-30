"""Rendered-font and responsive regression. Uses existing isolated browser fixtures; no persistent writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://localhost:3100'
OUT = ROOT / 'test-results/typography'
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads((ROOT / 'test-results/fixtures.json').read_text())
results, errors, external_fonts, font_urls = [], [], [], set()


def rendered_font(page, selector, expected):
    session = page.context.new_cdp_session(page)
    try:
        session.send('DOM.enable')
        session.send('CSS.enable')
        document = session.send('DOM.getDocument')
        node = session.send('DOM.querySelector', {'nodeId': document['root']['nodeId'], 'selector': selector})
        fonts = session.send('CSS.getPlatformFontsForNode', {'nodeId': node['nodeId']})['fonts']
        used = [f for f in fonts if f['glyphCount'] > 0]
        assert used and all(expected in f['familyName'] and f['isCustomFont'] for f in used), (selector, used)
        return sorted(set(f['familyName'] for f in used))
    finally:
        session.detach()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    contexts = {}
    for role, index in [('guest', None), ('merchant', 1), ('admin', 0), ('customer', 2)]:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        if index is not None:
            context.add_cookies([{'name': 'next-auth.session-token', 'value': fixture['users'][index]['token'], 'url': BASE}])
        context.on('request', lambda r: external_fonts.append(r.url) if any(d in r.url for d in ['fonts.googleapis.com', 'fonts.gstatic.com']) else None)
        context.on('response', lambda r: font_urls.add(r.url.split('?')[0]) if '.woff2' in r.url else None)
        context.add_init_script("""window.fontCLS = 0; new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.fontCLS += entry.value;
        }).observe({type:'layout-shift', buffered:true});""")
        contexts[role] = context

    discovery = contexts['guest'].new_page()
    discovery.goto(BASE + '/markets'); discovery.wait_for_load_state('networkidle')
    market_paths = discovery.locator('.market-card a[href^="/markets/"]:not([href$="/map"])').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))')
    demo_markets = [path for path in market_paths if fixture['marketSlug'] not in path][:2]
    assert len(demo_markets) == 2, 'Seed both small and large demonstration markets first'
    discovery.goto(BASE); discovery.wait_for_load_state('networkidle')
    product_path = discovery.locator('.product-photo').first.get_attribute('href')
    store_path = discovery.locator('.store-line').first.get_attribute('href')
    routes = [('guest', '/', 'home'), ('guest', '/explore', 'explore'), ('guest', '/markets', 'markets'),
              ('guest', demo_markets[0], 'market-small'), ('guest', demo_markets[1], 'market-large'),
              ('guest', demo_markets[1] + '/map', 'map'), ('guest', product_path, 'product'),
              ('guest', store_path, 'store'), ('guest', '/login', 'login'), ('guest', '/become-vendor', 'registration-guest'),
              ('merchant', '/become-vendor', 'registration-form'), ('merchant', '/merchant', 'merchant'),
              ('merchant', '/merchant/products/new', 'product-form'), ('merchant', '/merchant/schedule', 'schedule-form'),
              ('admin', '/admin', 'admin'), ('admin', '/admin/users', 'admin-users'),
              ('admin', '/admin/reservations', 'admin-reservations'), ('customer', '/reservations', 'reservations')]
    for role, route, name in routes:
        page = contexts[role].new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        for width in [375, 390, 768, 1440]:
            page.set_viewport_size({'width': width, 'height': 1000 if width > 768 else 844})
            if width == 375:
                response = page.goto(BASE + route)
                assert response.status == 200, (name, response.status)
            page.wait_for_load_state('networkidle'); page.evaluate('document.fonts.ready')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (name, width, page.evaluate('document.documentElement.scrollWidth'))
            assert 'Kodchasan' in page.locator('body').evaluate('(e)=>getComputedStyle(e).fontFamily')
            assert rendered_font(page, '.brand-title', 'Mali')
            heading_font = 'Mali' if name in ['home', 'login'] else 'Kodchasan'
            actual = rendered_font(page, 'h1', heading_font)
            if name == 'home':
                rendered_font(page, '.product-content h3', 'Kodchasan')
                rendered_font(page, '.price', 'Kodchasan')
                expect(page.get_by_label('ค้นหาสินค้าและร้านค้า')).to_have_attribute('placeholder', 'ค้นหาร้านค้าหรือสินค้า')
            if name == 'map':
                page.locator('[data-map-stall]').first.click()
                expect(page.locator('.location-panel')).to_be_visible()
                page.get_by_label('ค้นหาร้านหรือล็อก').fill('A01')
                expect(page.locator('.stall-list-item')).to_have_count(1)
            if name == 'product-form':
                if not page.locator('details').evaluate('(e)=>e.open'):
                    page.locator('summary').click()
                assert page.locator('details').evaluate('(e)=>e.open')
                rendered_font(page, 'label', 'Kodchasan')
            if name == 'explore':
                page.locator('#market-filter').focus();page.keyboard.press('ArrowDown');page.keyboard.press('Escape')
            if page.locator('.data-table').count():
                rendered_font(page, '.data-table th', 'Kodchasan')
                assert page.locator('.data-table-wrap').evaluate('(e)=>getComputedStyle(e).overflowX') == 'auto'
            if width in [375, 1440] or name == 'home':
                page.screenshot(path=str(OUT / f'{name}-{width}.png'), full_page=True)
            results.append({'page': name, 'width': width, 'font': actual, 'cls': page.evaluate('window.fontCLS')})
            print('PASS', name, width, actual, flush=True)
        if name == 'home':
            page.set_viewport_size({'width': 375, 'height': 844})
            page.locator('.store-line').first.evaluate('(e)=>e.textContent="ร้านข้าวเหนียวมะม่วงน้ำดอกไม้ หอมหวาน อิ่มอร่อย Campus Kitchen 2026"')
            page.locator('.product-content h3').first.evaluate('(e)=>e.textContent="ข้าวกะเพราเนื้อไข่ดาวน้ำปลาพริกสูตรคุณยาย Special Set 123"')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.product-content h3').first.evaluate('(e)=>getComputedStyle(e).lineHeight') == '23.8px'
            page.screenshot(path=str(OUT / 'long-name-stress-375.png'), full_page=True)
        if name == 'map':
            page.set_viewport_size({'width': 375, 'height': 844})
            page.locator('.stall-list-item span').first.evaluate('(e)=>e.textContent="CampusKitchen".repeat(8)+" ร้านอาหารมหาวิทยาลัย"')
            page.locator('.location-panel p').first.evaluate('(e)=>e.textContent="CampusKitchen".repeat(8)+" · ร้านยืนยันเปิด · ร้านแจ้งตำแหน่งเอง"')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / 'long-map-name-375.png'), full_page=True)
        if name == 'admin-users':
            dialogs = []
            page.on('dialog', lambda d: (dialogs.append(d.type), d.dismiss()))
            page.get_by_role('button', name='ตั้งเป็นผู้ดูแล', exact=True).first.click()
            assert dialogs == ['confirm']  # Native browser UI is not styled by application fonts.
        page.close()
    cold_loads = []
    for width in [375, 1440]:
        cold = browser.new_context(viewport={'width': width, 'height': 1000})
        cold.add_init_script("window.fontCLS=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.fontCLS+=e.value}).observe({type:'layout-shift',buffered:true})")
        page = cold.new_page(); page.goto(BASE); page.wait_for_load_state('networkidle'); page.evaluate('document.fonts.ready')
        cold_loads.append({'width': width, 'cls': page.evaluate('window.fontCLS'), 'font': rendered_font(page, 'h1', 'Mali')})
        page.screenshot(path=str(OUT / f'cold-home-{width}.png'), full_page=False)
        cold.close()
    browser.close()
assert not errors, errors
assert not external_fonts, external_fonts
# Next's development overlay is browser tooling, not application typography.
font_urls = {url for url in font_urls if '/__nextjs_font/' not in url}
assert font_urls and all(url.startswith(BASE + '/_next/static/media/') for url in font_urls), sorted(font_urls)
(OUT / 'results.json').write_text(json.dumps({'checks': results, 'browser_errors': errors, 'external_font_requests': external_fonts, 'self_hosted_font_files': len(font_urls), 'cold_loads': cold_loads}, ensure_ascii=False, indent=2))
print(f'{len(results)} responsive page checks passed; {len(font_urls)} same-origin font files; no browser errors or external font requests', flush=True)
