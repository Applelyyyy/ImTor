# S3-compatible images (Cloudflare R2 / AWS S3)

## Runtime configuration

ImTor uses AWS SDK v3; credentials remain server-only. Use a bucket-scoped key with only the object read/write/delete permissions required by this application's upload workflow, not an account-wide administration token.

| Variable | R2 example / meaning |
|---|---|
| `S3_PROVIDER` | `r2` (or configured S3 provider label) |
| `S3_ENDPOINT` | `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` for R2; actual region for AWS S3 |
| `S3_BUCKET` | Dedicated application bucket |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket-scoped server credentials |
| `S3_PUBLIC_BASE_URL` | Public read base for **approved** image keys only |
| `S3_FORCE_PATH_STYLE` | Usually `false`; enable only for an endpoint needing it |

`S3_PUBLIC_BASE_URL` is also a non-secret image-build argument for the Next.js image allowlist. Rebuild after changing its origin; never pass S3 credentials as build arguments.

For AWS use the correct regional S3 endpoint and configure public delivery through CloudFront or an explicitly scoped read policy. Do not make an entire upload bucket public. For R2 configure a dedicated custom image domain and approved-key-only public routing; an R2 bucket custom domain exposes bucket objects by default, so **do not attach an unrestricted public custom domain to a bucket also containing private staging**.

## Critical storage isolation

Uploads use a two-stage lifecycle:

1. Authenticated merchant requests a bounded short-lived PUT authorization.
2. Browser uploads into a **private staging key**, never directly to a trusted published image URL.
3. Finalize authenticates ownership, fetches the actual bytes and enforces size/type/image decoding limits.
4. Sharp decodes and re-encodes the image, stripping untrusted source metadata/content.
5. Server writes the safe image under a **new immutable approved key**; only that resulting URL can be attached to a listing.
6. Staging objects are not public. Reusing a still-valid staging PUT URL cannot replace the approved image.

`S3_PUBLIC_BASE_URL` is not permission enforcement. The storage/CDN edge must expose only the exact approved prefix used in the implementation (for example `approved/`) and deny `staging/` and all other keys. Use a Worker/origin gateway with a private bucket binding and strict prefix validation, or an equivalent bucket/CDN policy. If using a public bucket instead, separate private staging and approved storage requires corresponding application multi-bucket support; do not assume that merely naming two prefixes makes private data private.

Never put access keys in the browser. Do not store a presigned URL as a permanent product image. Do not approve based only on a MIME header or filename. Listings must reference server-approved ownership-bound uploads, not arbitrary client URLs. Concurrent/repeated finalization must not permit approved images to mutate.

## CORS for browser PUT

Set CORS on the private upload endpoint for **your exact application origins**, not `*` in production. Example rule (replace origins):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR_DOMAIN"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Match any additional signed headers exactly if added by the uploader. Browser preflight is handled by the storage provider; don't add `OPTIONS` as an unsupported S3 CORS method. CORS does not authorize requests or make staging objects private. Public approved images normally load via ordinary image GET; configure separate read CORS only if another browser feature genuinely needs it. See [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) and [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Operations and verification

Choose an abandoned-staging lifecycle policy only after confirming its prefix and age; do not delete approved images still referenced by products. Back up/version approved objects according to data-retention needs; PostgreSQL archives contain URLs/metadata, not image bytes. Keep development/test and production namespaces or buckets separate.

With real credentials, test authorized PUT + finalization + public approved read; unauthorized upload/finalization rejection; malformed/oversized/non-image input rejection; and staging URL reuse failing to mutate the approved key. Confirm the staging URL returns no unauthenticated public GET. Network-independent tests or a build cannot prove external bucket permissions/CORS. No live R2/S3 credentials, bucket changes or successful public upload are implied by this runbook.
