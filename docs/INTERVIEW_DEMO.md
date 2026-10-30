# Interview demo

## Preparation (isolated local instance)

1. Complete local setup/migrations from README. Do not use a real production database.
2. Configure your own Google web client if authenticated merchant/admin flows will be shown; callback `http://localhost:3000/api/auth/callback/google`. Allowlist only the intended presenter in `ADMIN_EMAILS`.
3. Set `DEMO_MODE=true` **and** `ENABLE_DEMO_GENERATOR=true` in the isolated local environment, then run `bun run db:seed` explicitly.
4. Restart the application after environment changes. Keep fictional data labels visible; there is no public demo login or default admin password.
5. For live image upload configure real private-staging/approved-only S3 delivery and test it beforehand. If not configured, explicitly distinguish existing sample photographs from an unverified upload integration.
6. Run unit/integration/build/browser checks and review actual results. Do not claim tests or external services passed from this checklist alone.

Seed records are fictional and use demo lineage. No supplied sample schedule, shop name, stall layout or impact metric is a claim about a real university. Do not use images that imply verified real merchants. Production deploy/update scripts require demo features disabled.

## Three-minute demonstration

### 00:00–00:30 — The problem

Open the guest homepage. Explain that students do not know which market runs today, which sellers attend, or where to find a stall. Point out that ImTor includes ordinary full-price shopping, not only surplus food. Keep visible fictional-data labels.

### 00:30–01:00 — Today's market

Open the market calendar and a session-aware vendor directory. Show **market → zone → stall**, the accessible map/list, and scheduled versus vendor-confirmed presence. Explain that configured Google directions lead to the market entrance, not an invented indoor stall route.

### 01:00–01:30 — Easy merchant registration

Using a real configured Google account, create a shop, select a market session/stall, upload a photo, enter name/price and publish. Prepare the session and authorized stall beforehand. Do not claim Google or storage verification if those integrations are unconfigured.

### 01:30–02:00 — Product discovery

Return to customer view and search for the newly published product. Show its ordinary price, actual store location and stall map. Demonstrate entrance navigation only for genuinely configured venue coordinates; explain why fictional demo venues deliberately omit these.

### 02:00–02:30 — Discount and reservation

Show a prepared ฿100 listing whose final-percentage rule produces ฿30, correctly labelled 70% off. Show the scheduled/active boundary using admin-only read-only preview or test evidence. Reserve a genuine local test listing, show the immutable price/pickup code, and confirm merchant handoff. Fictional batch listings do not accept genuine reservations.

### 02:30–03:00 — Admin and architecture

Show a protected schedule/layout editor and the gated demo generator. Point out genuine-only impact statistics and selected-batch cleanup. Close with the architecture: one Next.js full-stack deployment, PostgreSQL, S3 images, Google OAuth, migration ordering and Docker Compose on a personal VM.

Pre-stage browser tabs and a configured authorized merchant/customer/admin account. For a longer technical discussion, show last-stock/stall concurrency tests, the raw-stream authorization regression, private staging → Sharp → immutable approved key, and the verified local backup/restore drill. State external verification limits separately from local evidence.

## Honest limitations

No online payments, no assertion that listed food is certified safe, no verified campus coordinates unless actually configured, no invented real impact figures. One VM is not high availability. Google OAuth, final-domain TLS/DNS and external S3 remain configuration-dependent until exercised end to end with actual operator infrastructure. If an external step fails, demonstrate the real error and the covered local tests rather than a fake success state.

## Reset

Use targeted demo batch cleanup only; do not reset the database or delete volumes. Disable both demo flags before any production configuration is used. Keep Google/S3 secrets and private user data out of screen recordings, logs and repository files.
