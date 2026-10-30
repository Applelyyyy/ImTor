# ImTor motion overhaul

## Intent and authority

Implement the supplied Motion Design Overhaul brief in the existing app, not a replacement identity or business feature. The user has already directed that requested changes go to production. Keep the removed category spinner and footer navigation removed. This design records engineering choices, not additional user promises.

## Incumbent design and boundaries

Operate mode: Thai campus shopping, reservations, merchant work and admin. Keep paper #fff9f0, surface #fffdf8, ink #23352b, leaf #267a4a, rule #e2e6da and amber #d77724. Mali remains expressive type; Kodchasan remains controls/body. Keep existing left-aligned content, centered category pills and fixed header; no layout redesign.

Server pages and queries remain server components. Small client islands own measured selection, camera-independent UI feedback and gestures. No backend, schema, credentials, OAuth, R2 infrastructure or Tunnel changes. Only replace the app container after a successful build. All mutation regression tests use a loopback database ending in _test; live discovery and final public smoke are read-only.

## Approaches

1. CSS only: small bundle, but cannot preserve interrupted, measured tab movement or gesture continuity well.
2. CSS plus native Web Animations API (chosen engineering approach): reuse Radix presence for exits; native cancellable motion for dynamic selection and gestures. No new package.
3. Motion library: useful for a full choreography platform, but adds a new runtime for this bounded incumbent refinement. Not chosen.

## Motion thesis

Focal interaction: choose a market, then find a merchant on its physical stall map. The committed market indicator moves with restrained spring settling; the market label and server data commit together. Stall selection gives an immediate amber response and a nearby details transition. The map itself never drifts away from its markers.

Continuity: retain the server's committed label during requests; animate only after authoritative content arrives. Button zoom uses a bounded FLIP transform of the complete coordinate plane. Native smooth scrolling focuses a searched stall only inside its viewport. Pointer pan remains immediate and cancels an in-progress focus movement.

Feedback: cards lift 2–3px only with a fine pointer, image zoom stays clipped, touch has press feedback. Search results, confirmed stock/status changes, upload preview and successful saves give one short acknowledgment. No success or quantity is invented before the existing backend confirms it.

Home receives one capped welcome sequence: heading, search, today's market and the first visible product group. It does not replay on filter updates or stock refreshes. No animated table rows, global route wrapper, new loading spinner or constant decoration.

## Tokens and components

Keep existing micro tokens 110ms/140ms. Standard interactions use 180–220ms. Expressive dialogs/sheets use 240–280ms, exit 160–180ms. Enter easing cubic-bezier(0.215,0.61,0.355,1), visible movement cubic-bezier(0.645,0.045,0.355,1), hover/color ease. One shared bounded spring sampler supplies WAAPI frames for measured movement and gesture snapback; no React updates per animation frame.

Reuse Radix data-state/data-side and transform origins. Animate dialog scale independently from centering transforms, and sheet slide independently from content layout. Keep scroll-lock/header inset, modal focus, Escape, outside dismissal and unsaved-form protection intact. A bottom-sheet drag handle has a keyboard action and never steals scrolling from the body content.

A small ChangeFeedback island responds to changes in confirmed values, never first render. Existing component/DOM identity remains stable during refresh. Product entrance is limited to the first eight cards and no more than 140ms total delay.

## Accessibility and budgets

Reduced motion immediately shows the final state; disables spatial CSS/WAAPI animations and smooth focus scrolling. Selection, text, live regions and color still communicate the result. No permanent will-change, blur, infinite decoration or route delays. All animations are interruptible or bounded; camera and business behavior are unaffected.

Verify 360,390,768,1024,1440px and browser zoom 100/110/125%. Measure actual animation timelines, stable shell geometry, layout shifts, frame intervals and long tasks without claiming physical-device FPS. Record desktop/mobile before/after and reduced-motion behavior in two bounded review passes: batch inspect, one repair batch, final confirmation.

## Acceptance

Run unit/integration regressions, typecheck, lint, production build and real-browser workflows: homepage/feed/detail; committed market switching including rapid requests; both market maps; search/focus/zoom/pan; merchant creation/edit/upload/stock; admin CRUD/dialog/dropdown/toasts; mobile sheets and keyboard focus. Separate local fake-auth fixtures from real Google login and R2/domain verification. Report what was actually checked and every external limitation.
