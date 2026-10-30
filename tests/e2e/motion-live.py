"""Read-only verification of the actual live ImTor deployment; no fixtures/writes."""
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/motion/live'
BASE='https://imtor.applely.dev'
checks=[]
def passed(name):
 checks.append(name);print('PASS',name,flush=True)
rules=[]
for host in ['imtor.applely.dev','media.imtor.applely.dev']:
 with urlopen('https://dns.google/resolve?name='+host+'&type=A',timeout=15) as r: data=json.load(r)
 address=next(x['data'] for x in data.get('Answer',[]) if x['type']==1)
 rules.append('MAP '+host+' '+address)
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--host-resolver-rules='+','.join(rules)])
 context=browser.new_context(viewport={'width':1440,'height':1000})
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(type(e).__name__))
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
  assert page.goto(BASE,wait_until='networkidle').status==200
  expect(page.locator('h1')).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.locator('.form-submit').count()>0
  assert page.locator('.hero-copy').evaluate('(el)=>getComputedStyle(el).animationDuration')=='0.24s'
  page.screenshot(path=str(OUT/f'home-{width}.png'),full_page=True)
  passed(f'Live {width}px homepage, deployed CSS motion tokens, no horizontal overflow')
 product=page.locator('a[href^="/product/"]').first
 if product.count():
  href=product.get_attribute('href')
  assert page.goto(BASE+href,wait_until='networkidle').status==200
  image=page.locator('.detail-photo img').first
  if image.count():
   expect(image).to_be_visible()
   assert image.evaluate('(el)=>el.complete&&el.naturalWidth>0')
   source=parse_qs(urlparse(image.get_attribute('src')).query).get('url',[''])[0]
   if source.startswith('https://media.imtor.applely.dev/'):
    passed('Existing real R2-backed product image renders through deployed image configuration')
  passed('Existing live product detail opens without inserting sample data')
 assert page.goto(BASE+'/markets',wait_until='networkidle').status==200
 expect(page.locator('.market-switcher')).to_be_visible()
 page.screenshot(path=str(OUT/'markets-390.png'),full_page=True)
 passed('Live market selector and existing market data render')
 page.goto(BASE+'/admin',wait_until='networkidle');assert '/login' in page.url
 passed('Guest admin protection remains intact')
 assert page.evaluate("async()=> (await fetch('/api/health/ready')).status")==200
 providers=page.evaluate("async()=> (await fetch('/api/auth/providers')).json()")
 assert providers.get('google',{}).get('id')=='google'
 passed('Live database readiness and actual Google provider configured')
 # No account credentials, fake session or consent changes. Do not log OAuth URLs.
 try:
  page.get_by_role('button',name='เข้าสู่ระบบด้วย Google',exact=True).click()
  page.wait_for_url('https://accounts.google.com/**',timeout=30000)
  page.wait_for_load_state('domcontentloaded')
  text=page.locator('body').inner_text()
  assert not any(x in text for x in ['redirect_uri_mismatch','invalid_client','deleted_client'])
 except Exception:
  raise RuntimeError('Live Google authorization initiation failed; OAuth URL withheld') from None
 passed('Actual Google authorization endpoint reached without client/redirect rejection')
 assert not errors, 'Browser page errors occurred; details withheld'
 browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':checks,'browserPageErrorCount':len(errors),'googleRoundTrip':'requires real user sign-in; no credentials entered','dataWrites':False},indent=2))
