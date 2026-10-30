# ImTor implementation design

## Intent
Build the supplied ImTor campus marketplace for an interview: browsing first, accurate market status, find a vendor's stall, optional reservations. The attached PRODUCT_SPEC.md is authoritative. The user explicitly requests implementation without stopping at planning.

## Approach
One Next.js App Router application at repository root with PostgreSQL/Prisma, server-rendered public pages and small interactive forms. Separate frontend/backend deployments, managed databases, and React Native are rejected: they conflict with the supplied architecture. Use stable NextAuth v4 (Auth.js) with Google and a Prisma database adapter rather than a beta dependency. Node 24 LTS and Bun tooling.

## Boundaries
- src/lib: database, authentication, authorization, validation, public query DTOs.
- src/services: pure schedule/pricing engines; transactional attendance, reservations/inventory, demo batches and uploads.
- src/app/api: same-origin validated REST writes, no trusting client roles.
- src/app: public marketplace, markets/map, store/product pages; guarded merchant and admin tools.
- PostgreSQL: normalized identities, sessions, venue zones/stalls, recurrence/exceptions, attendance and assignment, inventory/reservation history, settings/audit/demo lineage.
- S3: upload into private staging, inspect and re-encode image bytes, publish a new immutable approved key. Never expose a staging object.

## Design tokens
Cream #FFF9F0; forest #267A4A; leaf #E5F4E9; orange #F6A95A; ink #23352B; white #FFFFFF. Noto Sans Thai body and headings; editorial scale without generic SaaS statistic hero. Left aligned desktop, stacked mobile. A compact market-status panel sits next to the food-discovery headline; below: search/filter bar and photographic product feed. Warmth comes from real food photography and Thai copy, not ornamental gradients.

```
Logo     Discover  Markets                 Open a shop  Account
Headline: What to eat today?        Today's scheduled market
Search [____________________]      Hours, stall map, attendance
Categories and filters
Product     Product     Product     Product
```

Keyboard-visible focus, labelled forms, accessible map list, responsive cards, reduced motion. Demo records and self-reported locations visibly labelled. Do not invent real venue coordinates or verified food safety.

## Acceptance and verification
Unit tests pin baht minor-unit pricing, Bangkok calendar boundaries, biweekly anchor, midnight and cancellations. PostgreSQL integration tests prove negative stock prevention, concurrent last-unit reservation, stall conflicts, ownership and batch cleanup. Browser tests cover public pages/search/map and isolated session-backed merchant/admin flows. Production build and Docker build/compose validation run locally. Google OAuth, external S3 and domain/TLS are configuration dependent; no claim of live verification without credentials.
