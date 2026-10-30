# Google OAuth

## Implemented version

ImTor deliberately uses **stable NextAuth.js v4.24.15**, the Prisma adapter and database sessions, rather than depending on Auth.js v5 beta APIs. The application explicitly maps:

- `AUTH_SECRET` → NextAuth `secret`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` → Google provider `clientId` / `clientSecret`.
- `NEXTAUTH_URL` → v4 canonical public base URL; keep equal to `APP_URL`.

Do not assume v5 environment-variable auto-detection, `AUTH_URL`, `AUTH_TRUST_HOST` or v5 handler examples apply. See [v4 options](https://next-auth.js.org/configuration/options) and [Google provider](https://next-auth.js.org/providers/google).

## Google Cloud setup

1. In an operator-controlled Google Cloud project, configure the OAuth consent screen/branding and audience. Request only necessary identity scopes (`openid email profile`); follow Google's current publishing/testing requirements.
2. If the application is in testing mode, add the intended interview/test Google accounts. Do not invent a shared account or password.
3. Create an OAuth 2.0 **Web application** client (not a desktop/native client).
4. Authorized JavaScript origin for local development: `http://localhost:3000`.
5. Authorized redirect URI: **`http://localhost:3000/api/auth/callback/google`**.
6. For your real HTTPS domain, add origin `https://YOUR_DOMAIN` and redirect **`https://YOUR_DOMAIN/api/auth/callback/google`**. Replace `YOUR_DOMAIN`; match scheme, hostname, port and path exactly. Add separate clients/environments where practical.
7. Store Client ID/Secret as `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` in the protected environment file. Set `AUTH_SECRET` to a cryptographically random secret (`openssl rand -hex 32`). Restart app after changing runtime environment.

Callback format is defined by the [NextAuth v4 Google provider documentation](https://next-auth.js.org/providers/google). Never place Client Secret or session secrets in client code, `NEXT_PUBLIC_*`, screenshots, Git or logs.

## Access and admin bootstrap

Guests browse without login. Google-linked users persist through Account/User rows and database sessions. Suspended and fictional/demo identities must not become real authenticated users. Verified Google email is required. `ADMIN_EMAILS` is a comma-separated allowlist evaluated server-side on sign-in; set only intentional admins. Removing an email from the allowlist does not automatically revoke a previously persisted role: explicitly demote the database user through an authorized administrative procedure and revoke sessions if needed.

There is no public admin registration or default demo login. Use a real Google identity and explicit admin allowlisting for the interview, or isolated test sessions in the test harness—not a public authentication bypass.

## Reverse proxy and troubleshooting

The browser must access the external HTTPS hostname; the proxy forwards to the private app. Set `APP_URL` and `NEXTAUTH_URL` to that external origin, never the container hostname. Restrict direct access and sanitize forwarded headers at your trusted edge. HTTPS cookie behavior follows the canonical URL.

- Redirect mismatch: compare the exact redirect URI with the Google client entry.
- Provider not shown: check both Google environment values exist and restart the app.
- Access denied: verify consent/test-user configuration, verified email and suspension/demo status.
- Session not persisted: inspect PostgreSQL readiness/migration and session expiry; do not log tokens.
- Callback works locally but not behind proxy: verify canonical URL, forwarded protocol/host and browser cookies.

Local unit/integration tests can test identity persistence and authorization; they do not verify a real Google consent/redirect round trip. External OAuth remains unverified until exercised with actual operator credentials and the final HTTPS domain.
