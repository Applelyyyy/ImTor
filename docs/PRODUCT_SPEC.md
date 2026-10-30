# CODEX MASTER PROMPT — ImTor 2.0
## Campus Marketplace, Market Schedule, Stall Locator & Food Rescue
### Full-Stack Next.js · Monorepo · Docker Compose · Self-Hosted VM · PostgreSQL · S3 · Google OAuth

---

# 0. YOUR ROLE

You are a principal full-stack engineer, software architect, product designer, UI/UX specialist, database engineer, DevOps engineer, and quality assurance engineer.

Your mission is to build a complete, functional, beautiful, user-friendly web application named **ImTor (อิ่มต่อ)**.

This application will be demonstrated in a Web Programming interview.

It must demonstrate strong technical ability, thoughtful software architecture, a polished user experience, and meaningful real-world usefulness.

**Do not create only a prototype, static landing page, or frontend with mocked API endpoints.**

Build a working application with actual backend functionality, authentication, persistent database, administrative management, and Docker-based deployment.

Use available engineering, frontend design, security, browser testing, and deployment skills where appropriate.

Inspect the repository before modifying code.

If the repository is empty, initialize the complete project.

If it already contains relevant working code, preserve and extend it.

Do not stop at planning or scaffolding. Implement and verify the application.

---

# 1. PRODUCT IDENTITY

**Application name:** ImTor

**Thai name:** อิ่มต่อ

**Main tagline:** อิ่มด้วยกัน ไม่เหลือทิ้ง

**English tagline:** Discover More. Spend Less. Waste Less.

**Product category:** Campus Marketplace & Community Food Rescue Platform

## Product vision

ImTor is a campus-focused marketplace that helps students discover what nearby merchants are selling, where their shops are located, which campus markets are operating today, and whether any products are available at discounted prices.

The platform combines three primary functions:

1. A regular marketplace for everyday products.
2. A campus market discovery and vendor location system.
3. A food rescue and scheduled-discount marketplace.

**Important: ImTor is NOT exclusively for leftover food.**

It must support completely ordinary, full-price product listings.

Food rescue is an additional feature, not the sole purpose of the application.

### Main audiences

- University students.
- University staff.
- Everyday customers.
- Food vendors.
- Campus market merchants.
- Small independent sellers.
- Coffee and bakery shops.
- Temporary pop-up stalls.
- Permanent campus shops.
- Marketplace administrators.

The application should begin with a university community but be extensible to additional markets and campuses.

Do not hardcode any particular university, market name, or campus into the system.

---

# 2. THE CENTRAL PRODUCT PRINCIPLE

**The entire application must prioritize simplicity over feature quantity.**

A student should be able to answer these questions immediately:

- What is available to buy today?
- Which market is open today?
- Is it the small market or the large market?
- Which vendors are selling there?
- What does each vendor sell?
- Where exactly is the vendor's stall?
- How do I navigate there?
- Is the item discounted?
- Can I reserve it?

A vendor should be able to:

- Log in using Google.
- Create a shop.
- Select the market where they are selling.
- Identify their stall.
- Upload a product photo.
- Enter a product name and price.
- Publish the listing.

All of this should require minimal training.

The admin should have complete management capabilities without burdening customers or merchants with advanced interfaces.

## Design philosophy

- Browse first, authenticate only when necessary.
- One account can be a customer and merchant.
- Few steps, few fields, clear actions.
- Progressive disclosure of advanced settings.
- Sensible defaults.
- Mobile-first.
- Reusable templates.
- No unnecessary popups.
- No confusing technical terminology.
- No forced dashboard for casual customers.
- No mandatory online payment system.
- No mandatory AI features.
- Clear distinction between scheduled and actually confirmed open stores.
- Never display misleading product availability or discount information.

---

# 3. CORE PRODUCT MODULES

Implement these interconnected modules:

1. Public Marketplace.
2. Campus Market Discovery.
3. Market Calendar and Schedule.
4. Market Stall Location and Navigation.
5. Merchant Registration.
6. Merchant Shop Management.
7. Product Listings.
8. Normal Selling and Scheduled Discounts.
9. Food Rescue Listings.
10. Inventory Management.
11. Optional Product Reservation.
12. Google OAuth Authentication.
13. Customer Accounts.
14. Admin Dashboard.
15. Market and Stall Management.
16. Admin Demo Data Generator.
17. Analytics and Impact Dashboard.
18. S3 Image Storage.
19. Docker-Based Self-Hosted Infrastructure.

All modules must use a shared backend and database.

---

# 4. MANDATORY TECHNICAL ARCHITECTURE

## Single repository, single full-stack application

Use a single Git repository.

Use Next.js App Router for frontend and backend.

Do not build separately deployed frontend and backend applications.

The complete application must contain:

- Public frontend.
- Merchant frontend.
- Admin frontend.
- Backend services.
- REST API.
- Authentication.
- Database integration.
- Business logic.
- Validation.
- Authorization.

All API endpoints must be served by the same Next.js application.

Do not create separate Express, NestJS, or Elysia application servers.

## Preferred technology stack

| Component | Technology |
|---|---|
| Full-stack framework | Next.js App Router |
| Frontend | React + TypeScript |
| Backend | Next.js Route Handlers and Server Actions |
| UI system | shadcn/ui |
| Styling | Tailwind CSS |
| Icons | Lucide |
| Forms | React Hook Form |
| Validation | Zod |
| Authentication | Auth.js + Google OAuth |
| Database | PostgreSQL |
| ORM | Prisma |
| Image storage | Cloudflare R2 / AWS S3 |
| S3 SDK | AWS SDK v3 |
| Package manager | Bun |
| Runtime | Compatible stable Node.js LTS |
| Deployment | Docker Compose |
| Reverse proxy | Caddy or existing reverse proxy |
| Testing | Vitest + Playwright |
| Hosting | My own Linux VM |

Use current stable compatible versions.

Check official documentation for compatibility before implementing.

## Infrastructure

The application will run on my own VM.

Required Docker services:

- `app`: Full-stack Next.js application.
- `db`: PostgreSQL.
- `caddy`: HTTPS reverse proxy, when needed.
- `migrate`: One-off database migration task.

Use an external S3-compatible storage service for product and store images.

Do not require:

- Vercel.
- Netlify.
- Supabase.
- A managed cloud database.
- A separate backend server.
- Kubernetes.
- Redis unless a verified requirement justifies it.
- Additional infrastructure that is unnecessary for an MVP.

---

# 5. PUBLIC MARKETPLACE — CUSTOMER EXPERIENCE

## Main objective

A visitor opens ImTor and immediately sees useful information.

The homepage must answer:

**"วันนี้มีอะไรขายบ้าง?"**

### Main homepage

The homepage should include:

1. Compact header with ImTor logo.
2. Search bar.
3. Today's campus market status.
4. Market selection.
5. Product feed.
6. Active discounts.
7. Nearby or selected-market vendors.
8. Minimal navigation.

Suggested headline:

**"วันนี้กินอะไรดี? ตลาดไหนเปิดบ้าง?"**

Suggested subtitle:

"ค้นหาร้านค้า อาหาร และของน่าซื้อในมหาวิทยาลัยได้ง่าย ๆ ในที่เดียว"

## Market status hero

Display a compact, informative market status section.

Example:

**ตลาดวันนี้**

ตลาดใหญ่

เปิด 16:00–21:00 น.

ร้านค้าที่ลงทะเบียน 24 ร้าน

[ดูร้านค้าทั้งหมด] [ดูแผนผังตลาด]

If both market types operate on the same day, display both.

If no market is operating:

"วันนี้ไม่มีตลาดนัดตามตาราง"

"ดูตลาดครั้งถัดไป"

Do not show a market as open unless its actual schedule and relevant status support that claim.

## Marketplace navigation

Keep customer navigation simple:

- หน้าแรก
- ตลาดวันนี้
- ค้นหา
- การจอง
- โปรไฟล์

Provide a clear but unobtrusive "เปิดร้านค้า" action.

Guests must be able to browse without logging in.

## Product discovery

Show a feed containing:

- Regular-price products.
- Discounted products.
- Food rescue items.
- Products sold at current market sessions.
- Products from permanent stores.

Users must be able to distinguish these categories.

Use simple filters:

- ทั้งหมด
- ขายอยู่ตอนนี้
- อาหารและเครื่องดื่ม
- สินค้าทั่วไป
- ลดราคา
- ตลาดเล็ก
- ตลาดใหญ่

Do not overwhelm the interface with dozens of filters.

## Product cards

Each product card should show:

- Product photo.
- Product name.
- Current selling price.
- Store name.
- Location summary.
- Availability.
- Discount badge, when applicable.

Examples:

**ข้าวกะเพราไก่ — ฿50**

ร้านครัวอิ่มใจ

ตลาดใหญ่ · โซน B · ล็อก B12

**ชานมไข่มุก — ฿35**

ร้านชานมคุณดาว

ตลาดเล็ก · ล็อก A05

**ขนมปัง — ฿15**

ราคาปกติ ฿30

ลดแล้ว 50%

Do not use discount labels for ordinary full-price listings.

Never label normal products as "food rescued."

---

# 6. CAMPUS MARKET DISCOVERY — CORE FEATURE

This is one of the most important and distinctive features of ImTor.

Campus markets may operate in different areas on different days.

For example, a university may have:

- Small Market.
- Large Market.

These markets may alternate during the week or follow different schedules on alternating weeks.

The system must support configurable schedules.

**Do not assume that the real university market schedule is already known.**

Store the schedules in the database and allow administrators to configure them.

## Market types

Support at least:

### Small Market

Thai display name:

"ตลาดเล็ก"

Possible characteristics:

- Fewer stalls.
- Smaller market layout.
- Separate location.
- Independent opening schedule.

### Large Market

Thai display name:

"ตลาดใหญ่"

Possible characteristics:

- More stalls.
- Multiple zones.
- Larger market layout.
- Independent opening schedule.

### Extensibility

The database must support additional markets in the future.

Do not use a hardcoded enum that makes only two markets possible forever.

Implement configurable market venues, with Small Market and Large Market as initial types or sample records.

---

# 7. MARKET SCHEDULE MANAGEMENT

Create a real scheduling system.

## Requirements

Admins must be able to define:

- Market name.
- Market type.
- Market location.
- Operating days.
- Opening time.
- Closing time.
- Timezone.
- Recurrence.
- Special dates.
- Cancellations.
- Temporary closures.
- Exceptions to normal schedules.

### Example demo schedule

The following is SAMPLE DATA ONLY, not a claim about the actual university.

| Day | Market |
|---|---|
| Monday | Small Market |
| Tuesday | Large Market |
| Wednesday | Small Market |
| Thursday | Large Market |
| Friday | Large Market |
| Saturday | No Market |
| Sunday | No Market |

These rules must be editable through Admin.

The system must also support biweekly alternation, such as:

- Week A: Small Market on Wednesday.
- Week B: Large Market on Wednesday.

Use an explicit recurrence anchor date to avoid ambiguous even-week/odd-week calculations.

### Schedule engine

Implement a dedicated service:

`MarketScheduleService`

Responsibilities:

- Determine today's scheduled markets.
- Determine currently active market sessions.
- Determine the next scheduled session.
- Handle recurring weekly rules.
- Handle alternating-week rules.
- Handle holidays.
- Handle exceptions.
- Handle cancellation.
- Handle timezone boundaries.
- Handle sessions crossing midnight where relevant.

Use Asia/Bangkok as the initial default timezone.

Store timestamps consistently and calculate local calendar dates correctly.

Do not rely on the browser's clock for authoritative market status.

### Admin schedule editor

Admins should be able to:

1. Select a market.
2. Choose operating days.
3. Configure hours.
4. Configure recurrence.
5. Add special closures.
6. Add one-time market events.
7. Preview the resulting calendar.
8. Save changes.

All schedule changes must persist to PostgreSQL.

---

# 8. MARKET CALENDAR

Create a customer-facing page:

`/markets`

Features:

- Today's markets.
- Upcoming market sessions.
- Small/Large Market filters.
- Simple week calendar.
- Market opening hours.
- Vendor counts.
- Links to each market.

Suggested UI:

**ตลาดในสัปดาห์นี้**

Monday — ตลาดเล็ก

Tuesday — ตลาดใหญ่

Wednesday — ตลาดเล็ก

Thursday — ตลาดใหญ่

Friday — ตลาดใหญ่

Highlight the current date.

Allow users to navigate to the next week.

Distinguish:

- Scheduled.
- Open.
- Closed.
- Cancelled.
- Finished.

The week calendar must come from actual schedule data.

---

# 9. MARKET STALL LOCATION SYSTEM

**This is a flagship ImTor feature.**

A student must be able to find a particular vendor's market stall easily.

Example:

ร้านข้าวมันไก่ป้าดาว

ตลาดใหญ่

โซน B

ล็อก B12

## Market hierarchy

Design location data around:

**Market → Zone → Stall**

Example:

- Market: Large Market.
- Zone: B.
- Stall: B12.

Another example:

- Market: Small Market.
- Zone: A.
- Stall: A05.

Each market may have a different layout.

## Market information

Store:

- Market name.
- Market description.
- Physical address.
- Latitude.
- Longitude.
- Market entrance information.
- Optional map image.
- Zone information.
- Stall arrangement.
- Opening schedule.

## Stall information

Store:

- Stall ID.
- Market ID.
- Zone ID.
- Stall code.
- Display label.
- Relative map position.
- Active/inactive status.
- Optional descriptive directions.

Examples:

- A01.
- A02.
- A03.
- B11.
- B12.
- B13.

## Interactive stall map

Create an accessible, responsive stall map.

The map should:

- Show market zones.
- Show stall codes.
- Show registered vendors.
- Highlight the selected vendor.
- Allow tapping a stall.
- Work on mobile.
- Allow basic zooming where useful.
- Provide a text-based stall list as an accessible alternative.

Avoid requiring paid map infrastructure.

Use a configurable SVG or lightweight map representation where practical.

Admins must be able to upload a market layout image and position stall markers on it.

Store normalized marker positions so the layout remains responsive.

Do not invent actual real-world stall locations.

For the interview, generate a clearly labeled sample market layout.

## Important navigation distinction

Google Maps can navigate customers to the market venue or configured entrance.

The internal ImTor stall map identifies the stall inside the market.

Do not pretend that a precise Google Maps route to stall B12 exists unless verified geographic coordinates are genuinely available.

### Vendor details

Show a clear location section:

"ร้านนี้อยู่ที่ไหน?"

**ตลาดใหญ่ → โซน B → ล็อก B12**

Actions:

- ดูแผนผังตลาด
- นำทางไปตลาด

Use Google Maps deep links for navigation to the market entrance.

---

# 10. VENDORS CAN CHANGE MARKET LOCATIONS

Merchants may sell at different markets on different days.

For example:

Monday:

ร้าน A sells at Small Market, stall A05.

Tuesday:

The same store sells at Large Market, stall B12.

Wednesday:

The store is not attending a market.

The system must support this without forcing the merchant to create separate shop accounts.

## Store attendance

Implement merchant participation records for individual market sessions.

Suggested relationship:

`Store → MarketSession → StallAssignment`

A merchant can set:

- Market session.
- Stall location.
- Attendance status.
- Expected arrival.
- Selling hours.
- Whether they are selling today.

### Required functionality

- Select today's market.
- Select a stall.
- Mark attendance.
- Change stall assignments when permitted.
- Cancel an upcoming appearance.
- View future scheduled appearances.
- Reuse previous stall assignments.

## Stall occupancy integrity

Prevent two merchants from receiving conflicting confirmed assignments for the same stall during overlapping market sessions.

Use database-level constraints or transaction-safe conflict detection.

### Self-service stall claims

For the demo, allow vendors to select a stall not already claimed in ImTor for the session.

However:

- A stall being unclaimed in ImTor does not prove it is physically vacant.
- Ask merchants to confirm that they are authorized to use the chosen stall.
- Label self-reported stall locations appropriately.
- Allow admins to verify or correct assignments.
- Do not describe self-reported locations as officially verified.
- Prevent contradictory assignments within the platform.

The workflow should still be simple for vendors.

For future real-world operation, support administrator or market-operator approval of stall assignments.

---

# 11. "IS THIS STORE OPEN TODAY?" SYSTEM

A vendor's store may exist permanently, but the vendor may not attend every market session.

Create accurate merchant availability states.

Suggested statuses:

- Scheduled.
- Open / Confirmed Present.
- Closed.
- Not Attending.
- Cancelled.
- Not Yet Confirmed.

### Rules

A store must not appear as definitely open simply because it has an active account.

Consider:

1. Market schedule.
2. Store attendance schedule.
3. Current time.
4. Vendor's explicit open/closed status.
5. Market session cancellation.
6. Optional admin overrides.

### UX

Example:

**ร้านข้าวมันไก่ป้าดาว**

"วันนี้เปิดที่ตลาดใหญ่"

"โซน B · ล็อก B12"

If scheduled but not confirmed:

"ร้านมีกำหนดออกวันนี้"

"ยังไม่ได้ยืนยันว่าเปิดแล้ว"

If not attending:

"วันนี้ร้านไม่มาออกตลาด"

If closed:

"ปิดแล้ว"

Avoid displaying inaccurate real-time status.

### Merchant quick action

Provide a large and simple control:

**"วันนี้เปิดร้าน"**

And:

**"ปิดร้านแล้ว"**

The vendor should not need to navigate through advanced settings to update today's presence.

Make the difference between scheduled attendance and vendor-confirmed opening clear.

---

# 12. REGULAR SALES AND FOOD RESCUE

Support three separate product modes.

## Mode A — Regular Sale

The merchant sells products at the normal price.

Example:

Product: ชาไทย

Price: 35 THB

No discounts.

No food rescue label.

This is an ordinary listing.

## Mode B — Scheduled Discount

The merchant sells normally but configures a price reduction at a particular time.

Example:

Product: ข้าวหมูทอด

Normal price: 100 THB

Discount begins: 19:00

Final discounted price: 30 THB

The system must switch to the discounted price automatically when appropriate.

## Mode C — Food Rescue

The merchant marks an eligible food listing as surplus food.

Example:

Product: ขนมปังอบ

Normal price: 40 THB

Rescue price: 15 THB

Collection before: 20:00

Clearly indicate that the listing is intended to reduce food waste.

Do not automatically categorize every discounted product as surplus food.

### Product categories

Support:

- Meals.
- Snacks.
- Drinks.
- Bakery.
- Groceries.
- Market goods.
- Other.

The application should primarily focus on food and campus-market products, but its schema should not prevent other appropriate goods.

Food-specific fields, such as allergen and storage information, should appear only when applicable.

---

# 13. SCHEDULED PRICING ENGINE

Implement:

`PricingService`

The pricing engine must support:

- Normal prices.
- Fixed discounted prices.
- Percentage discounts.
- Final price as a percentage of original price.
- Scheduled activation.
- Scheduled expiration.
- Optional repeating discount windows.
- Vendor-specific rules.
- Default system-wide rules.

### Example

Normal price: 100 THB.

At 19:00, final price becomes 30% of normal price.

Calculation:

100 × 0.30 = 30 THB.

This is a 70% discount.

The UI must not mistakenly label this as "30% off."

### Pricing requirements

- Server-authoritative price calculation.
- Asia/Bangkok default timezone.
- Correct time boundaries.
- Midnight-crossing support.
- No negative price.
- No floating-point money errors.
- Correct cache invalidation.
- No cron job required simply to determine the current price.
- Correct price snapshot when creating reservations.
- Clear distinction between scheduled and active discounts.
- Deterministic resolution or validation of overlapping discount rules.

### Suggested UI

Before discount:

"ราคาปกติ ฿100"

"19:00 น. เหลือ ฿30"

After discount:

"฿30"

"จาก ฿100"

"ลด 70%"

Make the discount behavior extremely easy to understand.

---

# 14. MERCHANT REGISTRATION — MINIMAL FLOW

Anyone who logs in with Google can create a shop.

A single account can be both customer and merchant.

Do not create a separate merchant login system.

## Merchant onboarding

Aim for a short process with very few required fields.

### Step 1 — Create store

Ask:

- Store name.
- Optional store photo.

Optionally collect a short description.

### Step 2 — Where do you sell?

Offer:

1. Campus Market.
2. Permanent Store.
3. Both.

If Campus Market:

- Choose market.
- Choose session/date.
- Choose zone.
- Choose stall.

If Permanent Store:

- Enter address.
- Optionally provide coordinates.

If Both:

Allow both permanent location and market attendance.

### Step 3 — Post first product

Ask:

- Product photo.
- Product name.
- Price.

Optional advanced fields:

- Quantity.
- Description.
- Discount.
- Availability.
- Reservation.
- Product category.
- Food-related information.

Publish the listing and show it in the appropriate marketplace.

### Demo onboarding behavior

For the MVP demo:

- Store creation is immediate.
- Listings can be published immediately.
- Unverified merchants are labeled clearly.
- Admin can moderate or suspend stores.
- Stall assignments may be self-reported.
- Do not falsely imply official stall verification.

Allow stricter approval settings for future deployment.

---

# 15. MERCHANT DASHBOARD — EXTREMELY SIMPLE

The merchant dashboard must not resemble a complicated ERP.

Suggested route:

`/merchant`

### Main dashboard

Show:

- Store name.
- Today's market.
- Stall location.
- Opening status.
- Current products.
- Active reservations, if any.
- Add product button.

Example:

**สวัสดี ร้านป้าดาว**

วันนี้ขายที่:

ตลาดใหญ่ · โซน B · B12

สถานะ:

เปิดร้านแล้ว

Primary action:

**"+ ลงสินค้าใหม่"**

Secondary actions:

- สินค้าของฉัน
- ตารางออกร้าน
- การจอง
- ตั้งค่าร้าน

### Easy product posting

The default form should be short.

Required:

- Photo.
- Product name.
- Price.

If the vendor wants reservation-enabled inventory, ask for quantity and pickup conditions.

If the product is browse-only, allow quantity to be omitted.

Do not invent stock values for browse-only products.

### Listing selling modes

Provide two options:

**Show Only**

Customer can view the product and navigate to the vendor.

No online reservation.

**Reserve for Pickup**

Customer can reserve a quantity.

Requires managed inventory and pickup settings.

Use Show Only as the easiest default for ordinary marketplace sellers.

### Merchant product management

Support:

- Create.
- Edit.
- Archive.
- Publish/unpublish.
- Duplicate.
- Set availability.
- Update stock when applicable.
- Configure discounts.
- View reservations.

Implement:

**"ลงขายอีกครั้ง"**

This should reuse a previously published product's information.

---

# 16. MARKET ATTENDANCE — SIMPLE MERCHANT WORKFLOW

Create a dedicated page:

`/merchant/schedule`

The merchant should see a simple upcoming-week view.

Example:

Monday — ตลาดเล็ก

Tuesday — ตลาดใหญ่

Wednesday — ตลาดเล็ก

Thursday — ตลาดใหญ่

Provide a simple action:

"ฉันจะไปขายวันนี้"

After selecting a market session:

1. Select the stall.
2. Confirm attendance.
3. Save.

Allow recurring attendance templates.

Example:

"ขายทุกวันอังคารที่ตลาดใหญ่"

However, actual stall allocation still needs valid session-level assignments.

Do not assume a stall remains assigned forever merely because the merchant used it previously.

### Quick change

If the merchant moves from B12 to B15:

- Update the correct market session.
- Validate assignment.
- Update the customer's displayed location.
- Record the change.
- Avoid stale map information.

Provide clear feedback.

---

# 17. STORE AND MARKET PAGES

## Public store page

Route:

`/store/[slug]`

Display:

- Shop photo.
- Shop name.
- Description.
- Products.
- Today's attendance.
- Current market.
- Zone and stall.
- Opening status.
- Upcoming attendance.
- Navigation.

Keep the page minimal.

## Public market page

Route:

`/markets/[slug]`

Display:

- Market name.
- Market type.
- Today's operating status.
- Operating hours.
- Market location.
- Market layout.
- Vendors selling today.
- Product previews.
- Search vendors.
- Navigate to market.

## Market session page

Provide a session-specific view where necessary.

For example, visitors should be able to inspect the vendors attending next Tuesday's large market without confusing them with today's vendors.

Clearly distinguish planned attendance from confirmed presence.

---

# 18. CUSTOMER RESERVATIONS

Reservations are optional at the listing level.

Some vendors only want customers to discover products and visit their stalls.

Do not force all merchants to manage online orders.

### Browse-only listing

Customer actions:

- View product.
- View vendor.
- View stall.
- Navigate to market.

### Reservation-enabled listing

Customer actions:

1. Select quantity.
2. Log in if necessary.
3. Confirm reservation.
4. Receive pickup code.
5. Navigate to shop.
6. Show pickup code.
7. Merchant confirms handoff.

### Reservation statuses

- RESERVED.
- COMPLETED.
- CANCELLED.
- EXPIRED.
- NO_SHOW.

### Inventory

For reservation-enabled products:

- Use backend-controlled stock.
- Reserve stock atomically.
- Prevent overselling.
- Release stock correctly after eligible cancellation or expiry.
- Preserve completed transaction history.
- Snapshot the actual price at reservation time.

Implement:

`InventoryService`

and:

`ReservationService`

Use database transactions.

No online payment gateway is required.

The merchant may collect payment at pickup.

---

# 19. GOOGLE AUTHENTICATION

Implement Google OAuth with Auth.js.

### Requirements

- Visitors can browse without login.
- Google Sign-In is the primary login mechanism.
- New users are created automatically after successful authentication.
- Existing users retain their stores, reservations, and preferences.
- Support custom production domain.
- Support correct reverse proxy headers.
- Use secure sessions.
- Protect API routes.
- Use server-side authorization.

### Account model

One user account may:

- Browse products.
- Reserve products.
- Create stores.
- Manage stores they own.
- Manage stall attendance.
- Edit their profile.

Administrators receive additional privileges through secure server-side role management.

Do not trust a role passed from the client.

Do not expose OAuth tokens or credentials.

---

# 20. ADMIN DASHBOARD

Create a comprehensive administrative interface at:

`/admin`

Admin functionality should be powerful, organized, and properly protected.

## Admin overview

Display:

- Total registered users.
- New users.
- Total stores.
- Vendors active today.
- Today's market sessions.
- Registered vendors by market.
- Total products.
- Regular-price products.
- Discounted products.
- Food rescue products.
- Reservations.
- Completed pickups.
- Basic usage analytics.

Separate simulated demo metrics from genuine activity.

## User management

Admin can:

- Search users.
- View profiles.
- View email addresses.
- View names when available.
- View account creation date.
- View last login.
- View owned stores.
- View reservation history.
- Suspend/restore accounts.
- Update permitted account fields.
- Manage roles securely.

Prevent unauthorized privilege escalation.

Protect the final super-admin account.

## Store management

Admin can:

- View all stores.
- Verify stores.
- Suspend stores.
- Hide stores.
- Edit store information.
- Inspect products.
- Inspect attendance.
- Inspect stall assignments.

## Product management

Admin can:

- Browse products.
- Edit permitted data.
- Hide inappropriate products.
- Inspect prices.
- Inspect discounts.
- Inspect inventory.
- Review associated reservations.

## Market management

**This is a required administrative module.**

Admins must be able to:

- Create markets.
- Rename markets.
- Define market types.
- Set venue addresses.
- Set entrance coordinates.
- Configure operating hours.
- Configure weekly schedules.
- Configure alternating schedules.
- Set holidays and closures.
- Publish and cancel market sessions.
- View participating vendors.

## Zone and stall management

Admin can:

- Create zones.
- Create stalls.
- Rename stall identifiers.
- Upload market layout images.
- Position stall markers.
- Assign vendors to stalls.
- Verify assignments.
- Resolve assignment conflicts.
- Disable stalls.
- Move vendors.
- Inspect stall usage by date.

## System configuration

Admin can configure:

- Site name.
- Site announcements.
- Market registration settings.
- Store registration settings.
- Reservation availability.
- Default pricing behavior.
- Default discount settings.
- Marketplace moderation behavior.
- Demo mode.
- Food rescue feature availability.

Never expose actual environment secrets in the dashboard.

### Audit log

Record important administrative actions.

Include actor, action, target, timestamp, and relevant non-sensitive changes.

---

# 21. MARKET LAYOUT ADMIN EDITOR

Build a usable layout management interface.

Admin workflow:

1. Select market.
2. Upload market map image or create a simple zone layout.
3. Add zones.
4. Add stalls.
5. Set stall codes.
6. Position stalls on the map.
7. Save.
8. Preview the public market map.

Requirements:

- Responsive.
- Simple editing controls.
- Clear stall labels.
- Persistent PostgreSQL coordinates.
- Market-specific layouts.
- Validation for duplicate codes.
- Accessible list-based alternative.
- Support replacing the layout image without silently losing stall assignments.

Use normalized coordinates for visual positions.

Do not require a complex GIS system.

For the MVP, a straightforward SVG-based visualization or map with positioned stall markers is sufficient.

---

# 22. ADMIN MOCK DATA GENERATOR

Create:

`/admin/demo-generator`

This is necessary for the Web Programming interview.

Allow administrators to generate a complete fictional campus marketplace.

## Generate

- Mock customers.
- Mock merchants.
- Mock stores.
- Small Market.
- Large Market.
- Market zones.
- Market stalls.
- Weekly market schedules.
- Alternating schedules.
- Market sessions.
- Vendor attendance.
- Stall assignments.
- Normal-price products.
- Discounted products.
- Food rescue products.
- Reservations.
- Completed pickups.
- Sample analytics.

## Demo preset

**Campus Marketplace Demo**

Example fictional data:

- 2 markets.
- 8 market zones.
- 80 total stalls.
- 20 stores.
- 100 products.
- 30 customers.
- 20 reservations.
- Multiple active discounts.

All counts must be configurable.

## Demo scenarios

Provide controls for:

- Generate Small Market day.
- Generate Large Market day.
- Generate market with many vendors.
- Generate market with few vendors.
- Generate a vendor moving stalls.
- Generate a closed merchant.
- Generate regular-price products.
- Generate active discounts.
- Generate upcoming discounts.
- Generate food rescue listings.
- Generate nearly sold-out items.
- Generate reservation pickup scenarios.

## Demo clock and scheduling

If implementing a simulated time preview:

- Make it admin-only.
- Keep it strictly isolated from actual server time and production transactions.
- Clearly label it as a simulation.
- Never let demo clock changes silently affect genuine reservations or inventory.
- Prefer previewing schedule/pricing results for a selected time rather than changing the global system clock.

## Safety

- Mock users must not have fake valid Google identities.
- Mock customers must not be able to authenticate as real users.
- Store demo batch identifiers.
- Ensure generated relationships are coherent.
- Avoid duplicate conflicting stall assignments.
- Clearly mark demo data.
- Allow cleanup by demo batch.
- Never delete genuine users or orders during demo cleanup.
- Restrict demo generation in real production environments.

---

# 23. DATABASE ARCHITECTURE

Use PostgreSQL and Prisma.

Create a normalized schema with clear relationships, indexes, constraints, and migrations.

## Authentication models

- User.
- Account.
- Session.
- VerificationToken.

## Merchant models

- Store.
- StoreMember.
- StoreLocation.
- StoreVerification.

## Market models

- MarketVenue.
- MarketZone.
- MarketStall.
- MarketScheduleRule.
- MarketSession.
- MarketScheduleException.
- StoreAttendance.
- StallAssignment.

## Marketplace models

- Product.
- ProductImage.
- ProductCategory.
- DiscountRule.
- InventoryMovement.
- Reservation.
- PickupToken.

## Administration models

- SystemSetting.
- Report.
- AuditLog.
- DemoBatch.

Adjust relationships when needed.

### Important design considerations

**Store**

Stores are persistent identities.

A store must not be tied permanently to one market stall.

**MarketVenue**

Represents a physical market location.

**MarketSession**

Represents a market operating on a specific date and time.

**StoreAttendance**

Represents a store participating in a specific market session.

**StallAssignment**

Connects a market session, a store, and a stall.

**Product**

Belongs to a store and can optionally be associated with a particular market session.

**DiscountRule**

Defines normal-to-discounted pricing behavior.

**Reservation**

Represents a customer's reservation with immutable price snapshots.

### Important integrity rules

- Avoid overlapping confirmed stall assignments.
- Prevent stock from becoming negative.
- Prevent unauthorized store modifications.
- Enforce valid product pricing.
- Prevent expired market-session reservations.
- Avoid duplicate reservation completion.
- Enforce consistent market-zone-stall relationships.
- Support both permanent shops and temporary market vendors.

Use database transactions for state changes that require consistency.

Use decimal-safe or integer-minor-unit money representation.

---

# 24. S3 OBJECT STORAGE

Store product and shop images in S3-compatible object storage.

Default provider:

Cloudflare R2.

Alternative:

AWS S3.

### Upload architecture

Prefer direct browser-to-S3 uploads using short-lived presigned URLs.

Workflow:

1. User selects or captures photo.
2. Client validates basic file size/type.
3. Client optionally compresses image.
4. Backend verifies authentication and permissions.
5. Backend generates a server-controlled storage key.
6. Backend generates a short-lived upload URL.
7. Browser uploads directly to S3.
8. Backend validates and finalizes the upload.
9. Validated image is attached to the product/store record.

### Requirements

- Secure credentials.
- No S3 secrets in client code.
- Validated object ownership.
- Safe image types.
- Image size limits.
- Actual file content validation.
- Safe replacement.
- Upload error recovery.
- Thumbnail-friendly rendering.
- Appropriate cache controls.

For production, never rely on an ephemeral Docker container filesystem for persistent product images.

### Custom media domain

Support a configurable public media hostname such as:

`media.YOUR_DOMAIN`

Use the S3 API endpoint for signed uploads and the configured media domain for approved public image delivery.

Make the storage implementation provider-independent.

---

# 25. USER INTERFACE DESIGN SYSTEM

Use a warm, minimal, friendly, premium-looking visual style.

The design should communicate:

- Trust.
- Simplicity.
- Community.
- Affordability.
- Freshness.
- Ease of use.

## Colors

Suggested palette:

| Token | Value |
|---|---|
| Primary | #267A4A |
| Soft Green | #E5F4E9 |
| Cream Background | #FFF9F0 |
| Warm Accent | #F6A95A |
| Main Text | #23352B |
| Surface | #FFFFFF |

Use accessible semantic color tokens.

Do not use too many decorative colors.

## Typography

- Noto Sans Thai.
- Inter where appropriate.

Ensure proper Thai text rendering.

## UX requirements

- Mobile-first.
- Readable typography.
- Large, clear buttons.
- Consistent spacing.
- Clear pricing.
- Simple navigation.
- Meaningful empty states.
- Accessible color contrast.
- Keyboard accessibility.
- Responsive stall maps.
- Reduced motion support.
- Clear error and loading messages.

## Customer interface

Must feel like a consumer application.

Avoid complex administration-style layouts.

## Merchant interface

Must be task-oriented.

Make these actions very easy:

- Add product.
- Open/close store.
- Choose market.
- Update stall.
- Set discount.

## Admin interface

Use an organized sidebar and searchable management tables.

Advanced features belong here, not on the customer homepage.

---

# 26. RECOMMENDED ROUTES

## Public

- `/`
- `/explore`
- `/markets`
- `/markets/[slug]`
- `/markets/[slug]/map`
- `/store/[slug]`
- `/product/[id]`

## Customer

- `/profile`
- `/reservations`
- `/become-vendor`

## Merchant

- `/merchant`
- `/merchant/products`
- `/merchant/products/new`
- `/merchant/schedule`
- `/merchant/locations`
- `/merchant/reservations`
- `/merchant/settings`

## Admin

- `/admin`
- `/admin/users`
- `/admin/stores`
- `/admin/products`
- `/admin/markets`
- `/admin/markets/[id]/schedule`
- `/admin/markets/[id]/layout`
- `/admin/stalls`
- `/admin/attendance`
- `/admin/reservations`
- `/admin/analytics`
- `/admin/demo-generator`
- `/admin/settings`
- `/admin/audit-logs`

## API

Use REST endpoints inside:

`/api/`

Include APIs for:

- Authentication.
- User profiles.
- Store management.
- Product management.
- Markets.
- Schedules.
- Market sessions.
- Stall layouts.
- Attendance.
- Stall assignments.
- Pricing.
- Reservations.
- Inventory.
- Upload authorization.
- Administration.
- Health checks.

Use consistent request validation and error response structures.

Do not expose unprotected administrative APIs.

---

# 27. DOCKER COMPOSE SELF-HOSTING

All infrastructure configurations must be included in the repository.

## Required files

- `Dockerfile`
- `.dockerignore`
- `compose.yaml`
- `compose.dev.yaml`
- `compose.external-proxy.yaml`
- `infra/caddy/Caddyfile`
- `.env.example`
- `.env.production.example`

## Required services

**app**

The Next.js full-stack application.

**db**

PostgreSQL with a persistent named volume.

**caddy**

Reverse proxy with HTTPS, when using standalone deployment.

**migrate**

One-off database migration service.

### Deployment requirements

- Multi-stage Docker builds.
- Next.js standalone output.
- Non-root runtime user.
- Health checks.
- Persistent PostgreSQL data.
- Persistent TLS state.
- Appropriate restart policies.
- Docker logging limits.
- Private database networking.
- No exposed PostgreSQL port by default.
- Safe migration order.
- Configuration through environment variables.

## External reverse proxy support

The VM may already have Nginx Proxy Manager, Nginx, Traefik, or Cloudflare Tunnel.

Provide an external-proxy Compose mode that does not bind ports 80 and 443.

Allow the application to listen on a configurable loopback address or private Docker network.

Do not modify existing reverse proxy services without explicit authorization.

Do not delete existing containers or volumes.

---

# 28. CUSTOM DOMAIN

The application will use my own domain.

Do not hardcode a specific domain name.

Support environment variables such as:

- `APP_DOMAIN`
- `APP_URL`
- `AUTH_URL`, if required by the actual Auth.js version.

### HTTPS

For bundled Caddy:

- Automatic HTTPS where available.
- Persistent certificates.
- HTTP-to-HTTPS redirect.
- Reverse proxy routing.

For an existing reverse proxy:

- Correct trusted proxy configuration.
- Correct forwarded headers.
- Correct OAuth callback URLs.
- No conflicting port binding.

Document DNS configuration.

Do not invent my actual domain or DNS records.

---

# 29. GOOGLE OAUTH AND PRODUCTION CONFIGURATION

Provide complete documentation for:

- Google Cloud OAuth configuration.
- Creating OAuth Client ID.
- Creating OAuth Client Secret.
- Local development callback.
- Production callback.
- Authorized redirect URI.
- Auth.js secret configuration.
- HTTPS domain requirements.
- Reverse proxy considerations.

Example production callback:

`https://YOUR_DOMAIN/api/auth/callback/google`

Confirm the correct callback for the implemented Auth.js version.

Never include live credentials in the repository.

---

# 30. PRODUCTION ENVIRONMENT VARIABLES

Create a complete example configuration.

Use variables equivalent to:

- `NODE_ENV`
- `APP_DOMAIN`
- `APP_URL`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ADMIN_EMAILS`
- `S3_PROVIDER`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `DEMO_MODE`
- `BACKUP_DIRECTORY`
- `BACKUP_RETENTION_DAYS`
- `TZ`

Make actual names consistent with the final implementation.

Document which values are mandatory.

Do not expose secrets through the public UI or client bundle.

---

# 31. DATABASE BACKUP AND RESTORE

Create:

- `scripts/backup.sh`
- `scripts/restore.sh`
- `scripts/update.sh`
- `scripts/deploy.sh`
- `scripts/healthcheck.sh`

## Backup

Use PostgreSQL logical backups.

Support:

- Configurable backup location.
- Timestamped filenames.
- Backup verification.
- Secure file permissions.
- Retention configuration.
- Off-VM storage recommendations.

Do not commit backup files.

## Restore

Support restoring a selected backup safely.

Require confirmation before destructive restoration.

Document restoration into a test database.

## Updates

The update procedure must:

1. Validate configuration.
2. Build the new image.
3. Back up PostgreSQL.
4. Apply safe migrations.
5. Start the updated application.
6. Verify health.
7. Preserve persistent volumes.

Never use `docker compose down -v` as part of a normal update.

---

# 32. SECURITY

Implement practical production-quality protections.

### Authentication and authorization

- Secure Google OAuth.
- Server-side session validation.
- Role-based authorization.
- Store ownership enforcement.
- Admin route protection.
- No public admin registration.

### Input security

- Zod validation.
- Safe image upload validation.
- Output encoding.
- No user-controlled HTML execution.
- Rate limiting where necessary.
- Protection against insecure direct object references.

### Marketplace integrity

- No negative prices.
- No overselling.
- No inconsistent confirmed stall assignments.
- No unauthorized stall changes.
- No unauthorized market schedule edits.
- No fabricated verification badges.
- No fake real-world impact figures.

### Infrastructure

- No committed secrets.
- No public database port.
- Non-root application container.
- Minimal container permissions.
- Safe logging.
- Persistent data.
- Health checks.

### Food safety

Food rescue listings must include appropriate food information.

Do not imply that food is verified safe merely because it is listed.

Provide moderation and reporting.

Make stricter vendor verification available for future real-world deployment.

---

# 33. ANALYTICS

Implement useful analytics using real stored data.

## Admin metrics

- Total users.
- Registered merchants.
- Stores active today.
- Market participation.
- Most visited market pages, if tracked appropriately.
- Product count.
- Regular-price listings.
- Discounted listings.
- Food rescue listings.
- Reservations.
- Completed pickups.

## Market metrics

- Vendors per market session.
- Registered stalls.
- Stall participation.
- Active listings by market.
- Market schedule utilization.

## Social impact

- Confirmed food rescue pickups.
- Documented discounted food reservations.
- Estimated customer savings based on declared original prices.
- Demo-generated statistics shown separately.

Never claim that simulated data represents genuine social impact.

Respect user privacy and avoid unnecessary tracking.

---

# 34. TESTING REQUIREMENTS

Use Vitest and Playwright.

## Unit tests

Test:

- Normal pricing.
- Discount calculations.
- Discount activation boundaries.
- Market scheduling.
- Alternating market weeks.
- Special schedule exceptions.
- Timezone behavior.
- Stall assignment validation.
- Inventory calculations.
- Reservation transitions.
- Permission checks.

## Integration tests

Test:

- Google-linked user persistence with isolated test authentication.
- Store creation.
- Product creation.
- Market creation.
- Market schedule changes.
- Market session generation.
- Vendor attendance.
- Stall assignments.
- Stall conflict prevention.
- Product listing modes.
- Reservations.
- Inventory concurrency.
- Admin permissions.
- Demo data generation and cleanup.

## E2E tests

Test these complete scenarios:

### Scenario A — Customer

1. Guest opens homepage.
2. Guest sees today's market.
3. Guest opens market page.
4. Guest searches vendor.
5. Guest views stall location.
6. Guest opens Google Maps directions.

### Scenario B — Merchant

1. Merchant logs in.
2. Merchant creates shop.
3. Merchant chooses market.
4. Merchant chooses stall.
5. Merchant uploads product photo.
6. Merchant sets price.
7. Merchant publishes.
8. Product appears in marketplace.

### Scenario C — Scheduled Discount

1. Merchant creates 100 THB product.
2. Merchant configures final price of 30 THB after 19:00.
3. System previews the scheduled price.
4. Price calculation is verified before/after boundary.
5. Reservation snapshots correct price.

### Scenario D — Market Alternation

1. Admin configures small and large market schedules.
2. Customer sees correct market today.
3. Customer views next week's schedule.
4. Vendor changes market attendance.
5. Store location updates correctly.

### Scenario E — Administration

1. Admin opens dashboard.
2. Admin generates fictional markets, stores and products.
3. Admin edits market schedule.
4. Admin modifies stall assignment.
5. Public marketplace reflects authorized changes.
6. Admin cleans up only the selected demo batch.

### Scenario F — Security

1. Guest cannot access admin.
2. Merchant cannot modify another merchant's store.
3. Two merchants cannot claim the same confirmed stall in a conflicting session.
4. Two customers cannot reserve the final stock item simultaneously.
5. Mock users cannot impersonate real Google accounts.

Test responsive behavior on mobile and desktop.

Fix critical failures before declaring completion.

---

# 35. RECOMMENDED IMPLEMENTATION ORDER

## Phase 1 — Foundation

- Inspect repository.
- Configure Next.js.
- Configure TypeScript.
- Configure design system.
- Configure PostgreSQL.
- Configure Prisma.
- Create initial database migrations.
- Implement Google OAuth.

## Phase 2 — Marketplace

- Homepage.
- Public product listings.
- Product details.
- Store pages.
- Regular selling mode.
- Customer search and filters.

## Phase 3 — Campus markets

- Market models.
- Small/Large Market configuration.
- Schedule engine.
- Market calendar.
- Market sessions.
- Zones and stalls.
- Vendor location display.
- Google Maps navigation.

## Phase 4 — Merchant experience

- Quick registration.
- Store management.
- Market attendance.
- Stall assignment.
- Product creation.
- S3 photo upload.
- Basic merchant dashboard.

## Phase 5 — Pricing and reservations

- Time-based discounts.
- Food rescue listings.
- Inventory service.
- Optional reservation mode.
- Pickup confirmation.

## Phase 6 — Administration

- Admin authorization.
- Overview dashboard.
- User management.
- Store management.
- Product management.
- Market schedule editor.
- Stall layout editor.
- Demo data generator.

## Phase 7 — Self-hosting

- Production Dockerfile.
- Docker Compose.
- PostgreSQL persistence.
- Migration service.
- Caddy reverse proxy.
- External proxy mode.
- Backup and update scripts.
- Health checks.

## Phase 8 — Quality assurance

- Unit testing.
- Integration testing.
- E2E testing.
- Security review.
- Performance improvements.
- Responsive verification.
- Production build verification.
- Documentation.

Prioritize working end-to-end scenarios before optional enhancements.

---

# 36. PRIORITY MATRIX

## P0 — Absolutely required

- Full-stack Next.js monorepo.
- Docker Compose deployment.
- PostgreSQL.
- Google OAuth.
- Public marketplace.
- Regular product sales.
- Simple vendor registration.
- Product photo uploads.
- S3 integration.
- Small Market and Large Market.
- Editable market schedules.
- Today's market page.
- Vendor stall location.
- Google Maps navigation.
- Merchant attendance management.
- Product listings.
- Scheduled discounts.
- Basic admin management.
- Custom domain and HTTPS.

## P1 — Important for interview impact

- Interactive stall map.
- Advanced weekly/biweekly scheduling.
- Attendance templates.
- Reservation workflow.
- Inventory tracking.
- Food rescue functionality.
- Admin demo generator.
- Market map editor.
- Advanced admin analytics.
- Backup automation.
- Audit logs.

## P2 — Future improvements

- Push notifications.
- Favorites.
- Vendor reviews.
- Market announcements.
- Sponsored meals.
- Online payment.
- AI recommendations.
- Advanced route planning.
- Merchant sales analytics.
- Additional campuses.

Do not implement P2 features at the expense of unfinished P0 functionality.

---

# 37. README AND DOCUMENTATION

Create a professional GitHub README in English.

Include:

1. Project overview.
2. Problem statement.
3. Product vision.
4. Core features.
5. Campus market functionality.
6. Merchant onboarding.
7. Market and stall system.
8. Tech stack.
9. Architecture diagram.
10. Repository structure.
11. Database design.
12. API architecture.
13. Google OAuth configuration.
14. S3 configuration.
15. Local development.
16. Docker Compose deployment.
17. Custom domain setup.
18. HTTPS.
19. Admin setup.
20. Demo data generation.
21. Tests.
22. Backup and restore.
23. Limitations.
24. Future roadmap.

Also create:

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/MARKET_SCHEDULING.md`
- `docs/STALL_LOCATIONS.md`
- `docs/USER_FLOW.md`
- `docs/DEPLOYMENT.md`
- `docs/GOOGLE_OAUTH.md`
- `docs/S3_SETUP.md`
- `docs/BACKUP_RESTORE.md`
- `docs/INTERVIEW_DEMO.md`

The end-user interface should be primarily Thai.

Developer documentation should be English.

---

# 38. INTERVIEW DEMONSTRATION — 3 MINUTES

Prepare a polished live demonstration.

## 00:00–00:30 — The Problem

Show ImTor's homepage.

Explain:

Students often do not know which campus market is open, which merchants are attending, where particular stalls are located, or when products become discounted.

ImTor solves these problems in one simple website.

## 00:30–01:00 — Today's Market

Show today's market.

Demonstrate:

- Small/Large Market schedule.
- Market opening hours.
- Vendor directory.
- Stall locations.

## 01:00–01:30 — Easy Vendor Registration

Demonstrate:

- Google Sign-In.
- Create shop.
- Select market.
- Select stall.
- Upload product image.
- Publish.

## 01:30–02:00 — Product Discovery

Switch to customer view.

Show:

- Newly published product.
- Normal selling price.
- Market location.
- Stall map.
- Google Maps navigation.

## 02:00–02:30 — Discount and Reservation

Demonstrate:

- Scheduled discount.
- New price calculation.
- Optional reservation.
- Stock reduction.

## 02:30–03:00 — Admin and Architecture

Show:

- Admin dashboard.
- Market schedule configuration.
- Stall management.
- Demo data generator.
- Docker Compose architecture.

Explain that the entire application is deployed on a personal VM using one repository.

---

# 39. ACCEPTANCE CRITERIA

The project is ready only when all P0 requirements work.

### Architecture

- [ ] One Git repository.
- [ ] One Next.js full-stack application.
- [ ] API and frontend share one deployment.
- [ ] PostgreSQL is persistent.
- [ ] Docker Compose works.
- [ ] S3 image storage works.
- [ ] Custom domain configuration exists.
- [ ] HTTPS works when infrastructure is configured.

### Customers

- [ ] Browse without login.
- [ ] View regular-price products.
- [ ] View discounted products.
- [ ] View food rescue listings.
- [ ] See today's market.
- [ ] View market schedules.
- [ ] Find vendors.
- [ ] View stall locations.
- [ ] Open navigation directions.

### Merchants

- [ ] Sign in using Google.
- [ ] Create a store.
- [ ] Select selling location.
- [ ] Join market sessions.
- [ ] Select or report a stall.
- [ ] Upload product photos.
- [ ] Publish regular products.
- [ ] Configure discounts.
- [ ] Manage listings.
- [ ] Update opening status.

### Markets

- [ ] Small Market supported.
- [ ] Large Market supported.
- [ ] Configurable market schedules.
- [ ] Recurring schedules work.
- [ ] Alternating schedules work.
- [ ] Market sessions are calculated correctly.
- [ ] Stall identifiers are displayed correctly.
- [ ] Conflicting confirmed stall assignments are prevented.

### Administration

- [ ] Admin routes are protected.
- [ ] Admin can view users.
- [ ] Admin can manage stores.
- [ ] Admin can manage products.
- [ ] Admin can create and edit markets.
- [ ] Admin can configure schedules.
- [ ] Admin can manage zones and stalls.
- [ ] Admin can review attendance.
- [ ] Admin can generate sample data safely.

### Quality

- [ ] Responsive mobile UI.
- [ ] Thai typography works.
- [ ] Correct server-side validation.
- [ ] Reliable authorization.
- [ ] No hardcoded secrets.
- [ ] No negative stock.
- [ ] No invalid discounts.
- [ ] No misleading opening-status claims.
- [ ] Production build passes.
- [ ] Critical tests pass.
- [ ] Deployment documentation is complete.

---

# 40. FINAL EXECUTION INSTRUCTIONS

You must implement the actual application.

Do not simply describe how to build it.

### Before coding

1. Inspect the repository.
2. Identify existing functionality.
3. Determine required architecture changes.
4. Establish a practical implementation plan.
5. Preserve unrelated working features.

### During implementation

- Write clean, maintainable TypeScript.
- Use reusable components.
- Keep backend services modular.
- Validate untrusted input.
- Enforce authorization server-side.
- Use transactions for critical state changes.
- Use proper database migrations.
- Avoid unnecessary dependencies.
- Favor simple solutions over premature complexity.
- Prioritize mobile usability.
- Keep merchant workflows extremely short.
- Make market information easy to discover.
- Keep demo and genuine data distinguishable.

### Verification

Run all checks available in the environment:

- Dependency installation.
- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Production build.
- Docker image build.
- Docker Compose validation.
- Database migrations.
- Playwright E2E tests.
- Responsive review.
- Security checks.

Fix failures rather than hiding or bypassing them.

If external credentials, DNS access, S3 access, or VM access are missing, complete locally testable work and document the remaining deployment steps.

Do not claim public deployment or successful Google OAuth without verification.

### Final engineering report

Provide:

1. Features implemented.
2. Repository architecture.
3. Application routes.
4. API routes.
5. Database models.
6. Market schedule implementation.
7. Stall location implementation.
8. Merchant experience.
9. Discount engine.
10. Google OAuth setup.
11. S3 integration.
12. Docker Compose services.
13. Required environment variables.
14. Local development commands.
15. Production deployment commands.
16. Domain and HTTPS configuration.
17. Backup and restore procedure.
18. Test results.
19. Known limitations.
20. Deployment readiness status.

---

# FINAL PRODUCT GOAL

Build **ImTor**, a beautiful and extremely user-friendly campus marketplace that brings everyday shopping, campus markets, vendor discovery, stall navigation, scheduled discounts, and food rescue together.

The most important experience is:

**A student opens ImTor, immediately discovers which market is operating today, finds what they want, sees exactly where the seller is located, and knows how to get there.**

For merchants:

**Google Login → Create Shop → Choose Market and Stall → Take Product Photo → Set Price → Publish.**

For administrators:

**Manage Everything → Markets → Schedules → Stalls → Vendors → Products → Users → Analytics → Demo Data.**

The final application must be:

- Beautiful.
- Minimal.
- Fast.
- Mobile-first.
- Easy to understand.
- Accessible.
- Secure.
- Fully functional.
- Database-backed.
- Dockerized.
- Self-hosted.
- Extensible to additional campuses.

**One Repository. One Full-Stack App. One Docker Compose Deployment. PostgreSQL. S3 Images. Google OAuth. Campus Markets. Stall Maps. Regular Sales. Scheduled Discounts. Food Rescue.**

Build and verify the complete project.