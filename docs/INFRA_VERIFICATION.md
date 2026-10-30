# Infrastructure verification (local, 2026-10-30 UTC)

This record describes observed local checks, not a public deployment. No existing VM proxy or unrelated container was modified. Credentials are excluded.

**Latest result:** final runtime `sha256:2028ed2ec3da946b8668d288452688e866a60135593a272fabefdc5c807dbe1c` and unchanged migration image passed local build/startup/health. Backup/restore and the 60-case post-fix authorization matrix passed on the preceding guard-identical source snapshot. See “Final accessibility-only runtime refresh” for precise artifact/evidence binding; earlier snapshots are chronological evidence.

## Passed

- Docker Compose v5.6.0: `config --quiet` for base, explicit development override and external-proxy override, using `.env.example` solely as placeholder interpolation input. No service startup was required for these syntax checks.
- `bash -n` on every `scripts/*.sh` file.
- Official Node `24.11.0-bookworm-slim` and Bun `1.4.3` image tags resolve.
- Caddy `2.10.2-alpine`: `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` with `APP_DOMAIN=example.invalid`, an example ACME email and `--network none` returned **Valid configuration**. No certificate issuance or public-domain verification was performed.
- Isolated project `imtor-infra-check` started only its PostgreSQL `18.3-alpine` database, with no published host database port, and reached healthy.
- A fictional `infra_probe` row was created in that isolated database. `scripts/backup.sh` produced a nonempty PostgreSQL custom archive, `pg_restore --list` succeeded, SHA-256 check returned **OK**, archive/checksum modes were **600**, and backup directory mode **700**.
- `scripts/restore.sh ARCHIVE --database imtor_restore_test --confirm 'RESTORE imtor_restore_test'` restored the archive into a separately created test database. Query result: `1 | fictional backup validation`.
- Main-database restore without `RESTORE_MAINTENANCE=true` was rejected before destructive restoration.
- Wrong confirmation in noninteractive restore was rejected.
- `BACKUP_RETENTION_DAYS=0` was rejected.
- Retention deleted an intentionally aged `imtor-*.dump` fixture plus matching checksum, preserving an unrelated file.
- Corrupt archive input failed preflight; the restored test table still contained exactly one row.
- Official RustFS `1.0.4` local-only S3 test fixture started on `127.0.0.1:59000`, console disabled, random credentials stored only in gitignored mode-600 `.env.s3-test`. GET `/health` returned `status: ok`, `version: 1.0.4`. This fixture is **not** added as a production Compose requirement. Bucket policy/upload verification belongs to application integration verification.

## Build status

Dependency installation in the Docker dependencies stage completed using the default official engine source: `bun install --frozen-lockfile`, **666 packages installed**, 66.73 seconds. The dependencies image `imtor-dependencies:infra-check` completed successfully (Docker exit 0). Final runtime/migration image checks are recorded below when complete; dependency installation alone is not evidence of a working app image.

## Boundaries

Real Google OAuth round trip, external R2/S3, public DNS/HTTPS/certificate issuance, production deployment, a real-data recovery exercise and public-network health are not verified by the checks above. PostgreSQL archive-list validation is not a full restore guarantee; the separate probe restore provides an additional limited local round-trip check. Deployment/update scripts were syntax/review checked; no production update was executed.

The official MinIO DockerHub/Quay image was unavailable during fixture setup (pull/manifest denied). A bounded fallback used the [official RustFS Docker documentation](https://docs.rustfs.com/en/installation/container/docker) and an explicit stable tag, not an undocumented mirror.

## Fixture cleanup

The isolated PostgreSQL test container/network were stopped and removed using the exact `imtor-infra-check` project and `docker compose down` **without volume deletion**. No running containers remained for that project; its named `imtor-infra-check_postgres_data` volume was explicitly verified retained. Secure fictional test archives remain under a dedicated temporary directory for inspection. The local RustFS fixture remains running for parent application upload/browser tests; its lifecycle is separate from the production stack.

Additional negative check: `IMTOR_ENV_FILE=.env.production.example COMPOSE_MODE=external ./scripts/deploy.sh` rejected placeholder `AUTH_SECRET` before any build or service mutation. The local S3 test credentials file is confirmed ignored by Git and mode 600.

The Docker base was subsequently updated to the host-matching current Node `24.22.0-bookworm-slim` tag after registry resolution succeeded. Preliminary dependency-stage evidence above used Node 24.11.0; final Node 24.22.0 migration/runtime results are listed separately below and are not inferred from the earlier build.

Caddy's actual configured health probe (`wget -q -O /dev/null http://127.0.0.1:2019/config/`) also passed against a transient network-isolated local Caddy process with no host ports; that process/container was removed afterward.

The preliminary Node 24.11.0 migration image `imtor-migration:infra-check` built successfully, including real `prisma generate` (client 7.10.1), Docker exit 0. The final checked-in Dockerfile targets Node 24.22.0 instead; its build is a separate check.

Final image build context was refreshed after the direct Sharp dependency upgrade to 0.35.5 (package and lockfile observed updated); stale-snapshot builds were cancelled and are not counted as final evidence. Application audit/test results are recorded by the parent verification report.

## Final source snapshot checks and discovered authorization regression

The stable-source Node 24.22.0 images built successfully after Sharp 0.35.5 and all four migration directories were present. Snapshot IDs (superseded if later fixed): app `sha256:e4327541f4cfff15f95e33d0045e047009e324e6780c762bfdcaa70122c31119`, migration `sha256:9f15120ef77d64441cb49d97252ae1f811e24c00bba5e82eeb3664501094b778`. The app used only the non-secret example image-origin build argument `https://images.example.invalid`.

Actual Compose startup on a NEW empty `imtor_smoke_test` database proved PostgreSQL healthy → four migrations successfully applied → app started and Docker health **healthy**. Internal health script passed; loopback GET `/api/health` returned `{"status":"ok","service":"imtor"}` and homepage returned HTTP 200. App runs UID 1000/Node 24.22.0/Sharp 0.35.5; no environment files or Prisma CLI in runtime. Headers included nosniff, frame DENY, strict-origin referrer policy and health no-store. A full-schema custom backup/restore into `imtor_full_restore_test` preserved seven canonical categories and four completed migrations.

Negative startup control: reusing the earlier nonempty probe database caused Prisma P3005 and Compose correctly prevented app startup. No production baselining/deletion was attempted; a new empty test database was created instead.

**Authorization regression discovered during raw-HTTP smoke:** layout-only admin authentication allowed unauthenticated `/admin/reservations` response bytes to contain a synthetic private customer/product marker even while emitting `NEXT_REDIRECT`. `/admin/users`, which checked `requireAdmin()` inside the page before its query, was a matched negative control and did not expose the marker. Only synthetic fixture data was used. The parent was notified to add page/data-boundary guards and a raw-response regression test. This snapshot is not a security-complete final artifact; post-fix rebuild/retest evidence follows when available.

## Post-fix final artifacts and security verification

The parent added authorization at each of the 15 admin page entries before private queries (not only in the layout). Both images were rebuilt from that fixed source and passed production compilation/type checking:

- `imtor-app:local`: **sha256:45a1d969dd52608f33d111f1321af9448776c5dd02e01262fff995f6e46f45a9**, UID 1000 (`node`), Node 24.22.0, Sharp 0.35.5; 431,013,175 bytes.
- `imtor-migration:local`: **sha256:1b1e8302df8eb28c326d127dc1138ef4d4f854e343c1af6ab96fd6856af6a83a**, `node` user, real Prisma CLI/engine, all four migration directories and seed alias configuration; 1,981,888,440 bytes (full CLI/development dependencies intentionally separate from runtime).

Final runtime command: `docker build --build-arg S3_PUBLIC_BASE_URL=https://images.example.invalid --target runtime -t imtor-app:local .`; migration command: `docker build --target migration -t imtor-migration:local .`. Both exited 0. Default official Prisma engine source worked inside Docker; no mirror/fake engine/host binary path was needed. `.dockerignore` excludes every `.env`/`.env.*`, registry credential files, host dependencies, generated output and backups; examples/docs are not needed in the build context either.

The isolated Compose project recreated migration/app from those exact images. Migrations exited 0; health script and loopback `/api/health` passed. **60 raw-response checks passed**: 15 admin routes × HTML/RSC response formats × guest/authenticated non-admin. The non-admin fixture was verified authenticated through the session endpoint before permission checks. The same synthetic markers leaked before the fix were absent afterward; the non-admin's normal own-name header was excluded from the private-data assertion. No default/demo runtime authentication bypass was added.

This resolves the observed layout-only authorization regression for the tested paths and actors. Earlier image IDs in this document are historical, not the final recommended artifacts. Production and external-service limits remain unchanged: no public deployment, real Google OAuth, external R2 or public TLS/DNS verification is claimed.

Final cleanup: after the post-fix checks and a confirmed Docker `healthy` state, only project `imtor-infra-check` was stopped/removed with Compose `down` **without `-v`**. Its app/migration/database containers and private network were removed; no running project containers remained. `imtor-infra-check_postgres_data` was verified retained, along with secure fictional archives for inspection. The parent's RustFS fixture `imtor-s3-test` was explicitly confirmed still running; main app/dev database/proxy resources were not touched. All 26 infrastructure/documentation/script artifacts were reopened and read successfully.

## Final accessibility-only runtime refresh

After the authorization fix, the frontend made a final presentation-only adjustment in `globals.css` and `layout.tsx` (contrast and an account-link accessible label). The runtime was rebuilt again with the same non-secret image-origin argument. **The final runtime artifact is now `imtor-app:local` → sha256:2028ed2ec3da946b8668d288452688e866a60135593a272fabefdc5c807dbe1c**, 431,013,323 bytes. It supersedes the prior runtime ID above. Migration contents did not change; the final migration image remains **sha256:1b1e8302df8eb28c326d127dc1138ef4d4f854e343c1af6ab96fd6856af6a83a**.

The refreshed runtime passed Docker production build/TypeScript (exit 0), offline UID 1000 / Node 24.22.0 / Sharp 0.35.5 native JPEG encoding (267 bytes), absence of environment files and absence of the Prisma CLI. A fresh isolated Compose startup with the retained synthetic test volume again proved database healthy → migration exit 0 → application started. `scripts/healthcheck.sh`, loopback `/api/health` (`status: ok`) and homepage HTTP 200 all passed against this exact runtime image.

The 60-case authorization matrix was not repeated after these two presentation-only changes; its evidence remains bound to the preceding post-fix image with unchanged authorization/query source. Lighthouse measurements are reported by the parent's application verification, not inferred from this Docker build. External Google/R2/public DNS/TLS/deployment remain unverified.

The refreshed app's Docker health also reached `healthy`. Its isolated smoke containers/network were then removed again with project-scoped Compose `down` without deleting volumes. The synthetic database volume was verified retained and the parent's RustFS fixture remained running. No main app/database/proxy resources were changed.
