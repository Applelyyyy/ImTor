<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## ImTor development

Read docs/PRODUCT_SPEC.md before scope changes. This is one full-stack Next.js application, not separate frontend/backend deployments. Keep the UI Thai and developer documentation English. Use Bun and maintain server-side authorization before every private page query; a layout redirect alone does not protect streamed child data. API writes must validate ownership, origin and input. Keep real secrets out of source/config examples. Integration tests require a separate local database ending in `_test`.

Treat external cloud/production connections as read-only during discovery. Do not deploy or modify production infrastructure without task-specific authorization. Run focused tests, TypeScript, lint and the production build before reporting completion. Report external Google/S3/domain verification separately from local checks.
