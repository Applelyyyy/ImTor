# Backend security and quality review

Review date: 2026-10-30. Scope: authentication, permissions, validation, HTTP boundaries, product/inventory/reservation/attendance/admin/upload services, transaction helper and REST catch-all. This is an independent implementation review, not a claim of external penetration testing. Only the loopback PostgreSQL database was queried or used for isolated negative-test fixtures. No production connection, OAuth provider or external object-storage mutation was used.

## Executive summary

The implementation has meaningful server-side authorization and concurrency defenses: database-backed Google sessions, verified-email/suspension checks, server-selected owners and roles, origin checking, bounded JSON bodies, row-locked/serializable inventory changes, a database stall exclusion constraint, immutable reservation price snapshots, and private-stage/re-encoded image publication. Two isolated negative tests nevertheless demonstrated an invalid persisted discount that can break the shared marketplace response and an administrator schedule-edit workflow that remains blocked after cancellation. A clean production database also lacks non-demo product categories.

Findings below describe the source at review time; subsequent fixes require regression verification. P1 means fix before a production/interview-ready completion claim; P2 means a concrete correctness gap, not necessarily an exploitable security vulnerability.

## Findings

### BR-01 — P1: a merchant can persist a repeat window that breaks shared pricing

**Evidence:** `/home/stars/ImTor/src/lib/validation.ts:15` checks that repeat boundaries are both present, but does not reject equal start/end values. `/home/stars/ImTor/src/services/products.ts:59–66` then persists that input. `/home/stars/ImTor/src/services/pricing.ts:28` rejects the resulting rule. `/home/stars/ImTor/src/lib/queries.ts:22` maps pricing for the complete feed without isolating a malformed listing.

**Impact:** any ordinary merchant able to create a discounted listing can make the shared product feed fail whenever that listing is included, rather than only making their own discount invalid. This is not a role-escalation claim.

**Local reproduction:** create an isolated merchant/store/product; call `ProductService.discount` with `kind=FIXED`, `value=1000`, valid absolute dates, and `repeatStart=repeatEnd=19:00`; reload that rule and call `PricingService.calculate`.

Observed literal output:

```text
EQUAL_REPEAT_RULE_PERSISTED true
PRICE_ERROR Invalid repeating discount window
```

**Fix:** reject equal repeating boundaries at the request/service validation boundary and validate a complete candidate rule with the pricing engine before persisting. Add a service-level regression proving the invalid rule never reaches the database. Consider a defensive read-path policy for previously invalid persisted rules, with observability, rather than a whole-feed failure.

**Verification level:** runtime-confirmed service persistence and pricing failure; HTTP page outage is inferred from the uncaught shared mapper, not exercised against an authenticated browser.

### BR-02 — P1: clean non-demo deployments cannot publish a first product

**Evidence:** `/home/stars/ImTor/src/services/products.ts:32` requires an existing category; `/home/stars/ImTor/src/app/merchant/products/new/page.tsx:8–19` obtains category choices from the database. The initial schema migration contains no category inserts, and `/home/stars/ImTor/scripts/seed.ts:6–11` only runs the explicitly gated fictional demo generator. Non-test category creation is currently only `/home/stars/ImTor/src/services/demo.ts:49`, with batch-specific category IDs. The REST catch-all has no category-management endpoint.

**Impact:** the normal production path requires enabling and keeping fictional demo data merely to populate a mandatory product field. Cleanup of a demo batch will correctly refuse if a genuine product subsequently references its category, but that is not a replacement for a real catalog bootstrap.

**Fix:** seed stable, non-demo category records independently of the demo generator, preferably through an idempotent catalog bootstrap or data migration. Verify first-product publication after migrations alone with demo generation disabled.

**Verification level:** source-verified bootstrap gap; no production database was created or modified for this finding.

### BR-03 — P2: cancelling a session does not unblock the advertised schedule-edit workflow

**Evidence:** `/home/stars/ImTor/src/services/admin.ts:12–15` refuses any future session with attendance/product references and instructs the admin to cancel affected sessions first. `/home/stars/ImTor/src/services/admin.ts:84–90` cancels attendance and reservations but preserves attendance/product records. `/home/stars/ImTor/src/services/admin.ts:50` and `:63` still count those preserved rows on subsequent schedule/exception edits.

Local reproduction: create a future session with one attendance, call `AdminService.session(..., CANCELLED)`, then call `AdminService.rule`.

```text
CANCEL_THEN_EDIT_ERROR มีร้านหรือสินค้าในรอบตลาด กรุณายกเลิกรอบที่ได้รับผลกระทบก่อนแก้ตาราง
```

**Impact:** administrators cannot modify schedules after merchants have joined, even after following the recovery instruction. The demo's populated sessions expose this immediately.

**Fix:** preserve populated cancelled/history rows while rebuilding only unpopulated generated sessions, and apply changed rules to later dates without silently reviving cancelled instances. If a same-date time replacement is needed, provide an explicit transaction that preserves historical reservation/attendance lineage and requires merchant reassignment.

**Verification level:** runtime-confirmed; negative fixtures were deleted afterward.

### BR-04 — P2: materialization can race an administrator schedule mutation

**Evidence:** `/home/stars/ImTor/src/services/schedule.ts:76–80` reads rules and creates sessions in separate nontransactional operations. `/home/stars/ImTor/src/services/admin.ts:49–53` deletes future generated sessions and commits changed rules, then invokes materialization afterward.

**Failure interleaving:** public materialization reads old rules; admin commits new rules and removes old sessions; the earlier reader inserts old-timed sessions; the admin's fresh reader uses `skipDuplicates` and leaves the stale sessions untouched.

**Fix:** use a shared per-market lock/version across schedule reads, generation and schedule mutation, or serializable transactional generation with conflict retries. Add a controlled concurrent regression asserting stored timestamps match the final rule version while explicit cancellations remain durable.

**Verification level:** source-identified race; the exact interleaving was not stress-tested during this review.

### BR-05 — P2: the rendered reservation pages do not trigger the expiry path

**Evidence:** `/home/stars/ImTor/src/services/reservations.ts:59–62` exposes batched expiry; `/home/stars/ImTor/src/app/api/[...path]/route.ts:57` invokes it for the JSON reservations endpoint. The rendered customer page `/home/stars/ImTor/src/app/reservations/page.tsx:17` instead calls `/home/stars/ImTor/src/lib/queries.ts:43`, which reads rows without expiry. The merchant page uses the same read helper. Creation lazily expires the requested product, so final-unit protection still works, but normal browsing does not necessarily release/display expired reservations.

**Impact:** past-deadline rows can remain visibly `RESERVED`, and feed stock can remain reduced until an unrelated expiry trigger or reservation attempt. The completion service correctly rejects an expired pickup, so this is not an expired-redemption bypass.

**Fix:** invoke a bounded, appropriately scoped expiry operation on the actual customer/merchant read paths or configure/document a scheduled expiry worker; derive the displayed expiration state from server time even if restocking is lazy. Test the rendered path, not just the JSON endpoint.

**Verification level:** source-verified routing discrepancy; no timed browser reproduction performed.

## Additional observations

- `/home/stars/ImTor/src/services/admin.ts:96` caps the default-discount value at `100` for every kind, so a system-wide `FIXED` discount cannot exceed one baht even though fixed values use satang. Use a kind-discriminated bound and test a 30-baht final price.
- `/home/stars/ImTor/src/services/attendance.ts:10–25` does not read the `marketRegistrationEnabled` system setting offered at `/home/stars/ImTor/src/services/admin.ts:96`. If that setting is intended to close self-service registration, enforce it in the service; otherwise remove/rename the ineffective control.
- `/home/stars/ImTor/src/services/products.ts:42–52` computes merged pickup fields before taking the row lock, then writes both fields unconditionally. Concurrent unrelated updates can overwrite a newer pickup window. Re-read/merge under the transaction lock and decide explicitly whether active reservations permit pickup/session changes.
- Concurrent upload finalization creates distinct immutable approved keys, so the reviewed implementation does **not** expose an overwrite-after-validation path. A lost race or delete failure can leave an orphan approved object; add an idempotent finalize claim/cleanup mechanism as operational hardening rather than weakening private staging or byte validation.

## Checks and limitations

- Negative reproduction script: `/tmp/imtor-backend-negative.ts`, run with `bun x tsx /tmp/imtor-backend-negative.ts`; exit `0`. It used loopback-host enforcement and unique temporary identifiers. Final output `FIXTURE_CLEANUP 0` verified the temporary user was removed; stores/products/rules/market/attendance/category/audit fixtures were explicitly deleted in `finally`.
- The broader project TypeScript check passed immediately before the review. Previously reported integration coverage exercised last-unit contention, conflicting stall allocation, authorization, pickup replay, database stock constraints and demo isolation; this review did not reclassify those passing tests as proof of every possible interleaving.
- Real Google OAuth callback/account linking, S3/R2 ACL/presigned replay behavior, private staging configuration, deployed cookie/header/proxy behavior, and production backup/restore remain environment-dependent and were not verified by this review.
- No arbitrary client-role assignment, raw SQL string injection or cross-owner product edit was found in the reviewed request paths. This is a scoped code-review conclusion, not proof of absence across all future routes.

## Resolution record

The original findings above describe the reviewed snapshot, not unresolved claims about the final tree. BR-01 gained request and service candidate validation; BR-02 gained genuine category migration; BR-03 preserves referenced cancelled history while rebuilding only eligible future sessions; BR-04 gained shared venue locking with READ COMMITTED materialization and a controlled PostgreSQL race regression; BR-05 now runs bounded expiration on the actual product/reservation read helpers. Fixed default-discount bounds, registration settings enforcement, and pickup merges under lock were also applied. Snapshot productMode prevents mutable listings from rewriting impact reports.

A later Docker verification uncovered a further critical issue: parent layout redirects did not prevent private child data from appearing in streamed unauthenticated responses. The same private probe response leaked before the fix and was absent afterward. All 15 admin pages now independently authorize before private queries; final container testing passed 60 combinations (HTML/RSC, guest/non-admin). See VERIFICATION.md and INFRA_VERIFICATION.md. Concurrent-finalization orphan-object cleanup and the pg 8 demo-check deprecation warning remain documented operational limitations.
