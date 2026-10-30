# Verification record

Date: 2026-10-30. Only local resources belonging to this task were created or modified. No public deployment, live Google OAuth callback, external R2/AWS operation or real campus location was verified.

## Results

| Check | Observed result |
|---|---|
| Bun dependency installation | Passed; lockfile committed; host engine-download fallback verified against the primary SHA-256 |
| TypeScript | `bun run typecheck`, exit 0 |
| ESLint | `bun run lint`, exit 0 |
| Unit + PostgreSQL integration tests | `bun run test`: 47 tests passed across 12 files |
| Real schema/category/snapshot migrations | Applied to local application DB and separate `_test` DB |
| Production Next.js build | `bun run build`: compiled and typechecked; dynamic App Router routes emitted |
| Bun security audit | No vulnerabilities found across 734 packages after Sharp 0.35.5 upgrade |
| Playwright | Final full run: 13 scenarios passed; separate raw RSC stream regression passed for guest/non-admin |
| Raw production admin response security | 60/60 checks: 15 admin routes × HTML/RSC × guest/non-admin; private probe markers absent |
| Additional admin browser checks | 3 passed: fractional layout coordinates, schedule-editor persistence, announcement update/restoration |
| Responsive review | 1440px desktop and 390px mobile screenshots; no horizontal overflow in tested views |
| S3 compatible upload | Real browser signed PUT, backend decode/re-encode, approved JPEG download on local RustFS 1.0.4 |
| Docker and operational tests | See INFRA_VERIFICATION.md for exact final images, Compose startup and backup/restore evidence |

## Test coverage

Pricing: regular price, fixed/percentage/final percentage, exact activation/expiration boundaries, repeating overnight windows, rounding, precedence, invalid repeating boundaries, above-base defaults.

Scheduling: weekly recurrence, explicit biweekly anchor, timezone date boundary, overnight sessions, special closures/events, invalid local times, create-only cancellation preservation, controlled real PostgreSQL materializer/admin lock race.

Integrity: owner/admin permissions, suspension, final super-admin protection, real adapter-linked identity/session persistence, one winning reservation for final stock, immutable price/mode snapshot, pickup code, double completion/cancellation rejection, exactly-once expiration restock, conflicting stalls and database negative-stock rejection.

Demo: bounded configuration and gates, coherent relational generation, suspended `.invalid` customers with no authentication identity, fictional coordinates, browse-only rescue deadline, batch cleanup and refusal to cascade into foreign records.

Browser: guest feed/search/map, guest admin denial, authenticated merchant creation, attendance claim, real object upload and product publication, visible location, cross-owner writes, discount snapshot/reservation/stock/pickup/replay, admin biweekly rules, coherent demo generation/cleanup, CSRF/role protection, mobile navigation and runtime-error collection.

## Evidence files

Tests: `tests/unit`, `tests/integration`, `tests/e2e/browser.py`.

Private ephemeral browser fixtures and fresh screenshots/results live under ignored `test-results/`; no session tokens are committed. Shareable UI review screenshots live under `artifacts/`. Engineering decisions and remaining external checks are in ENGINEERING_REPORT.md. Runtime-derived temporary logs are retained under `/tmp/imtor-*.log` for this session, not relied on as permanent deployment evidence.

## Remaining checks

Real Google OAuth credentials/callback, R2/AWS permissions/CORS/public prefix, actual domain DNS/TLS/proxy cookies, actual campus schedules/coordinates, production-scale load and off-VM backup automation. These are not marked passing.

## Final security correction

A Docker smoke test found that layout-only admin authorization could redirect the browser while leaking child data into an earlier streamed response. The raw-response regression failed before the fix. Every admin page now independently authorizes before data queries. The page-boundary unit test and raw guest/non-admin test passed afterward; isolated production-container checks passed all 60 HTML/RSC combinations against the same private probe fixture. Tests assert raw bytes, not just the final browser URL. See `tests/unit/authorization-boundaries.test.ts`, `tests/e2e/security.py` and INFRA_VERIFICATION.md.

One final E2E rerun initially failed because its old `#authorized` selector was invalid after accessible form IDs became unique. The test now locates the checkbox by its label; the full 13-scenario rerun passed. This was a stale test selector, not a skipped failure.

## Performance and accessibility measurement

Default mobile Lighthouse against the locally production-built seeded homepage initially measured performance **84** and accessibility **92**. The accessibility report identified real text-contrast and mobile link-name defects; CSS contrast and the account link's accessible name were corrected. After a fresh production build and server warmup, the same mobile audit measured performance **89** and accessibility **100**, with no Lighthouse runtime error. LCP was **1.0 s** and simulated total blocking time **370 ms**. Contrast and link-name checks passed. The performance target above 90 is **not** marked satisfied; mobile main-thread work/shared-host variation remains a follow-up. This is a lab result, not a claim of production field Core Web Vitals. Raw reports remain in ignored `test-results/lighthouse*.json`.
