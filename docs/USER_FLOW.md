# User flow

## Customer (browse first)

1. Open `/` without signing in; search and filter ordinary, discounted and rescue products.
2. View `/markets` for database-configured dates/hours/status; choose a venue.
3. Open a store/product, read availability and find **market → zone → stall** on map or text list.
4. Use directions to the configured venue entrance, not an invented stall route.
5. Sign in with Google only for actions requiring an account, such as reserving.
6. Reserve when enabled and stock/pickup window permit it; receive the server-calculated price snapshot and pickup code.
7. Present code at pickup; merchant marks completed. Payment is arranged at pickup; no online payment claim is made.

Expired/cancelled reservations restore finite stock once. Scheduled reductions are not displayed as active before the effective instant. Ordinary products are never labelled rescued meals.

## Merchant

Google sign-in → create shop → select dated market attendance → choose stall → enter product image/name/category/price → optionally add finite inventory, reservation/pickup fields, rescue information or discount → publish. Advanced settings are optional; a normal full-price item needs no discount. A user can be both customer and merchant.

A merchant manages only owned/delegated stores. Uploads must finish server inspection/re-encoding before their approved URL is attached to a product. Attendance registration does not automatically imply actual open or admin-verified location. View reservations, confirm pickup, update stock and mark attendance appropriately.

## Administrator

Sign in with an operator-allowlisted Google account → protected admin dashboard → configure venue, zones/stalls/layout, weekly/alternating schedule and exceptions → review session calendar → moderate stores/products/reports → manage assignments → view persisted analytics. Verification is explicitly administrative, not merchant self-certification.

On an isolated demo installation only, generate a labelled fictional batch and later clean up that exact batch. Real data and real users' dependent reservations must be protected. Demo totals are displayed separately from genuine pickups/savings. User management and settings do not replace server-side role checks.

## Failure and accessibility behavior

Show clear validation/auth/conflict feedback; do not show success before the write commits. Preserve entered fields after recoverable failures. Every form needs labels, keyboard focus and readable error text. Map actions have a text alternative, touch targets remain usable on small screens, and disabled/unknown availability is not presented as confirmed stock.
