What this change does: It adds a consistent motion language to ImTor without a new animation package. Public shopping gains bounded entrances and responsive cards. Market selection, map focus, shared overlays and confirmed stock changes communicate what the user actually changed.

The review assumes the existing single Next.js application and a classroom-sized presentation audience. It traced server/client boundaries, public and private callers, Radix presence, scroll locking, map coordinates, native animation cancellation, stock request handling and browser regressions. No business write logic changed.

## Must fix — resolved

1. **Reset view restored the previous pan** (`src/components/market-map-canvas.tsx`, `changeZoom` and layout effect)
   - **What this is:** Button zoom preserves the current map center through a transform animation.
   - **Problem:** The previous handler scrolled to zero, then the layout effect restored the old scaled center. A browser check settled at scrollLeft134 rather than0.
   - **Fix:** Carry the explicit reset intent into the layout effect and do not requeue unchanged selected-marker centering during zoom.
   - **If we skip it:** “คืนมุมมอง” does not return to the starting view.

2. **A stall selected during zoom never received focus scrolling** (`src/components/market-map-canvas.tsx`, pending centering)
   - **What this is:** Search selection normally focuses the chosen stall inside the map viewport.
   - **Problem:** The zoom guard discarded that request. A browser check recorded no scrollTo call after selection or settlement.
   - **Fix:** Queue only the latest requested center and apply it after the current animation. Intentional pan clears the queue. Old animation completion cannot finish a newer animation's state.
   - **If we skip it:** Details may name a selected merchant whose stall remains offscreen.

## Should fix — resolved

3. **Changing reduced-motion preferences did not stop native focus scrolling** (`src/components/market-map-canvas.tsx`, preference listener)
   - **What this is:** Native smooth scrolling helps locate a searched stall.
   - **Problem:** Checking the preference only when starting the scroll ignored a change during playback. The independent review observed continued movement after the preference changed.
   - **Fix:** Listen for the change and immediately apply the final focus position. Native WAAPI animations also cancel on preference changes and remove their listeners when settled.
   - **If we skip it:** Mid-animation reduced-motion acceptance remains unmet.

4. **Reduced-motion hover rules lost to later selectors** (`src/app/globals.css`, final reduced-motion overrides)
   - **What this is:** Desktop card lift, image zoom and button presses have spatial feedback.
   - **Problem:** Earlier reduced-motion resets had lower specificity than the new hover/press rules. The browser measured a3px lift and1.025 image scale even with reduced motion enabled.
   - **Fix:** Match the action selectors in the final reduced-motion block. The focused built-image regression now measures transform:none for the card, image and pressed button.
   - **If we skip it:** The reduced-motion setting disables timelines but still moves content on interaction.

## Other reviewed boundaries

- RetainedDialogBody freezes only the last open contents during closing. Radix still owns portal presence, focus, Escape and outside dismissal. The body has no wrapper DOM that could interfere with layout.
- Shared dialog scale is independent from centering translations. Directional sheets emit data-side. Competing Tailwind animation utilities were removed rather than layered beneath another runtime.
- The market indicator follows committed server props, not an optimistic new label over stale results. Its native spring is sampled once. No React state changes happen on animation frames.
- Button zoom transforms the whole coordinate plane; markers and the image cannot animate on different planes. Pointer pan is immediate. Clustered stalls retain existing IDs and coordinate grouping.
- Stock/status feedback reads confirmed values only and skips mount or identical values. Upload phases, request locks, idempotency and error recovery remain existing behavior.
- The drag handle alone owns pointer gestures. Sheet contents keep their native scrolling; a Thai-labelled button provides a keyboard dismissal path.
- No schema, API, auth, credential or cloud infrastructure change. No new dependencies, permanent will-change, large-area blur or decorative loops.

The first merchant test run hit a five-second assertion while a concurrent production build was running. The full fifteen-second rerun passed stock-zero, tracking-off and every other check; no product-code fix was indicated by that timing failure.

Verdict: Ship. Final built-image motion confirmation and the focused reduced-motion regression passed.

Not checked: Physical mobile hardware, fresh Google consent and large-load behavior. External media and domain verification are reported separately from isolated local S3 tests.
