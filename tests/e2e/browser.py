"""Current database-backed UX suite; run isolated scripts/test-fixtures.ts first.

The fixture creator refuses non-loopback/non-_test databases. Tokens stay in its
private ignored JSON file. The browser runner never seeds or contacts production.
"""
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("IMTOR_TEST_BASE_URL", "http://localhost:3100")
assert urlparse(BASE).hostname in {"localhost", "127.0.0.1", "::1"}, "Isolated loopback only"
fixture = json.loads((ROOT / "test-results/fixtures.json").read_text())
assert fixture.get("databaseName", "").endswith("_test"), "Recreate fixtures against an isolated *_test database"
for script in ["merchant-modal.py", "customer-ux.py", "admin-ux.py", "admin-route-audit.py", "contextual-public.py", "map-panel-fit.py"]:
    subprocess.run([sys.executable, str(ROOT / "tests/e2e" / script)], cwd=ROOT, env=os.environ, check=True)
print("PASS merchant, customer, admin/editor, admin route, contextual public and map-fit UX suites", flush=True)
