# ImTor motion overhaul — production report

Released 2026-10-30 20:58 UTC / 2026-10-31 03:58 Asia/Bangkok.

Live: https://imtor.applely.dev. Image: `imtor-app:motion-overhaul-20261031-3`, port3100. Public readiness returned200. Only the app container changed; database/Tunnel container IDs and start times and runtime environment values stayed unchanged. No schema, API, pricing, inventory rules, OAuth or storage configuration changed.

## 1. Audit findings

The existing system had short opacity fades and basic press/hover states. The hero heading itself had no entrance. Shared dialog/sheet rules overrode their original movement with opacity-only effects. Some callers removed forms/titles before the closing shell disappeared. The map resized immediately, discarded focus requests during zoom, and initially failed to preserve explicit reset intent. Earlier reduced-motion selector specificity also allowed static hover transforms through.

## 2. Pages and interactions improved

- Home: one bounded heading/search/today-market welcome sequence; header acknowledgment; first eight product cards only receive short entrances.
- Product feeds and store profiles: fine-pointer3px card lift, clipped1.025 image zoom, immediate touch feedback. Existing products do not remount on stock refresh. Product details inherit shared reservation-dialog behavior.
- Market calendar: a native, measured sliding indicator follows the committed server filter; no new label appears over stale data. Calendar week and scroll=false routing remain intact.
- Small/Large maps: selected outline feedback, nearby details entrance, whole-plane button zoom, confined search focus, immediate pan and mobile handle snapback/dismissal.
- Merchant: creation/edit dialogs retain outgoing contents; upload preview uses its existing truthful phases; stock/status acknowledgment responds only to confirmed values. Existing successful-save toasts remain backend-confirmed and fixed-position.
- Admin: directional navigation sheet, shared dialogs, anchored dropdowns and controls. No animated table rows or counters on every refresh.
- Global search: short result/empty-state entrance. Existing request cancellation, Enter and Escape behavior remain intact.

Branding, Thai copy, Mali/Kodchasan, fixed header, centered category labels, removed category spinner and minimal footer remain preserved.

## 3. Motion tokens

Central CSS tokens: press110ms, hover140ms, control180ms, feedback200ms, enter240ms, expressive280ms, exit160ms, spring300ms. Enter easing remains `cubic-bezier(0.215,0.61,0.355,1)`; visible movement uses `cubic-bezier(0.645,0.045,0.355,1)`; color/hover use ease. Product stagger is45ms between sibling columns, capped at135ms delay, first eight only.

## 4. Shared components

- `src/lib/motion.ts`: native animation helper, CSS-duration lookup, reduced-motion cancellation/listener cleanup and one pre-sampled damped spring.
- `ChangeFeedback`: skips initial mount/identical refresh; acknowledges confirmed changes without inventing values.
- `SheetDragHandle`: gestures only on the handle, native content scrolling elsewhere, keyboard dismissal equivalent.
- `RetainedDialogBody` inside AppDialog: keeps the outgoing title/form through Radix's closing presence without extra DOM wrappers or timers.

Existing Radix data-state, data-side and transform origins own all overlay variants. No application-wide route wrapper or unnecessary clientification of query pages was introduced.

## 5. Bugs fixed

Independent review and browser checks found and fixed reset restoring old pan, lost selection during zoom, and reduced-motion changes failing to stop native focus scrolling. The final map tests cover each case. The final CSS specificity correction also disables reduced-motion card/image/button spatial feedback. Before that correction, the browser measured a3px lift and1.025 image scale with reduced motion enabled; the built-image regression now measures transform:none.

Dialog scale no longer competes with centering translation. Shared exits preserve contents. Competing Tailwind animation utilities were removed rather than layered into double animation.

## 6. Libraries

No dependencies added. CSS owns fixed sequences and Radix presence. Native Web Animations API handles interruptible measured movement and value feedback. The spring is mass1/stiffness600/damping40, sampled once into31 frames; React does not rerender on animation frames.

## 7. Performance observations

The final signature-indicator sample recorded20 frame intervals: median16.7ms, maximum16.8ms in this Chromium runner. This is one interaction trace, not a physical-phone FPS claim.

The batched cold-load run recorded homepage CLS0–0.0745 across the five widths; subsequent store pages recorded0. A contended initial run included a611ms cold-load task while typecheck/lint ran. A separate three-run comparison without that contention measured longest cold-load tasks of89–90ms before and78–99ms after. This small sample does not prove a general speed improvement.

Observed homepage JS transfer was about190KB in both versions. All-route static JS gzip totals are recorded in `artifacts/motion-overhaul/bundle.json`; the motion change adds about14.2KB across all routes, not14.2KB to every page. There is no new library runtime, permanent will-change, large blur or per-frame React work. Full mobile-hardware and large-load profiling remain unverified.

## 8. Reduced motion and accessibility

CSS decorative entrances, sheet travel, scaling and hover movement are disabled. Native helpers skip or cancel animations when preferences change. Native search focus applies its final position immediately. Selected text/color and existing toasts/live regions remain meaningful without movement.

Keyboard paths verified: search Enter/Escape, dialog focus/restore, dirty-form resume/discard, map selection, mobile dismissal, dropdown dismissal and admin navigation. The drag handle is a real Thai-labelled button and does not steal content scrolling.

## 9. Responsive coverage

360,390,768,1024,1440px: public pages, merchant forms, maps and admin/editor checks. Actual Chromium tab zoom100/110/125% used an isolated temporary extension with chrome.tabs.setZoom/getZoom. Observed inner widths1440/1309/1152 and DPR1/1.1/1.25 confirm real browser zoom rather than CSS-only zoom.

## 10. Browser results

- Built-image motion suite:16 grouped checks passed, no JavaScript errors. Verified real animation timelines, dialog centering, stable shell/footer geometry, committed and rapid market routing, both maps, zoom/pan geometry, reset, mid-zoom selection, preference changes, mobile drag, retained form exit/reopen, dropdowns, authoritative inventory feedback and admin sheet.
- During map zoom, measured marker/plane drift stayed below0.013px.
- Merchant regression:10 checks passed, including actual local S3 upload, create/edit100→50→40→0, lost-response idempotency, tracking-off, publication toast geometry, five widths, draft protection and archive.
- Stall selection regression:11 checks passed, including actual local layout upload,2:1 geometry, permission/occupancy conflicts, keyboard, co-located stalls, both layouts, five widths, dirty close, text alternative and error recovery.
- Customer regression:7 checks passed, including real booking, lost-response replay, cancellation stock restoration and ownership/origin denials; ten routes at all five widths.
- Admin regression:6 checks passed, including real create/edit/permanent-delete, layout edits, batch/undo, concurrent edits, upload/background removal, five widths and responsive navigation.
- Final reduced-hover regression on image3: card, image and pressed button all transform:none.
- Production read-only smoke: homepage, first four actual product images, product detail, market switch and map passed at390/1440px. No production test records were created.

Artifacts include before/after screenshots, WebM recordings, raw sampled frames and JSON/log results under `artifacts/motion-overhaul/`. These are ignored local evidence, not application dependencies.

## 11. Build and tests

- Final complete isolated unit/integration run:311 tests passed in59 files.
- Focused native cancellation/reduced-motion and map regression tests passed after the repair.
- TypeScript and ESLint passed. `git diff --check` passed.
- Production Docker build passed for the deployed image3.

The first full test attempt shared an E2E database with additional superadmins and had presentation flags=false, producing two setup-related failures. It was not treated as a pass. Full tests were rerun in a separate fresh loopback `imtor_motion_20261031_test` with the required flags; all311 passed. Existing browser selectors were updated from the previous schedule/deletion controls and booking label to the current UI. A five-second assertion during concurrent build contention passed in the complete fifteen-second merchant rerun; no failure was hidden.

## 12. Limits and cleanup

Fresh Google consent/login and physical camera/phone hardware were not repeated. OAuth code/configuration was untouched; isolated sessions are not evidence of a new Google login. Local S3 PUT/finalize was exercised; production R2 images were verified by public reads only. No production upload or infrastructure mutation was performed. No physical mobile frame-rate or large-load guarantee is claimed.

Owned local fixture records and uploaded objects were cleaned up. Temporary QA containers stopped and private environment/session fixture files removed. The dedicated local integration-test database is retained for reproducibility; production databases were not reset or seeded. App-only rollback is available at `artifacts/motion-overhaul/rollback-app.sh`; syntax and the previous image were checked, but rollback was not executed after a successful release.

Review: `docs/MOTION_OVERHAUL_REVIEW.md`. Design/plan: `docs/superpowers/specs/2026-10-31-motion-overhaul-design.md` and `docs/superpowers/plans/2026-10-31-motion-overhaul.md`.

Primary references: [Radix animation/presence](https://www.radix-ui.com/primitives/docs/guides/animation), [reduced-motion media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion), [Playwright extension testing](https://playwright.dev/python/docs/chrome-extensions), [Chrome tabs zoom API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom). Next.js16.4.3 local server/client and layout documentation was read before implementation.
