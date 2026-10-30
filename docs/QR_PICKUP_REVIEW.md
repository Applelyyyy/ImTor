What this change does: It removes category-link spinners, centers their contents, and prevents overlay scroll locks from shifting the page. It adds customer pickup QR codes, merchant camera scanning, safe retries and automatic customer status updates.

Reviewed for the existing single Next.js application and a classroom-sized presentation audience. Read the shared UI primitives, their actual portal implementation, app-shell CSS, reservation callers, permissions, transaction helper, API routing, camera lifecycle and tests.

## Must fix — resolved

1. **Opening a popup removes the header inset** (`src/app/globals.css`, app-shell scroll-lock rule)
   - **What this is:** Dialogs, menus and sheets temporarily lock scrolling.
   - **Problem:** The scroll-lock library injects body padding-top:0. Actual browser checks moved main from80px to0px on desktop and68px to0px on phones. The popup itself was already positioned outside normal layout.
   - **Fix:** Preserve the header inset in one specifically scoped scroll-lock rule. Keep modal focus behavior and existing fixed portals intact.
   - **If we skip it:** Every shared modal variant can shift content beneath the header and appear to push other components.

2. **A repeated scan could look like a new physical handoff** (`src/services/reservations.ts`, QR replay result; `src/components/pickup-scanner.tsx`, receipt)
   - **What this is:** A lost network reply or a second scan can repeat the same valid pickup request.
   - **Problem:** Preventing a second database update alone is not enough. The merchant must know the order was already fulfilled before handing over another item.
   - **Fix:** Return an explicit alreadyCompleted flag from the transaction's existing completion branch. Display “รายการนี้รับสินค้าแล้ว” and “ไม่ต้องส่งมอบซ้ำ” for that result.
   - **If we skip it:** Inventory remains correct, but a merchant may physically hand out an extra item.

## Checked boundaries

- Customer QR generation happens only after authenticated, ownership-scoped page queries. No external QR service or secret-bearing URL is used.
- POST pickup reuses the existing transaction, product lock, merchant check, constant-time proof comparison and time constraints. Correct repeats return a receipt without another update, stock movement or completion audit event.
- Wrong account/store/proof, suspended actors, future pickup, cancelled orders, expired orders and malformed payloads remain errors. GET cannot complete pickup.
- The read-only status endpoint returns only the current customer's ID/status/expiry fields. Visible pending pages poll every2seconds without overlapping requests; hidden/unmounted pages stop network reads.
- Camera decoding is lazy-loaded. Frames and local images stay on-device. Closing/hiding/completing a scan stops tracks. Late camera permission results are discarded after unmount.
- PNG/JPG/WebP file fallback is size-limited. Decoding failure shows concise UI text. Network failure can retry the same proof safely.
- No schema migration, OAuth change, new infrastructure or permission bypass is needed.
- The only design-detector advisory is a pre-existing grid on an actual map canvas.

Verdict: Ship. Final production browser verification passed, including the explicit already-received warning.

Not checked: Physical phone camera hardware, Firefox/WebKit and large-load behavior. Chromium used real getUserMedia and QR decoding with a generated camera video; camera denial was simulated. Fresh Google consent was not repeated.
