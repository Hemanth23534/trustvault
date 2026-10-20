# API reference — Day 1 surface

Base URL locally: `http://localhost:4000`
All responses are `application/json; charset=utf-8`.

Only the endpoints below exist today. Anything else returns the standard 404
envelope — there are no hidden or partially wired routes.

---

## Conventions

### Request IDs

Every response includes:

```
X-Request-Id: 6f1c1c2e-1a1f-4a37-9e55-2f6f0f1f9a11
```

- If the caller sends `X-Request-Id` matching `^[A-Za-z0-9._:-]{8,128}$`, it is
  echoed (useful for tracing a checkout flow across services).
- Anything else — too short, spaces, newlines, 500 characters — is discarded and
  replaced with a fresh UUID, so a hostile value cannot forge or split a log line.
- The same id is in the JSON body as `requestId` and in every server log line for
  that request.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "requestId": "…",
    "details": [{ "path": "email", "message": "Invalid email address" }]
  }
}
```

`details` appears only for client-safe 4xx errors (for example Zod validation).
5xx responses in production contain a generic message and no details; the real
cause is logged with the request id.

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 422 | Request body/params failed schema validation |
| `INVALID_JSON` | 400 | Body was not parseable JSON |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeded 64 kb |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Unsupported charset/encoding |
| `NOT_FOUND` | 404 | No route matches |
| `ORIGIN_NOT_ALLOWED` | 403 | Browser `Origin` is not in `CLIENT_ORIGINS` |
| `CONFLICT` | 409 | Unique/foreign-key conflict |
| `SERVICE_UNAVAILABLE` | 503 | Database or dependency unavailable |
| `INTERNAL_ERROR` | 500 | Unhandled failure (details are logged, not returned) |

### CORS

Only exact origins from `CLIENT_ORIGINS` are allowed. Allowed origins are echoed
in `Access-Control-Allow-Origin` with `Access-Control-Allow-Credentials: true`.
Requests with no `Origin` header (curl, uptime monitors, server-to-server) are
not cross-origin and pass through.

Preflight (`OPTIONS`) is answered with `204` for allowed origins and a `403`
envelope for everything else.

---

## `GET /`

Small service index, convenient for a platform's first smoke test.

```bash
curl http://localhost:4000/
```

```json
{
  "service": "trustvault-api",
  "version": "0.1.0",
  "health": "/api/health",
  "databaseHealth": "/api/health/database"
}
```

---

## `GET /api/health`

**Liveness.** Proves the Node process is up and serving. It does **not** touch
MySQL — a database blip must not cause a platform restart loop.

| | |
|---|---|
| Success | `200` |
| Cache | `Cache-Control: no-store` |
| Side effects | none |

```bash
curl -i http://localhost:4000/api/health
```

```json
{
  "status": "ok",
  "service": "trustvault-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 42.13,
  "timestamp": "2026-10-20T05:12:00.000Z",
  "requestId": "6f1c1c2e-1a1f-4a37-9e55-2f6f0f1f9a11"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | `"ok"` | Always `ok` on 200 |
| `service` | string | `trustvault-api` |
| `version` | string | Matches `server/src/config/service-info.ts` |
| `environment` | `development \| test \| production` | From `NODE_ENV` |
| `uptimeSeconds` | number | Process uptime, 2 decimals |
| `timestamp` | ISO-8601 | UTC |
| `requestId` | string | Same as the `X-Request-Id` header |

Use this for the platform's **liveness** probe and as a free uptime check.

---

## `GET /api/health/database`

**Readiness.** Runs `SELECT 1` through the mysql2 pool with a 2 second ceiling.

| | |
|---|---|
| Success | `200` — `status: "ok"`, `database.status: "up"` |
| Failure | `503` — `status: "error"`, `database.status: "down"` |
| Cache | `Cache-Control: no-store` |

Healthy:

```json
{
  "status": "ok",
  "check": "database",
  "database": { "status": "up", "latencyMs": 2.71 },
  "timestamp": "2026-10-20T05:12:00.000Z",
  "requestId": "0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
}
```

Unavailable (HTTP **503**):

```json
{
  "status": "error",
  "check": "database",
  "database": { "status": "down", "latencyMs": 2001.4, "code": "ECONNREFUSED" },
  "timestamp": "2026-10-20T05:12:00.000Z",
  "requestId": "0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
}
```

`database.code` is a **bounded driver code only** — `ECONNREFUSED`,
`ER_ACCESS_DENIED_ERROR`, `ETIMEDOUT`, `TIMEOUT`, `ER_NO_SUCH_TABLE` — never a raw
driver message, host, user or SQL fragment.

Alias: `GET /api/health/db`.

### Which probe should the platform use?

| Platform setting | Endpoint | Why |
|------------------|----------|-----|
| Liveness / restart | `/api/health` | A DB outage must not restart a healthy process |
| Readiness / traffic | `/api/health/database` | Stop routing traffic to an instance that cannot query |
| Uptime monitor | `/api/health` | Cheapest, no DB load |

---

## Sample session

```powershell
# 1. Is the API alive?
curl.exe -s http://localhost:4000/api/health

# 2. Can it reach MySQL? (expects 200 after `npm run migrate`)
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:4000/api/health/database

# 3. Trace a request end to end
curl.exe -i -H "X-Request-Id: demo-trace-0001" http://localhost:4000/api/health

# 4. See the 404 envelope
curl.exe -i http://localhost:4000/api/nope
```

---

## Not implemented yet

| Planned (day) | Endpoint |
|---------------|----------|
| Day 2 | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Day 3 | `POST /api/documents`, `GET /api/documents`, `GET /api/documents/:id/download`, `POST /api/documents/:id/shares` |
| Day 4 | `GET /api/audit`, `DELETE /api/shares/:id` |
| Day 5 | none — hardening, deployment, demo |

---

# Authentication (Day 2)

Cookie-based, server-side sessions. The browser holds an opaque token in an
HttpOnly cookie; MySQL holds only its SHA-256 hash, plus a per-session CSRF
token.

| Cookie attribute | Development | Production |
|------------------|-------------|------------|
| `HttpOnly` | yes | yes |
| `Secure` | no (plain HTTP) | **yes** |
| `SameSite` | `Lax` (configurable) | `Lax` (configurable) |
| `Path` | `/` | `/` |
| `Max-Age` / `Expires` | derived from `SESSION_TTL_HOURS` | same |

## `POST /api/auth/login`

```json
{ "email": "admin@trustvault.local", "password": "…" }
```

Any `role`, `userId` or `isActive` field in the body is **ignored** — identity
and role come from the database row only.

`200`:

```json
{
  "user": { "id": "…", "email": "admin@trustvault.local", "displayName": "Ava Admin", "role": "admin", "isActive": true },
  "session": { "csrfToken": "…64 hex…", "createdAt": "2026-10-20T09:00:00.000Z", "expiresAt": "2026-10-20T21:00:00.000Z" }
}
```

Plus `Set-Cookie: tv_session=…; HttpOnly; SameSite=Lax; Path=/`.

| Status | Code | When |
|--------|------|------|
| 401 | `INVALID_CREDENTIALS` | Unknown email, wrong password or disabled account — identical response |
| 422 | `VALIDATION_ERROR` | Malformed body |
| 429 | `RATE_LIMITED` | Too many attempts for this IP + email |
| 429 | `ACCOUNT_LOCKED` | Account locked after repeated failures (`Retry-After` is set) |

## `GET /api/auth/me`

Requires the session cookie. Returns the same `{ user, session }` shape, which
is how the SPA recovers its CSRF token after a page reload.

| Status | Code | When |
|--------|------|------|
| 401 | `NOT_AUTHENTICATED` | No cookie |
| 401 | `SESSION_INVALID` | Unknown, revoked, or password changed since login |
| 401 | `SESSION_EXPIRED` | Past `SESSION_TTL_HOURS` |
| 401 | `SESSION_IDLE_TIMEOUT` | Unused longer than `SESSION_IDLE_MINUTES` |
| 403 | `ACCOUNT_DISABLED` | Account deactivated after login (all sessions revoked) |

## `POST /api/auth/logout`

Requires the session cookie **and** `X-CSRF-Token`. Revokes the session row, then
clears the cookie.

- `204 No Content` on success.
- `403 CSRF_TOKEN_INVALID` if the header is missing or wrong.
- `401` with an already-invalid session.

## `GET /api/admin/audit-logs?limit=25&offset=0`

Admin only (`role = 'admin'` from the database). `limit` 1–100, `offset` ≥ 0.

```json
{
  "entries": [
    { "id": "42", "userId": "…", "action": "login_success", "outcome": "success", "resourceType": "session", "resourceId": "…", "ipHash": "…", "userAgent": "…", "metadata": null, "createdAt": "2026-10-20T09:00:00.000Z" }
  ],
  "pagination": { "limit": 25, "offset": 0, "total": 1 }
}
```

`403 FORBIDDEN` for any other role, with `details.requiredRoles: ["admin"]`.

## CSRF rules

- Applies to `POST`, `PUT`, `PATCH`, `DELETE` on authenticated routes.
- `X-CSRF-Token` must match this session's token (constant-time compare).
- If an `Origin` header is present it must be in `CLIENT_ORIGINS`.
- `SameSite=Lax` already blocks cross-site POSTs; the token is defence in depth
  for same-site subdomain and legacy-browser cases.

## Additional error codes

| Code | Status |
|------|--------|
| `NOT_AUTHENTICATED` | 401 |
| `INVALID_CREDENTIALS` | 401 |
| `SESSION_INVALID` | 401 |
| `SESSION_EXPIRED` | 401 |
| `SESSION_IDLE_TIMEOUT` | 401 |
| `ACCOUNT_DISABLED` | 403 |
| `FORBIDDEN` | 403 |
| `CSRF_TOKEN_INVALID` | 403 |
| `ACCOUNT_LOCKED` | 429 |
| `RATE_LIMITED` | 429 |

---

# Documents (Day 3)

Every endpoint below requires a session cookie. State-changing requests also
require `X-CSRF-Token`, checked before the request body is even parsed.

**Access rule (applied in every query):**

> `admin` OR `documents.owner_id = session user` OR an active row in
> `document_permissions` for that document and user.

Documents with `deleted_at` set are invisible everywhere. A user with no access
gets `404`, never `403`: the API does not confirm that a document exists.

## `POST /api/documents`

`multipart/form-data`:

| Field | Required | Notes |
|-------|----------|-------|
| `file` | yes | exactly one file |
| `title` | no | defaults to the file name without extension, max 200 |
| `description` | no | max 2000 |
| `category` | no | `general` (default), `contract`, `invoice`, `report`, `identity`, `other` |

Accepted types are decided by **content**, not just the name: PDF (`%PDF-`),
PNG, JPEG, DOCX/XLSX/PPTX (ZIP container with the matching OOXML folder), and
UTF-8 text/Markdown/CSV (no NUL bytes, mostly printable). Extensions outside the
allow-list are rejected even if the bytes look plausible.

Limits: `MAX_UPLOAD_BYTES` (default 10 MiB), one file per request, 4 KB of form
fields.

`201`:

```json
{
  "document": {
    "id": "6e3e793b-a510-4b24-b94f-6bccb8da0c6d",
    "owner": { "id": "…", "email": "owner@trustvault.local", "displayName": "Owen Owner" },
    "title": "Quarterly report",
    "description": null,
    "fileName": "report.pdf",
    "category": "report",
    "mimeType": "application/pdf",
    "sizeBytes": 51,
    "checksumSha256": "…64 hex…",
    "status": "active",
    "createdAt": "2026-10-20T06:41:12.000Z",
    "updatedAt": "2026-10-20T06:41:12.000Z",
    "access": { "mode": "owner", "permissionRole": null }
  }
}
```

`access.mode` is one of `admin`, `owner`, `co-owner`, `viewer`. `storageKey` is
never part of any response.

| Status | Code | When |
|--------|------|------|
| 401 | `NOT_AUTHENTICATED` | no session |
| 403 | `CSRF_TOKEN_INVALID` | missing/wrong CSRF header |
| 413 | `PAYLOAD_TOO_LARGE` | file over the limit |
| 415 | `UNSUPPORTED_FILE_TYPE` | bad extension, MIME mismatch or content mismatch |
| 422 | `VALIDATION_ERROR` | no file, empty file, no extension, bad fields |

## `GET /api/documents`

Query parameters (all optional):

| Parameter | Notes |
|-----------|-------|
| `search` | substring of title or original file name, `%`/`_` escaped |
| `category` | one of the enum values |
| `owner` | substring of the owner's email or display name |
| `from`, `to` | `YYYY-MM-DD`, inclusive, UTC |
| `sort` | `created_at` (default), `title`, `size` |
| `order` | `desc` (default), `asc` |
| `limit` | 1–100, default 25 |
| `offset` | ≥ 0, default 0 |

```json
{
  "documents": [ { "id": "…", "title": "…", "owner": {}, "category": "report", "sizeBytes": 51, "createdAt": "…", "access": {} } ],
  "pagination": { "limit": 25, "offset": 0, "total": 1 }
}
```

## `GET /api/documents/:id`

Metadata only, same shape as one element above. `404` if deleted or not visible.

## `PATCH /api/documents/:id`

Body accepts any of `title`, `description` (string or `null`), `category`; at
least one is required. Allowed for `admin`, `owner` and `co-owner`. A `viewer`
grant gets `403 DOCUMENT_FORBIDDEN`.

## `DELETE /api/documents/:id`

Soft delete: sets `deleted_at`, keeps the row and the stored bytes for recovery.
Returns `204`. Allowed for the same roles as `PATCH`; a `viewer` gets `403`.

## `GET /api/documents/:id/download`

Authorizes first, then streams the bytes. Always:

- `Content-Disposition: attachment` with an ASCII fallback and RFC 5987 name
- `Cache-Control: no-store, private`
- `X-Content-Type-Options: nosniff`
- the exact stored MIME type

There is no public URL, no signed link and no redirect: every download is an
authorized, audited request. A deleted document returns `404`.

| Status | Code | When |
|--------|------|------|
| 401 | `NOT_AUTHENTICATED` | no session |
| 404 | `DOCUMENT_NOT_FOUND` | missing, deleted, or no access |
| 500 | `INTERNAL_ERROR` | metadata exists but the stored file is gone (logged) |
