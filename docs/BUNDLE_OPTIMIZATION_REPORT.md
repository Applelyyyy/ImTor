# ImTor browser bundle optimization

## Result and boundaries

One cohesive **size optimization**: move byte-identical `LoginButton` / `LogoutButton` implementations from `src/components/forms.tsx` to `src/components/auth-buttons.tsx`; update imports in `/login`, `/become-vendor` and `/profile`. Generic forms no longer import the browser authentication SDK. There is no dynamic import, loading delay, new UI, new dependency, schema migration, authorization change or OAuth configuration change.

Initial invocation was whole-app audit mode. The user then explicitly authorized speed improvements while requiring unchanged functionality. The only accepted source change is the authentication-button split. Further timing/compatibility changes below remain candidates, not applied fixes.

Before snapshot: `imtor audit before 20261031 01` at source commit `85bdd2b5f4accd2e9282483343896b046ee9277f`. After snapshot: `imtor auth split after 20261031 01`. Both capture all **41 routes** with installed Next.js **16.4.3** and Turbopack. There are 36 page routes with client outputs and 5 API routes without client output.

## Measured build attribution

**Metric:** analyzer `compressed_size` attribution, summing each `(route, filename, source_path)` once. Across-app union deduplicates `(filename, source_path)` across routes. Source paths are not module identities. These are build contributions, not actual network transfer, execution timings, Core Web Vitals or predicted byte savings. Route-summed bytes are a comparison index, not a simulated user session.

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Unique whole-app client JavaScript attributed bytes | 618,784 | 616,571 | -2,213 |
| Sum of per-route client JavaScript attributed bytes | 11,206,514 | 10,860,880 | -345,634 |
| Sum of per-route server output attributed bytes | 148,210,938 | 147,858,821 | -352,117 |

23 page routes decreased, 2 grew by 200 attributed compressed bytes each, and 11 were unchanged. All 5 API client totals remain zero. `next-auth` source attribution occurs in 25 route builds before, versus only `/login`, `/become-vendor` and `/profile` afterward. Those are the routes that still render authentication controls.

| Route | Client JS before | Client JS after | Delta |
|---|---:|---:|---:|
| `/` | 269,296 | 269,296 | +0 |
| `/_not-found` | 269,296 | 269,296 | +0 |
| `/admin` | 274,580 | 274,580 | +0 |
| `/admin/analytics` | 279,691 | 279,691 | +0 |
| `/admin/attendance` | 314,711 | 299,892 | -14,819 |
| `/admin/audit-logs` | 279,692 | 279,692 | +0 |
| `/admin/demo-generator` | 313,523 | 298,704 | -14,819 |
| `/admin/markets` | 315,005 | 300,186 | -14,819 |
| `/admin/markets/[id]/layout` | 325,302 | 310,483 | -14,819 |
| `/admin/markets/[id]/schedule` | 314,441 | 299,622 | -14,819 |
| `/admin/markets/new` | 313,523 | 298,704 | -14,819 |
| `/admin/products` | 315,738 | 300,919 | -14,819 |
| `/admin/reports` | 314,710 | 299,891 | -14,819 |
| `/admin/reservations` | 397,975 | 383,156 | -14,819 |
| `/admin/settings` | 281,532 | 281,532 | +0 |
| `/admin/stalls` | 314,711 | 299,892 | -14,819 |
| `/admin/stores` | 314,711 | 299,892 | -14,819 |
| `/admin/users` | 314,711 | 299,892 | -14,819 |
| `/api/[...path]` | 0 | 0 | +0 |
| `/api/auth/[...nextauth]` | 0 | 0 | +0 |
| `/api/health` | 0 | 0 | +0 |
| `/api/health/live` | 0 | 0 | +0 |
| `/api/health/ready` | 0 | 0 | +0 |
| `/become-vendor` | 308,273 | 308,473 | +200 |
| `/explore` | 270,207 | 270,207 | +0 |
| `/login` | 305,239 | 285,223 | -20,016 |
| `/markets` | 274,063 | 274,063 | +0 |
| `/markets/[slug]` | 271,103 | 271,103 | +0 |
| `/markets/[slug]/map` | 283,578 | 283,578 | +0 |
| `/merchant` | 337,889 | 323,070 | -14,819 |
| `/merchant/locations` | 338,794 | 323,975 | -14,819 |
| `/merchant/products` | 358,168 | 343,349 | -14,819 |
| `/merchant/products/[id]/edit` | 331,791 | 316,972 | -14,819 |
| `/merchant/products/new` | 328,738 | 313,919 | -14,819 |
| `/merchant/reservations` | 394,104 | 379,285 | -14,819 |
| `/merchant/schedule` | 338,793 | 323,974 | -14,819 |
| `/merchant/settings` | 310,827 | 296,008 | -14,819 |
| `/product/[id]` | 343,512 | 328,693 | -14,819 |
| `/profile` | 308,264 | 308,464 | +200 |
| `/reservations` | 309,822 | 295,003 | -14,819 |
| `/store/[slug]` | 270,201 | 270,201 | +0 |

The 22 non-authentication form pages each decrease by **14,819 bytes (14.47 KiB)**. `/login` decreases by **20,016 bytes (19.55 KiB)** because its client entry no longer brings the generic form and upload implementation. `/profile` and `/become-vendor` retain both form and authentication entries and each grow by 200 bytes. No claim is made that the home page became faster; its JS attribution is unchanged.

## Capture and reproducibility

Run from the repository with Bun. The build-only database URL is the existing non-secret build placeholder; capture does not query production.

```bash
DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build bun run next analyze --output --snapshot 'imtor audit before 20261031 01'
set -o pipefail
bun run next analyze export --snapshot 'imtor audit before 20261031 01' | gzip > before.jsonl.gz
# Repeat with distinct snapshot/output names for the after capture.
bun run next analyze --output --snapshot 'imtor auth split after 20261031 01'
bun run next analyze export --snapshot 'imtor auth split after 20261031 01' | gzip > after.jsonl.gz
```

Actual capture/export commands succeeded, and both gzip streams passed `gzip -t`. Failed pipelines were not promoted from `.partial` archives. Baseline and after archives, local installed `graph-v1.schema.json`, logs and scripts are in `artifacts/bundle-audit-20261031/`. The before analyzer UI/binary capture is preserved in `analyzer-ui.tar.gz`; both named snapshots also remain in `.next/diagnostics/analyze/history/`.

## Graph method, coverage and attribution

- Streamed 3,747 baseline exact module identities, 41 routes, 10,824 route/output records, 53,721 part records and 1,143 groups. Repeated output and source contributions across routes were deduplicated; no inconsistent duplicate records were found.
- Baseline unique client outputs: 73 exact chunks and 30 `not_a_chunk` outputs (28 WOFF2 fonts, runtime and precompiled compatibility polyfill). No unsupported chunks, missing member identities, missing indexed page roots, unjoined group triggers or missing group output memberships. Five API bootstrap-shaped entries have unknown `entry_kind`; APIs have no client outputs, so they are not counted as browser work.
- Roots: every typed `client_bootstrap` plus every applicable nested `ecmascript` client reference for each scenario, listed exactly in `roots.json` and `cuts.json`. CSS references explain three CSS identities outside ecmascript reachability. Server roots and traced file dependencies were not treated as browser imports.
- Communities: NetworkX 3.5 Louvain on the deduplicated ordinary client import graph, retaining sync/async edge kinds separately. 626 scoped nodes, 1,595 sync edges, 1 async edge. Symmetrized weight is one per distinct directed import; mutual directed edges add. Resolution 1, seed 42. Seeds 7/21/42 produced 15/14/14 communities and modularity 0.6854/0.6912/0.6675. Boundaries vary, so clusters are discovery aids, not chunks or trust boundaries.
- Community ranking counts each mapped `(filename, source_path)` contribution once. One ambiguous 1,878-byte contribution was split equally among its indexed aliases **only for ranking**. 237 contributions totaling 519,954 bytes have no exact source-part/member identity mapping (including fonts/polyfill and inlined/concatenated sources); they are explicit weight gaps, not zero-size modules. No inferred graph-node byte savings is assigned to them.
- Directed cuts use synchronous importer-to-imported edges, super-source connections to all selected roots, target-to-sink connections, unit cost only for selected optional application import edges and capacity 1,000,000,000 for roots, runtime and all required UI imports. Cycles and alternate roots are retained; post-cut reachability is checked. `cuts.json` lists every selected root/target/cut and SCC. Cuts describe the known indexed graph, never observed cold-request timing.

### Community target accounting and source validation

| Target / affected scenario | Source / exact importer | Graph result and attribution | Disposition / behavior checks |
|---|---|---|---|
| Browser authentication helpers; 25 form routes before | `forms.tsx` → `next-auth/react/index.js` | Community 2: 39 nodes, 14,290 mapped bytes in its optional region. One sync edge cuts all indexed paths; checked all 25 route root sets. | **Accepted module split**, not deletion. Keep auth on 3 required routes; detach from the other 22. Login, disabled state, callback arguments, profile write, store creation, ApiButton, logout and private-page guard tested. |
| Scanner parsing while scanner closed; `/merchant/reservations`, `/admin/reservations` | `pickup-scanner.tsx` → `lib/pickup-qr.ts` → Zod | Community 7 optional region. One-edge known-subgraph cut. 34,022 source-attributed bytes, but zero exact mapped detachable bytes; inlining mapping is unresolved. | **Deferred candidate.** Move scanner body/parser together behind open-triggered boundary; preserve camera permission, cleanup, QR validation, file scan, retries and focus. No change applied. Server pickup authorization must remain. |
| Collapsed report form; `/product/[id]` | `report-form.tsx` → `lib/report-validation.ts` → Zod | One-edge known-subgraph cut. 34,027 source-attributed bytes; exact identity attribution unresolved. Native closed `details` still mounts the form. | **Deferred candidate.** Load a form island only on disclosure interaction; check native keyboard behavior, draft retention, field errors and submit. Do not delete shared public validation. |
| Global search closed; `/`, `/explore`, `/markets` | `global-search.tsx` → `app-dialog.tsx` | One-edge cut in these scenarios: 3,427 exact mapped bytes plus 15,072 bytes of unresolved source mapping. Same edge alone is not feasible on `/login` or `/product/[id]`, because forms/contextual forms keep Dialog reachable. | **Deferred / partial cut rejected on shared routes.** Split search surface from trigger, not just a mount-time dynamic component. Check autofocus, Enter search, mobile keyboard, cancellation, Escape and focus restoration before accepting timing changes. |
| Merchant editors closed; `/merchant/products` | `merchant-product-manager.tsx` → `merchant-product-form.tsx`, `merchant-discount-form.tsx`, `inventory-controls.tsx` | 3 importer edges required. 37,471 exact mapped bytes and 4,426 unresolved source-attributed bytes in the investigated region. Alternate paths and erased `import type` edges checked. | **Deferred candidate.** All three editors are action-selected, but static imports are eager. Preserve uploads, pending/dirty guard, stock idempotency, reopen focus and discount state. No edit applied. |
| QR decoder | `pickup-scanner.tsx` → async `jsqr/dist/jsQR.js` | 45,891 source-attributed bytes; no synchronous path (cut cost 0). The one async graph edge matches both source imports. `Scanner` mounts only when open; its effect calls `start`, then imports `jsqr`; file scan imports it on file selection. | **Already deferred; rejected as new initial-load saving.** Do not count its full emitted size as eager cost. |
| React/Next router runtime | Bootstrap/framework roots | Large community 8, 171,785 mapped bytes, and runtime-linked community 3. Required initial runtime protected from cuts. | **Rejected.** Not an optional application feature; no framework compatibility rewrite. |
| Global CSS/fonts/polyfill | `src/app/layout.tsx` → `Mali`/`Kodchasan`, `globals.css`; Next generated polyfill | 28 font outputs have 340,644 attributed bytes, global CSS 16,737, polyfill 39,434. Output inclusion does not prove every font/polyfill is requested by a modern browser. Font weights/subsets are deliberate. | **Unchanged.** No unmeasured font removal, browser-compatibility removal or design changes. Separate browser request measurement and visual review required. |

Exact module identities above use the `[project]/` path prefix and `[app-client] (ecmascript)` suffix; all concrete variant identities, roots, outputs, source contributions, capacities and paths are retained in `cuts.json`, `attribution-mapping.json`, `communities.json` and the graph archives. Source checks cover static importers, conditionally rendered bodies, side effects and async triggers. No new async loading, idle preload or module side effect is introduced by the accepted change. Package inventory is saved in `resolved-packages.txt`; no duplicate shipped package version was established, so no dependency upgrade/dedupe was proposed.

## Client-dependency scan

Every exact emitted client member (including async outputs) and every attributed source path was scanned, not just top-ranked modules. Baseline: 330 exact emitted members / 452 JS-attributed paths (additional CSS/assets also scanned); after: 331 emitted members. Source `use server` directives and generated application Action-wrapper identities were reconciled: **0 application client-imported Server Actions**. Framework reference helpers are not application Actions.

Route sets: **A** = the 36 page routes listed in the route table above. **B** = the 25 baseline form-consuming routes listed in `comparison.json:auth_routes_before`. All exact affected routes and importers are enumerated in `client-dependency-scan.json` and `client-dependency-scan-after.json`.

An emitted identity in the table is exact; `inlined` means source contribution survives but the named module is not a direct output member, so no unique variant byte claim is made. Bytes are unique source-path compressed attribution, not separately gzipped module transfer.

| Source + client importer | Emitted identity | Routes before → after | Compressed bytes before → after | Disposition + evidence |
|---|---|---|---:|---|
| `node_modules/next-auth/client/_utils.js` ← `node_modules/next-auth/react/index.js [app-client] (ecmascript)` | `[project]/node_modules/next-auth/client/_utils.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 1,118 → 1,119 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next-auth/core/errors.js` ← `node_modules/next-auth/utils/logger.js [app-client] (ecmascript)` | `[project]/node_modules/next-auth/core/errors.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 1,331 → 1,333 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next-auth/react/index.js` ← `src/components/auth-buttons.tsx [app-client] (ecmascript)` | `[project]/node_modules/next-auth/react/index.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 3,194 → 3,190 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next-auth/react/types.js` ← `node_modules/next-auth/react/index.js [app-client] (ecmascript)` | `[project]/node_modules/next-auth/react/types.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 71 → 71 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next-auth/utils/logger.js` ← `node_modules/next-auth/react/index.js [app-client] (ecmascript)` | `[project]/node_modules/next-auth/utils/logger.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 1,022 → 1,023 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next-auth/utils/parse-url.js` ← `node_modules/next-auth/react/index.js [app-client] (ecmascript)` | `[project]/node_modules/next-auth/utils/parse-url.js [app-client] (ecmascript)` | B (25 form-consuming routes) → `/become-vendor`, `/login`, `/profile` | 260 → 272 | **suppressed** — Intentional browser authentication API or its browser dependency: forms.tsx imports signIn/signOut; source uses same-origin auth endpoints and public browser session/error helpers, not OAuth secrets or signing/storage implementation. |
| `node_modules/next/dist/build/polyfills/process.js` ← `node_modules/next-auth/react/index.js [app-client] (ecmascript)`; `node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)`; all 69 in scan JSON | `[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 114 → 114 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js` ← `node_modules/next/dist/client/components/router-reducer/router-reducer.js [app-client] (ecmascript)` | `[project]/node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 2,176 → 2,176 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/client/components/router-reducer/reducers/server-patch-reducer.js` ← `node_modules/next/dist/client/components/router-reducer/router-reducer.js [app-client] (ecmascript)` | `[project]/node_modules/next/dist/client/components/router-reducer/reducers/server-patch-reducer.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 552 → 552 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/client/components/server-async-storage.browser.js` ← `node_modules/next/dist/client/components/handle-isr-error.js [app-client] (ecmascript)`; `node_modules/next/dist/client/components/navigation-untracked.js [app-client] (ecmascript)`; all 3 in scan JSON | `[project]/node_modules/next/dist/client/components/server-async-storage.browser.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 241 → 241 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/compiled/process/browser.js` ← `node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)` | `[project]/node_modules/next/dist/compiled/process/browser.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 800 → 800 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.js` ← `node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)` | `[project]/node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 233 → 233 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `node_modules/next/dist/shared/lib/server-reference-info.js` ← `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js [app-client] (ecmascript)` | `[project]/node_modules/next/dist/shared/lib/server-reference-info.js [app-client] (ecmascript)` | A (all 36 page routes) → A (all 36 page routes) | 420 → 420 | **suppressed** — Next.js browser router/RSC context/reference metadata or browser process shim. Framework transport/runtime, not an application Server Action implementation or server-owned secret. |
| `src/components/auth-buttons.tsx` ← no indexed importer | `[project]/src/components/auth-buttons.tsx [app-client] (ecmascript)` | none → `/become-vendor`, `/login`, `/profile` | 0 → 722 | **suppressed** — Intentional client login/logout buttons moved unchanged from forms.tsx. Only signIn/signOut browser SDK calls with public callback paths; no secret, provider configuration or server implementation. |
| `src/lib/merchant-product-input.ts` ← `src/components/merchant-product-form.tsx [app-client] (ecmascript)` | Inlined attributed source; indexed identity in scan JSON | `/merchant/products`, `/merchant/products/[id]/edit`, `/merchant/products/new` → `/merchant/products`, `/merchant/products/[id]/edit`, `/merchant/products/new` | 2,675 → 2,675 | **suppressed** — Intentional public input validation: merchant draft/price/quantity/pickup-window validation; API independently validates writes. |
| `src/lib/pickup-qr.ts` ← `src/components/pickup-scanner.tsx [app-client] (ecmascript)` | Inlined attributed source; indexed identity in scan JSON | `/admin/reservations`, `/merchant/reservations` → `/admin/reservations`, `/merchant/reservations` | 566 → 566 | **suppressed** — Intentional public input validation: QR shape/version/length parsing; server independently validates reservation ownership and pickup. |
| `src/lib/report-validation.ts` ← `src/components/report-form.tsx [app-client] (ecmascript)` | Inlined attributed source; indexed identity in scan JSON | `/product/[id]` → `/product/[id]` | 288 → 288 | **suppressed** — Intentional public input validation: report reason text/length and messages shared by public form/API; no policy or secrets. |

### Possible server-only leaks

**None found in the supported client memberships or inspected attributed sources.** Application DB, Prisma/pg, AWS/S3 SDK, provider configuration, server authentication/query/service implementations and authorization enforcement are absent from client membership/attribution. This is a source/build ownership scan, not a complete audit of runtime serialized payloads or every potential secret.

### Suppressed matches

All table rows are intentional public/browser code: browser authentication controls/SDK, browser error/session helpers, public report/QR/merchant input validation and framework RSC/router/reference metadata/process shims. Public form schemas and verified browser API calls are not classified as leaks. No application Server Action stubs require a separate implementation-survival finding.

### Evidence gaps

- Non-chunk runtime/polyfill/font outputs do not enumerate module members. Their concrete output types and attribution remain recorded; unsupported application chunks were not found.
- Inlined/concatenated source attribution cannot always be assigned to exact variant identities. Unmapped or ambiguous weights are explicit in `coverage.json` and candidate accounting; they are not silently zeroed.
- API bootstrap entry classification is unknown for five entries, but there are no corresponding client outputs. No browser-load inference is made for those API entries.
- No controlled before/after production transfer, CPU, LCP or interaction-latency benchmark was performed. The measured improvements are analyzer attribution only. A fresh real Google account consent/callback round-trip was not executed; local tests intercept the authorization destination, while production OAuth configuration remains unchanged.

## Verification and risk review

- Focused test RED: the new auth-boundary regression test failed before implementation. GREEN: 6 focused tests passed. Full unit suite: **207 tests / 46 files passed**.
- TypeScript and ESLint passed after archiving historical ignored UI snapshot files (not application sources). An initial lint attempt included a copied analyzer UI; it was retained as a tar archive instead. No lint/type-check ignore configuration was changed.
- Production Docker build passed with the existing lockfile. No source/dependency/lock/config migrations. Authentication function bodies were compared byte-for-byte to the original exports; generic form code differs only by removal of those exports and the unused auth import.
- `next-dev-loop`: Next.js 16.4.3/Turbopack and agent-browser 0.39.1. All required MCP tools available; compilation issues and runtime errors checked. React tree and LoginButton props inspected. A cold compile initially exceeded the browser command timeout; reopening the same scoped session after compile succeeded.
- Browser assertions at 390/1440 pixels cover guest login/vendor controls and private route redirect. Additional local PostgreSQL-backed checks cover actual local NextAuth request/callback arguments (external Google destination intercepted), persistent profile edit, store creation, merchant ApiButton toggle, logout/session removal and authorized admin rendering.
- Local harness setup initially inherited an unrelated `APP_URL`, and the unchanged origin guard correctly returned 403. The test-only env was corrected to loopback; the guard and application configuration were not weakened.
- No backend trust boundary changed. No secrets in source, examples, report or git changes. No new loading timing, browser compatibility change, dependency or background preload. The split narrows where browser auth side effects can run. Further optional lazy-loading work is deliberately not included in this release.

## Release status

- Development browser checks: verified; evidence `browser-dev-results.json`.
- Production-built standalone browser checks: verified; evidence `browser-standalone-results.json`.
- Production app-only deployment: verified; evidence `deployed.json`.
- Live production read-only browser checks: verified; evidence `browser-production-results.json`.
- Local QA cleanup: verified; evidence `cleanup.json`.

Rollback command is prepared but was not executed on production. Rollback image for the app-only release: `imtor-app:search-cleanup-20261031-1`. No data rollback/migration is required. Do not touch the database, R2 or existing Tunnel. Use the same `.env.deployment`, `imtor-demo` project and app-only `--no-deps --no-build` Compose command with the previous image tag if rollback is needed.

## Reproduction artifacts

`artifacts/bundle-audit-20261031/`: `scope.json`, `before.jsonl.gz`, `after.jsonl.gz`, `summary.json`, `routes.csv`, `route-deltas.csv`, `comparison.json`, `roots.json`, `communities.json`, `cuts.json`, before/after client-dependency scans, source-preservation record, build/type/lint/unit logs, browser results, MCP/React inspection evidence and deployment/cleanup evidence. Graph and report scripts are retained there. Behavior checks passed; the accepted after snapshot is recorded as the next baseline in scope.json. No second optimization is attempted in this task.
