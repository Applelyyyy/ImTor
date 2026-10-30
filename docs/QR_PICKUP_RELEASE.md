# Stable overlays and QR pickup — production release

Released at 2026-10-30 19:24 UTC (2026-10-31 02:24 Asia/Bangkok).

- Live site: https://imtor.applely.dev
- App image: `imtor-app:qr-pickup-20261031-2`
- Port: `3100`, unchanged.
- Public `/api/health/ready`: HTTP 200, `{"status":"ok","service":"imtor"}`.

## Changes

Category links now use symmetric padding and no pending spinner. Their text was measured at the center in browser viewports of 1440, 768, 390 and 360 pixels.

The shared scroll-lock rule now preserves the fixed-header inset. Existing menus, dialogs, confirmation dialogs and sheets still use their existing portals, focus handling and dismissal controls. Opening them no longer shifts the main content, footer or scroll position. This is a shared fix, not a patch limited to the pictured product menu.

Customers can display a locally generated pickup QR from each active reservation. Merchants can scan it using a rear camera or a local QR image. Admin can also scan from reservation management. The existing server pickup transaction checks authorization, store binding, pickup proof, time and order state before completing it. Repeated valid scans display an explicit already-received warning and do not complete or debit stock twice.

The customer's pending reservation view checks its own status every two seconds while visible. A completed pickup refreshes that view automatically. This is polling, not a WebSocket connection. The existing manual pickup code remains collapsed as a backup.

## Usage

1. Customer signs in, books an available reservable product and opens **การจอง**.
2. Customer selects **แสดง QR รับสินค้า**.
3. Merchant opens **รายการจองของร้าน** and selects **สแกน QR รับสินค้า**.
4. Merchant allows camera access and points it at the customer's QR.
5. Wait for **ยืนยันรับสินค้าแล้ว** before handing over the product. **รายการนี้รับสินค้าแล้ว / ไม่ต้องส่งมอบซ้ำ** means that order has already been fulfilled.
6. If camera access is unavailable, select **เลือกรูป QR**. Images are decoded locally, not uploaded.

Only an authorized merchant or admin can complete pickup. Scanning with an unrelated account or store is rejected. The camera needs HTTPS and browser permission. No new credentials or permissions are needed beyond those app roles and camera consent.

## Verification

Local evidence in `artifacts/qr-pickup/`:

- `tests-full.log`: 233 tests passed across 46 files, including unit and focused reservation/inventory regression coverage.
- `replay-tests.log`: 11 final QR tests passed across two files after the replay-warning addition. Covers actual QR encode/decode, malformed input, authorization, store/proof checks, time constraints, concurrent completion and safe replay.
- `typecheck-final.log`, `lint-final.log`: passed.
- `build-final.log`: production Docker build passed for the deployed image.
- `git diff --check`: passed.

Final production browser pass: **30 recorded checks passed**, no JavaScript errors. See `browser-results.json` and `browser-final.log`.

- Four viewport sizes: centered category text, no spinner, stable search overlay opening and closing.
- Product action dropdown, product edit dialog, booking cancellation confirmation, customer QR, merchant scanner, mobile admin navigation sheet and mobile market detail sheet: unchanged content/footer/scroll geometry.
- Actual product creation and booking through the live APIs/UI using an existing authorized Google-backed session.
- Customer QR decoded through real browser getUserMedia, canvas and jsQR, with controlled camera-video input.
- Actual database pickup completed; camera tracks stopped; customer's reservation updated without a manual refresh.
- Camera-denied fallback decoded a local QR image. Repeated pickup displayed the already-received warning. Exactly one completion audit event was recorded.
- Completed pickup appeared in Admin.
- Unauthenticated status/pickup, wrong-origin pickup, incorrect proof and state-changing GET attempts were rejected. Status responses contained no pickup secrets.

Safe screenshots: `categories-1440.png`, `categories-768.png`, `categories-390.png`, `categories-360.png`, `qr-confirmed.png`, `qr-already-received-mobile.png`.

## Data and deployment safety

Only the app container was replaced. Database and `busy_ishizaka` Tunnel container IDs and start times stayed unchanged. Runtime environment values were compared before cutover and were unchanged. No schema migration, generic seed, OAuth configuration, R2 change or Tunnel recreation was performed.

The final browser pass created one temporary product and one temporary reservation. Both were physically removed using existing authorized Admin APIs. Their completion audit remains as an audit record. A fingerprint confirmed all pre-existing genuine records were unchanged: 3 users, 3 stores, 4 products, 0 genuine markets and 0 genuine reservations. Presentation batch records were not reset or reseeded.

Temporary test env files, session fixture, pickup-proof image and camera video were removed. `.env.deployment` was preserved. Evidence: `cleanup-data.json`, `private-cleanup.json`, `deployed.json`.

App-only rollback is available in `artifacts/qr-pickup/rollback-app.sh`. It restores `imtor-app:preview-chrome-20261031-3` without touching data, media or the Tunnel. Its shell syntax and retained image were checked; production rollback was not executed because the release passed.

## Not verified

- A physical phone camera, Firefox or WebKit. Chromium used its real camera API and decoder with a generated video fixture; camera denial was simulated.
- Fresh Google consent/login. The browser used an existing valid Google-backed session.
- New R2 uploads or domain configuration. This release did not change storage.
- Large-load performance. The status polling design targets the existing classroom-sized presentation audience.

Review: `docs/QR_PICKUP_REVIEW.md`. Design and primary references: `docs/QR_PICKUP_DESIGN.md`.
