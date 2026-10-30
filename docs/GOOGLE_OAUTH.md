# Google OAuth: imtor-production

## Existing implementation

The repository uses **NextAuth.js 4.24.15**, one Google provider, the Prisma adapter and database-backed sessions (7 days). Keep the current authentication and authorization code. Server-side mapping:

| Environment | Existing use |
| --- | --- |
| `NEXTAUTH_URL=https://imtor.applely.dev` | v4 canonical public HTTPS origin |
| `APP_URL=https://imtor.applely.dev` | application origin/CSRF checks |
| `AUTH_GOOGLE_ID` | existing Google provider `clientId` |
| `AUTH_GOOGLE_SECRET` | existing Google provider `clientSecret` |
| `AUTH_SECRET` | explicit NextAuth secret option; random >=32 characters |
| `ADMIN_EMAILS` | intentional, server-only bootstrap admin allowlist |

`AUTH_URL` and `AUTH_TRUST_HOST` are Auth.js v5 conventions, not substitutes for the installed v4 settings. No duplicate provider, new client or login bypass is added. The route is `src/app/api/auth/[...nextauth]/route.ts`. HTTPS canonical configuration enables secure cookies using NextAuth's existing behavior. Do not disable secure cookies to make the private HTTP origin work. [NextAuth v4 options](https://next-auth.js.org/configuration/options), [Google provider](https://next-auth.js.org/providers/google).

## Existing Google client settings (pending account verification)

Select Google Cloud project **`imtor-production`**, then **Google Auth Platform -> Clients**, and edit the existing **Web application** OAuth client.

- Authorized JavaScript origin: **`https://imtor.applely.dev`**
- Authorized redirect URI: **`https://imtor.applely.dev/api/auth/callback/google`**
- Branding/authorized domain: the operator-controlled `applely.dev` domain, with the real application/privacy links where Google requires them.
- Scopes: existing identity scopes (`openid`, `email`, `profile`), not unrelated APIs.

Store only a replacement client secret in the protected `.env.production`. Never copy a screenshot secret, put it in `NEXT_PUBLIC_*`, pass it as a Docker build argument, or post it in chat. Client IDs are public identifiers, but cannot replace a valid client secret.

The operator reported rotating exposed credentials. However, the actual local file still has Google placeholders. Screenshots are not a secure source of replacement secrets, and no Google Cloud console session or credential-management API is available to this task. Client creation/rotation, callback settings and consent configuration are **not verified**. The application secret was generated locally only because its previous value was a placeholder; existing non-placeholder secrets are preserved.

## Testing versus public publishing

The supplied screenshot showed a Testing restriction. Current live publishing status is unknown. In **Google Auth Platform -> Audience**:

1. If Testing, add each intended Google account under Test users, then test with one of those accounts.
2. To allow general users, review Branding, authorized domains, consent information and requested scopes; select the production publishing action when appropriate. Complete any verification Google actually requires. Do not assume enabling the client alone publishes the app.
3. Internal organization audiences, Workspace policies and Google's applicable verification requirements can still limit access.

[Google's audience/publishing guide](https://support.google.com/cloud/answer/15549945). No claim is made that every Google account can currently sign in.

## End-to-end verification

After the public route, replacement credentials and migrations are ready:

1. Visit `https://imtor.applely.dev/login`; click Google sign-in.
2. Confirm the browser reaches Google's genuine authorization page and that the callback URI is exactly the production URI above.
3. Authorize using an allowed account; return to ImTor.
4. Verify User/Account creation or retrieval, the displayed profile, and a secure HttpOnly session cookie. Do not log cookie/token values.
5. Reload and restart only the app container; verify the database session still works.
6. Confirm guests cannot read admin pages/APIs and a non-admin gets denied. Test the explicit admin allowlist with an intended admin only.
7. Sign out and verify access is revoked appropriately.

The private origin remains HTTP on `imtor-app:3100`; Cloudflare terminates public TLS. Preserve the intended host and forwarded HTTPS context at the trusted edge. Never allow arbitrary public access to the app container.

Troubleshooting: redirect mismatch means compare exact scheme/host/path; provider absent means both credentials must be present at runtime; denied consent means inspect audience/test users, verified email and the app's existing suspension/demo safeguards; lost sessions mean check DB readiness/migrations, unchanged `AUTH_SECRET`, canonical HTTPS origin and cookies. Removing an email from `ADMIN_EMAILS` does not revoke an already-persisted admin role; use the existing authorized demotion/session-revocation procedure.
