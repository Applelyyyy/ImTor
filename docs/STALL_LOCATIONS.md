# Stall locations

The hierarchy is **MarketVenue → MarketZone → MarketStall**. A store does not own a permanent global stall: StoreAttendance connects it to a dated market session, and StallAssignment provides its stall and occupied interval. One store can sell in a different venue tomorrow without creating a new shop account.

## Map and navigation

Marker coordinates `x`/`y` are normalized to the layout bounds (0–1), validated and rendered responsively. Admins can configure a layout image and markers; the text stall list remains a keyboard/screen-reader alternative. A selected marker exposes stall code, zone, attending vendor and directions. Color alone is not the selection/status indicator. Maps must remain usable on mobile and at zoom.

Venue latitude/longitude or a configured entrance supports a Google Maps deep link. The link navigates to the **venue/entrance**, not an unverified precise walking route to internal stall B12. If coordinates are missing, don't invent them. Fictional layouts must be visibly labelled; demo venue coordinates must not imply a real verified campus.

## Assignment integrity

Authorize the store owner/member (or admin) before mutation. Check stall active state, matching venue/zone, valid attendance/session, and positive occupied interval. Prevent overlapping claims for the same stall **across all sessions**, not merely duplicate rows in one session. Adjacent half-open intervals can share a boundary; overlapping intervals cannot. Distinguish admin-verified from merchant-self-reported assignments. A merchant cannot grant its own verification badge.

Admin corrections must persist and be audited; a store template is only a convenience for a future attendance form, never a claim that a stall is reserved. Cancellation should no longer advertise current attendance. Public store/product location summaries must follow the relevant attendance/session and never show a stale assignment as confirmed open.
