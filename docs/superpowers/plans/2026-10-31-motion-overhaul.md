# Motion Overhaul Implementation Plan

> Execute natively in this existing workspace. Follow the supplied implementation brief and the user's standing production direction.

**Goal:** Make existing ImTor interactions noticeably fluid without changing identity or business behavior.
**Architecture:** CSS tokens/keyframes own shared controls and Radix presence. Small native WAAPI islands own measured indicator motion, authoritative value feedback and gestures; existing RSC queries own data.
**Tech Stack:** Next16.4.3, React19.2.4, Bun, Radix, CSS, native WAAPI; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-31-motion-overhaul-design.md

## Global constraints

Thai UI; Mali/Kodchasan and incumbent colors. No backend/schema/infra/credentials changes. Never reintroduce category spinners/footer nav. Loopback _test DB only for mutation testing. Reduced motion and failed-JS content remain usable. At most two batched visual verification passes.

## Review focus

- Interrupted market requests: only committed label and matching data may change; latest navigation wins.
- Portal centering: independent animation must not overwrite Radix translations or header inset.
- Refresh: unchanged stock must not replay entrance or report success; only authoritative values animate.
- Gestures: dragging cannot select stalls, steal content scroll or dismiss dirty dialogs without existing confirmation.
- Reduced motion while an animation runs: cancel and render final visible state, with keyboard/focus intact.

### Task 1 — Shared motion and visible public feedback

Files: globals.css; ui/dialog,sheet,alert-dialog,dropdown-menu,select; marketplace.tsx; global-search; new change-feedback.tsx and lib/motion.ts; unit motion tests.
- [x] Add failing tests for motion bounds, reduced path, no looping decoration and feedback initialization.
- [x] Implement tokens, capped home/card entrances, independent overlay entry/exit, anchored dropdowns and search result feedback.
- [x] Preserve local component identity; wire confirmed inventory/status feedback without changing requests.
- [x] Run targeted tests and typecheck.

### Task 2 — Market and map continuity

Files: market-switcher.tsx; market-map-canvas.tsx/module.css; stall-map.tsx/module.css; new sheet-drag-handle.tsx; tests/unit/motion*.test* and motion browser coverage.
- [x] Implement cancellable native measured spring movement after committed market change; preserve week and server routing.
- [x] Animate complete map plane on button zoom, immediate pan and confined search focus. Keep geometry tests.
- [x] Add single selection acknowledgment/details transition and bottom-sheet handle with keyboard fallback.
- [x] Test repeated switching, interrupted movement and reduced preferences.

### Task 3 — Regression, visual inspection and release

Files: tests/e2e/motion-overhaul.py; docs/MOTION_OVERHAUL_REPORT.md; ignored artifacts/motion-overhaul.
- [x] Record baseline and isolated fixtures; run actual CRUD/upload/reservation/map flows against local _test DB.
- [x] Batch inspect all requested widths/zoom and normal/reduced motion. Measure geometry, animation frames/long tasks and bundle delta.
- [x] Fix concrete findings once, then final confirmation. Review connected callers for correctness/security/performance.
- [x] Run units/integrations, typecheck, lint and production image build.
- [x] Replace only app; verify health/environment and unchanged DB/Tunnel identities; public read-only smoke. Report external limits, no fresh OAuth claim without actual login.
