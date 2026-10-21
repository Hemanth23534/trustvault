# TrustVault

**Secure document sharing for teams.** Private document storage, real
server-side sessions, and share links that expire — built in five days for the
Snovasys hackathon.

> **Day 5 of 5 — production-ready submission complete.** All five phases are delivered:
> React 19 SPA, Express 5 API, MySQL 8 schema with 5 forward-only migrations,
> document-level permissions with instant revocation, tamper-evident hash-chained
> audit logs, administrative governance, and an independent application security review
> with confirmed fixes and regression tests.

![stack](https://img.shields.io/badge/stack-Node%2022%20%C2%B7%20Express%205%20%C2%B7%20React%2019%20%C2%B7%20MySQL%208-0b1220)
![tests](https://img.shields.io/badge/tests-237%20passed%20(17%20suites)-0b1220)
![license](https://img.shields.io/badge/license-MIT-green)

🌐 **Live Deployment**: Deployable to Render or Railway with 1-click MySQL backend. See [Live Deployment Guide](#live-deployment-getting-a-public-url).

---

## What exists today

| Area | Status |
|------|--------|
| React 19 + TypeScript + Vite client | ✅ 12 pages (login, register, workspace management, dashboards, detail, share, audit, history) |
| Express 5 + TypeScript API | ✅ health, auth, workspace, documents, permissions, insights, admin |
| Validated environment (Zod, fail-fast) | ✅ rejects placeholder secrets in production, supports cloud SSL |
| MySQL 8 / TiDB Cloud connection pool (`mysql2`) | ✅ UTC, named placeholders, SSL/TLS, no stacked queries |
| Forward-only migration runner | ✅ 7 migrations, checksums, advisory lock, dry-run |
| Helmet, CORS allow-list, request IDs | ✅ tested across all endpoints, strict origin matching |
| Centralised error handling | ✅ sanitized JSON envelope, zero stack/SQL leakage |
| Private storage directory | ✅ outside web root, mode `0700`/`0600`, magic byte check |
| Auth (bcrypt + MySQL sessions) | ✅ HttpOnly/SameSite/Secure, CSRF, dual-tier rate limiting |
| Document permissions & sharing | ✅ owner/admin/editor/viewer, immediate revocation, admin isolation |
| Tamper-evident audit trail & admin | ✅ SHA-256 hash chaining, DB triggers, admin dashboard |
| Independent security review & fixes | ✅ 13 categories evaluated, 3 fixed, 1 documented residual |
| Public self-registration | ✅ Personal accounts or Company Workspaces with unique tenant IDs |
| Multi-tenant company workspaces | ✅ Complete isolation on docs, members & audit logs (Migration 0006 & 0007) |
| Team invitations & role management | ✅ Token-based invites (`?invite=...`), member removal, role updates |
| Password reset & email verification | ℹ️ Planned roadmap (documented token spec; requires external SMTP) |

### Account Model & Production Readiness Status

| Feature | Status | Implementation Details |
|---|---|---|
| Operator-seeded Demo Accounts | ✅ Implemented | `admin`, `owner`, `viewer` provisioned via `npm run seed`; refused in production unless `SEED_ALLOW_PRODUCTION=true` |
| Password Hashing & Salt | ✅ Implemented | bcrypt (cost factor 12), constant-time comparisons, dummy-hash timing attack protection |
| Server-side Sessions & CSRF | ✅ Implemented | HttpOnly, SameSite=Lax, Secure in production; per-session synchronizer CSRF tokens on mutating requests |
| Dual-tier Rate Limiting | ✅ Implemented | Tier-1 global per-IP ceiling (spray prevention) + Tier-2 per-(IP+email) account brute-force protection |
| Document Permissions & Revocation | ✅ Implemented | Row-level checks on every request; zero caching latency; immediate 404 on revocation; admin file isolation |
| Public Registration & Workspaces | ✅ Implemented | Public self-service registration; choose Personal Workspace or create a Company Workspace; accept invitation links |
| Multi-tenant Data Isolation | ✅ Implemented | Unique tenant IDs; server checks user company membership; uninvited cross-tenant access blocked (404) |
| Explicit Cross-Tenant Sharing | ✅ Implemented | Explicit grants in `document_permissions` allow sharing across tenants with instant revocation |
| Team Invitations & RBAC | ✅ Implemented | `owner` (manage workspace/members/settings), `admin` (manage members/docs), `editor` (edit own and granted docs), `viewer` (read/download only) |
| Password Reset & Email Verification | ℹ️ Documented Spec | Token-based recovery spec documented in THREATS.md; requires external mail service (SendGrid/AWS SES) |

See **[THREATS.md](THREATS.md)** for the threat model,
**[PROMPTS.md](PROMPTS.md)** for the AI-assistance log, and
**[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** for the 5-minute hackathon presentation.

---

## Verified on this machine

Everything below was executed and verified locally
(Node 22.13.0, npm 10.9.2, MySQL 8 / TiDB Cloud, Windows 11).

| Check | Command | Result |
|-------|---------|--------|
| Server type check | `npm run typecheck --workspace @trustvault/server` | ✅ 0 errors |
| Client type check | `npm run typecheck --workspace @trustvault/client` | ✅ 0 errors |
| Server tests | `npm run test:server` | ✅ 15 files, **255 tests passed** |
| Client tests | `npm run test:client` | ✅ 4 files, **32 tests passed** |
| Total automated test count | `npm test` | ✅ 19 files, **287 tests passed** |
| Production build | `npm run build` | ✅ `server/dist` (tsc) + `client/dist` (Vite + postbuild SPA routes) |
| Workspace & invites suite | `npx vitest run server/tests/workspace-and-invitations.test.ts` | ✅ 17 tests passed (invitations, revocation persistence, member doc revocation, RBAC) |
| Company registration suite | `npx vitest run server/tests/company-registration.test.ts` | ✅ 5 tests passed (registration, duplicate 409, escalation block, tenant isolation) |
| Security regression suite | `npx vitest run server/tests/security-regression.test.ts` | ✅ 5 tests passed (spray throttling, title redaction, revocation) |
| Liveness | `GET /api/health` | ✅ 200 + Helmet headers, `X-Request-Id`, `no-store` |
| Readiness (DB probe) | `GET /api/health/database` | ✅ 200 / 503 sanitized driver codes |
| CORS allow/deny | `Origin: http://localhost:5173` vs untrusted | ✅ allow-list echoed vs 403 `ORIGIN_NOT_ALLOWED` |
| Error envelope | `GET /api/nope` | ✅ 404 JSON envelope with correlation `requestId` |
| Secret audit | `git ls-files` + staged grep | ✅ `.env` untracked, zero secrets in commits |
| Migration on real MySQL | `migrate up` against MySQL 8.0.46 | ✅ `Applied 0001_foundation (2 statement(s), 122 ms)` |
| Migration idempotency | second `migrate up` | ✅ `No pending migrations.` |
| Migration status | `migrate status` | ✅ `1 applied, 0 pending, 0 drifted, 0 missing` |
| Schema inspection | `SHOW TABLES` | ✅ `schema_migrations`, `sessions`, `users` |
| Liveness | `GET /api/health` | ✅ 200 + all Helmet headers, `X-Request-Id`, `no-store` |
| Readiness (DB up) | `GET /api/health/database` | ✅ 200 `{"status":"ok","database":{"status":"up","latencyMs":33.12}}` |
| Readiness (DB down) | API running, MySQL credentials unset | ✅ 503 `{"code":"ER_ACCESS_DENIED_ERROR"}` — sanitized, no host/SQL leak |
| Request-ID echo | `X-Request-Id: demo-trace-0001` | ✅ echoed in header and body |
| Request-ID sanitising | `X-Request-Id: short` | ✅ replaced with a UUID |
| CORS allow | `Origin: http://localhost:5173` | ✅ origin echoed, `Allow-Credentials: true`, `Vary: Origin` |
| CORS deny | `Origin: https://attacker.example` | ✅ 403 `ORIGIN_NOT_ALLOWED` |
| Error envelope | `GET /api/nope` | ✅ 404 JSON envelope with `requestId` |
| Secret audit | `git ls-files` + staged-content grep | ✅ `.env` untracked, no secret-shaped strings in the staged files |

The migration run used a **throwaway MySQL 8 instance** (temporary data
directory on port 3307, removed afterwards) so your local database was never
touched and no credentials were needed.

**One step is still yours on this machine:** create the `trustvault` database and
user (step 4 of the quickstart). Until then, `/api/health/database` correctly
returns 503 and `npm run migrate` reports `Access denied for user
'trustvault'@'localhost'` — the API itself stays healthy, which is exactly the
liveness/readiness split working as designed.

A local `.env` was generated for the smoke test with a random 64-character
`SESSION_SECRET` and an empty `DATABASE_PASSWORD`. Set the real password after
creating the database user.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Client | React 19, TypeScript 5.9, Vite 7 | Fast dev loop, static hosting anywhere |
| API | Node 22, Express 5, TypeScript | Async errors propagate natively in Express 5 |
| Database | MySQL 8 (`mysql2`) | Sessions need row-level revocation, not just JWTs |
| Config | Zod | One place to fail fast on bad env |
| Logging | pino | Structured JSON, redaction, cheap |
| Tests | Vitest + Supertest | Real HTTP assertions against the real app |
| Storage | Private filesystem directory | Never inside `client/`, never web-served |

## Repository layout

```
trustvault/
├── client/                     React + TypeScript + Vite
│   ├── src/
│   │   ├── lib/api.ts          typed fetch client (credentials: include)
│   │   ├── components/         BrandMark, StatusCard
│   │   ├── App.tsx             live health dashboard
│   │   └── styles.css          self-contained theme
│   └── vite.config.ts          Vite + Vitest config
├── server/                     Express + TypeScript API
│   ├── src/
│   │   ├── app.ts              createApp() — middleware order lives here
│   │   ├── index.ts            boot, graceful shutdown, storage init
│   │   ├── config/             env validation, logger, service metadata
│   │   ├── db/                 pool, migration runner, migration helpers
│   │   ├── http/               errors, middleware, routes
│   │   ├── storage/            private storage helpers
│   │   ├── scripts/migrate.ts  migration CLI
│   │   └── types/express.d.ts  req.id augmentation
│   └── tests/                  Vitest + Supertest suites
├── database/
│   ├── bootstrap.sql           database + least-privilege user (template)
│   ├── migrations/             forward-only schema history
│   └── seeds/                  optional local fixtures
├── docs/                       architecture, API reference, VS Code commands
├── .env.example                safe template — copy to .env
├── THREATS.md                  threat model
└── PROMPTS.md                  AI usage log
```

---

## Quickstart (VS Code)

**Prerequisites:** Node.js ≥ 22.12, npm ≥ 10, MySQL 8 running locally, and the
repository open in VS Code (`Ctrl+~` opens the integrated terminal).

### 1. Install dependencies

```powershell
npm install
```

This is an npm workspace: one install covers `client/` and `server/`.

### 2. Create your environment file

```powershell
Copy-Item .env.example .env
```

`.env` is git-ignored. Never commit it, paste it in chat, or screenshot it.

### 3. Generate a session secret

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the 64-character result into `.env` as `SESSION_SECRET=...`. The server
refuses to start production with a placeholder secret.

### 4. Create the database and a least-privilege user

Follow **[database/README.md](database/README.md#1-create-the-database-and-user)**
— it shows a password-generating one-liner so the secret never touches disk.
Then set `DATABASE_USER` / `DATABASE_PASSWORD` in `.env`.

### 5. Apply the migrations

```powershell
npm run migrate:status   # looks at the schema, changes nothing
npm run migrate:dry      # prints the plan, executes nothing
npm run migrate          # applies 0001_foundation
```

Expected: `Applied 0001_foundation ...` then `Database is up to date.` on a
second run.

### 6. Seed demo accounts (development only)

```powershell
npm run seed --workspace @trustvault/server
```

Generates or updates the 3 demo accounts (`owner@trustvault.local`, `viewer@trustvault.local`, `admin@trustvault.local`). Refuses to run against production unless `SEED_ALLOW_PRODUCTION=true`.

### 7. Run both apps

```powershell
npm run dev
```

- client → <http://localhost:5173>
- API → <http://localhost:4000>

Or run them in two terminals if you prefer separate logs:

```powershell
npm run dev:server
npm run dev:client
```

### 8. Prove the API works

```powershell
curl.exe http://localhost:4000/api/health
curl.exe http://localhost:4000/api/health/database
```

Both return JSON. The database endpoint returns **503** with
`database.status: "down"` when MySQL is unreachable — that is the correct
readiness signal, not a crash.

---

## Environment variables

Copy `.env.example` → `.env`. The server loads, in order: real process env,
`server/.env`, then `.env` (first value wins).

| Variable | Default | Required | Notes |
|----------|---------|----------|-------|
| `NODE_ENV` | `development` | no | `production` enables HSTS + strict checks |
| `PORT` | `4000` | no | API port |
| `HOST` | `0.0.0.0` | no | Bind address |
| `TRUST_PROXY` | `0` | no | Set to `1` behind one proxy (Render/Railway/nginx) |
| `CLIENT_ORIGINS` | `http://localhost:5173` | no | Comma-separated exact origins; wildcards rejected |
| `SESSION_SECRET` | — | **yes** | ≥ 32 chars; placeholders rejected in production |
| `SESSION_COOKIE_NAME` | `tv_session` | no | `[A-Za-z0-9_-]{3,64}` |
| `SESSION_TTL_HOURS` | `12` | no | 1–720 |
| `DATABASE_HOST` | `127.0.0.1` | no | |
| `DATABASE_PORT` | `3306` | no | |
| `DATABASE_USER` | `trustvault` | no | |
| `DATABASE_PASSWORD` | *(empty)* | **yes in production** | Empty only works for a local passwordless user |
| `DATABASE_NAME` | `trustvault` | no | `[A-Za-z0-9_]` only |
| `DATABASE_CONNECTION_LIMIT` | `10` | no | 1–50 |
| `STORAGE_DIR` | `./storage` | no | Resolved from `server/`; git-ignored |
| `MAX_UPLOAD_BYTES` | `10485760` | no | 10 MiB ceiling |
| `LOG_LEVEL` | `info` | no | `fatal…trace` or `silent` |
| `FRONTEND_URL` | *(first client origin)* | no | Base URL for invitation links |
| `VITE_API_BASE_URL` | `http://localhost:4000` | client `.env` | Baked in at build time |

Environment problems are reported **all at once**, at boot, with actionable
messages — the process exits instead of running half-configured.

---

## npm scripts

Run from the repository root.

| Command | What it does |
|---------|--------------|
| `npm run dev` | API + client together (concurrently, kill-on-exit) |
| `npm run dev:server` | API with `tsx watch` on :4000 |
| `npm run dev:client` | Vite dev server on :5173 |
| `npm run build` | Type-check + build both packages |
| `npm run build:server` | `tsc` → `server/dist` |
| `npm run build:client` | `tsc --noEmit && vite build` → `client/dist` |
| `npm run typecheck` | `tsc --noEmit` in both packages |
| `npm test` | Server suite, then client suite |
| `npm run test:server` | Vitest + Supertest |
| `npm run test:client` | Vitest |
| `npm start` | Run the built API (`server/dist/index.js`) |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:status` | Applied / pending / drift, changes nothing |
| `npm run migrate:dry` | Print the migration plan, execute nothing |

---

## API reference

Full details in **[docs/API.md](docs/API.md)**.

### `GET /api/health` — liveness

Never touches the database, so a transient MySQL outage cannot restart-loop the
API.

```json
{
  "status": "ok",
  "service": "trustvault-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 12.34,
  "timestamp": "2026-10-20T05:12:00.000Z",
  "requestId": "6f1c1c2e-1a1f-4a37-9e55-2f6f0f1f9a11"
}
```

### `GET /api/health/database` — readiness

`200` when MySQL answers `SELECT 1`, `503` when it does not.

```json
{
  "status": "ok",
  "check": "database",
  "database": { "status": "up", "latencyMs": 2.71 },
  "timestamp": "2026-10-20T05:12:00.000Z",
  "requestId": "0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
}
```

### Error envelope

Every failure — validation, CORS, 404, 500 — uses one shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No route matches GET /api/nope",
    "requestId": "…"
  }
}
```

Every response also carries an `X-Request-Id` header (a generated UUID, or a
validated inbound value), and that id appears in the server logs.

---

## Migrations

```powershell
npm run migrate:status
npm run migrate:dry
npm run migrate
```

- Files: `database/migrations/NNNN_snake_case.sql`, applied in filename order.
- A SHA-256 checksum is stored per migration; editing applied history is a hard
  error, so the fix is always a **new** migration.
- A MySQL advisory lock prevents two deploys from running the same migration.
- Forward-only: there is deliberately no `down`/`reset` command, so the CLI
  cannot drop your data.
- Migrations are never auto-run at boot — applying schema changes is an explicit
  step.

Details: **[database/README.md](database/README.md)**.

---

## Tests

```powershell
npm test
```

| Suite | Covers |
|-------|--------|
| `server/tests/env.test.ts` | defaults, coercion, production guardrails, origin normalization, warnings |
| `server/tests/health.test.ts` | liveness/readiness shapes, request-id echo and sanitising, 503 behaviour |
| `server/tests/middleware.test.ts` | 404 envelope, Helmet headers, CORS allow/deny/preflight, body limits, error mapping, no leakage in production |
| `server/tests/migrations.test.ts` | naming, checksums, statement splitting, drift, lock contention, dry run |
| `server/tests/db-and-storage.test.ts` | probe timeout/sanitising, path traversal containment |
| `client/src/lib/api.test.ts` | URL normalization/joining, error typing |

Tests need **no database**: the readiness probe is injected, so the suite runs
on any machine and in CI.

---

## Deployment

### Client → Vercel (or any static host)

| Setting | Value |
|---------|-------|
| Root directory | repository root |
| Install command | `npm install` |
| Build command | `npm run build:client` |
| Output directory | `client/dist` |
| Env var | `VITE_API_BASE_URL=https://your-api-host` (rebuild after changing) |

### API → Render / Railway / Fly.io (Node host)

| Setting | Value |
|---------|-------|
| Root directory | repository root |
| Build command | `npm ci && npm run build:server` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Runtime | Node 22 |

Set `NODE_ENV=production`, `TRUST_PROXY=1`, a fresh `SESSION_SECRET`, the
managed MySQL credentials, and `CLIENT_ORIGINS=https://your-client-host`.

Run `npm run migrate` once as a release/pre-deploy step — never automatically on
every boot unless you have the lock story working.

**Managed MySQL requirements:** InnoDB, `utf8mb4_0900_ai_ci`, and `GET_LOCK()`
support. PlanetScale historically does not support `GET_LOCK`, so the migration
lock fails there; Railway/Aiven/RDS MySQL are known-good.

**Cross-site cookies (Day 2 note):** when the SPA and API are on different
domains, the session cookie needs `SameSite=None; Secure`. That is a deliberate
decision to revisit with CSRF protection in place, because `None` widens the CSRF
surface. Local development uses same-site `Lax`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL not running, or wrong `DATABASE_HOST`/`PORT` |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DATABASE_USER`/`PASSWORD`; re-run the bootstrap SQL |
| `Invalid environment configuration` | Boot-time validation; the message lists every bad variable |
| `ER_NO_SUCH_TABLE` / readiness 503 | Run `npm run migrate` |
| Client shows "Could not reach the API" | Start the API (`npm run dev:server`) and check `VITE_API_BASE_URL` |
| Browser blocks the request (CORS) | Add the exact origin to `CLIENT_ORIGINS` and restart the API |
| `EADDRINUSE :4000` | Another process owns the port: `Get-NetTCPConnection -LocalPort 4000` |
| `npm error code EPERM` on cache writes | A restricted sandbox is blocking npm's global cache. Set `npm_config_cache` to a folder you own, e.g. `$env:npm_config_cache = "$PWD\.npm-cache"` |
| `utf8mb4_0900_ai_ci` unknown collation | You are on MySQL 5.7; this project targets MySQL 8 |

---

## Five-day plan

| Day | Theme | Deliverable |
|-----|-------|-------------|
| 1 | Foundation | ✅ monorepo, config, pool, migrations, health checks, tests |
| 2 | Identity | ✅ bcrypt login, MySQL sessions, CSRF, throttling, audit trail |
| 3 | Documents | ✅ private uploads, ownership checks, search, streaming downloads |
| 4 | Trust | ✅ per-document permissions, immediate revocation, admin isolation |
| 5 | Ship | ✅ audit tamper evidence, admin dashboard, security audit & fixes |

---

## Ground rules

1. **Never commit secrets.** `.env` stays local; `.env.example` holds placeholders.
2. **Migrations are forward-only.** Edit history = red CI.
3. **No feature without a test** and a row in `THREATS.md` if it changes risk.
4. **Small steps.** Each day adds one capability with its guardrails, never a
   half-built pile of features.

Built by the TrustVault team for the Snovasys hackathon.

---

## Day 2 — Authentication (current state)

Sign-in is live: bcrypt hashes, MySQL-backed sessions, rotation on login,
CSRF-protected writes, login throttling and an append-only audit trail.

### Requirements → implementation

| Requirement | Implementation |
|-------------|----------------|
| Login and logout | `POST /api/auth/login`, `POST /api/auth/logout` |
| Password hashing | bcrypt via `bcryptjs` 3.x (pure JS, no native build), cost from `BCRYPT_COST` |
| Persistent server-side sessions | `sessions` table; cookie holds an opaque 256-bit token, MySQL stores only its SHA-256 |
| Session ID regeneration | Every login creates a new session row, token and CSRF token; any session presented on the login request is revoked first |
| HttpOnly / Secure cookies | `HttpOnly` always; `Secure` whenever `NODE_ENV=production` |
| Session expiry + rate limiting | Absolute TTL, idle timeout, per-IP+email limiter, and per-account lockout with `Retry-After` |
| CSRF protection | Per-session token echoed in `X-CSRF-Token`, constant-time compare, plus an `Origin` allow-list check |
| Active account on every request | `users.is_active` (and password-change time) re-read from the session join on every authenticated call |
| Never trust client role/user id | Login strips `role`/`userId`; guards read the role off the session's database row |
| No public admin registration | There is no registration endpoint at all; `npm run seed` is the only way an admin exists |
| No hashes/cookies/secrets in responses | Queries select explicit columns; a test serialises auth responses and asserts no hash, token or `tokenHash` appears |
| Demo seed | `server/src/scripts/seed.ts` — generated passwords printed once, idempotent, refuses production |

### New environment variables

Added on top of the Day-1 table:

| Variable | Default | Notes |
|----------|---------|-------|
| `SESSION_IDLE_MINUTES` | `60` | Inactivity timeout (5–1440) |
| `SESSION_COOKIE_SAME_SITE` | `lax` | `lax` \| `strict` \| `none`; `none` requires HTTPS |
| `BCRYPT_COST` | `12` | Work factor, 10–14 |
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` | Failures before a lock |
| `LOGIN_LOCK_MINUTES` | `15` | Lock duration |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Attempts per (IP + email) |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | `15` | Window for the limiter |
| `SEED_ADMIN_PASSWORD`, `SEED_OWNER_PASSWORD`, `SEED_VIEWER_PASSWORD` | unset | Optional fixed seed passwords; if unset, strong ones are generated |

### Run it

```powershell
npm run migrate:status   # expect 2 migrations available
npm run migrate          # applies 0002_auth_documents
npm run seed             # creates admin/owner/viewer demo accounts
npm run dev              # API + client, then sign in at http://localhost:5173
```

The seed prints generated passwords exactly once:

```
email                        role     status            password
admin@trustvault.local       admin    created           <generated>
owner@trustvault.local       owner    created           <generated>
viewer@trustvault.local      viewer   created           <generated>
```

### Auth endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | none (rate limited) | Sets the HttpOnly session cookie |
| GET | `/api/auth/me` | session | Returns user + fresh CSRF token after reload |
| POST | `/api/auth/logout` | session + CSRF | Revokes the row, clears the cookie |
| GET | `/api/admin/audit-logs` | admin | Newest-first audit trail |

Full request/response reference: [docs/API.md](docs/API.md#authentication-day-2).

### Schema

Five product tables plus the migration ledger:
`users`, `sessions`, `documents`, `document_permissions`, `audit_logs`.
Columns, indexes, foreign keys, role semantics and the session lifecycle are
documented in **[docs/DATABASE.md](docs/DATABASE.md)**.

### Test coverage added

| Area | Where |
|------|-------|
| Login success, cookie flags, hash-at-rest, rotation | `server/tests/auth.test.ts` |
| Invalid password, unknown email, disabled account | `server/tests/auth.test.ts` |
| Logout, CSRF missing/foreign token | `server/tests/auth.test.ts` |
| Absolute expiry, idle timeout, password-change invalidation | `server/tests/auth.test.ts` |
| Privilege escalation (role in body, viewer/owner on admin route, forged cookie) | `server/tests/auth.test.ts` |
| Rate limiting and lockout | `server/tests/auth.test.ts` |
| Cookie parsing, token hashing, IP hashing, bcrypt policy, limiter windows | `server/tests/auth-units.test.ts` |
| Client auth wiring (credentials, CSRF header, 204 handling) | `client/src/lib/auth.test.ts` |

### Notes and deliberate trade-offs

- `bcryptjs` is used instead of native `bcrypt`/`argon2`: identical bcrypt
  algorithm, no node-gyp build step on Windows, no binary supply-chain risk.
- Session tokens are hashed at rest; the CSRF token is stored in plaintext
  because the browser must read it back after a reload, and it is useless
  without the HttpOnly cookie.
- The login rate limiter is in-memory and therefore per-process. Fine for one
  instance; a multi-instance deployment needs a shared store (documented in
  `THREATS.md`).
- `documents` and `document_permissions` exist as schema only — upload and
  sharing endpoints arrive on Day 3.

### Verified on this machine (Day 2)

Executed against a throwaway MySQL 8.0.46 instance (port 3307, removed
afterwards), so no local credentials were needed and nothing was left behind.

| Check | Result |
|-------|--------|
| Server type check | ✅ clean |
| Client type check | ✅ clean |
| Server tests | ✅ **132 passed** (7 files) |
| Client tests | ✅ **12 passed** (2 files) |
| Production build | ✅ `server/dist` + `client/dist` (238 kB JS / 13.3 kB CSS) |
| Migrations on real MySQL | ✅ `0001_foundation` (113 ms), `0002_auth_documents` (581 ms) |
| Seed | ✅ 3 accounts, bcrypt `$2b$12$` hashes only |
| Login | ✅ 200, `HttpOnly`, `SameSite=Lax`, no `Secure` on local HTTP |
| `/api/auth/me` | ✅ 200 with the session cookie |
| Admin audit | ✅ 200, entries include `login_success` |
| Logout without CSRF | ✅ 403 `CSRF_TOKEN_INVALID` (session survives) |
| Logout with another session's CSRF | ✅ 403 `CSRF_TOKEN_INVALID` |
| Logout with own CSRF | ✅ 204, session row revoked |
| Reuse after logout | ✅ 401 `SESSION_INVALID` |
| Wrong password | ✅ 401 `INVALID_CREDENTIALS`, no enumeration wording |
| `role: "admin"` in login body | ✅ ignored; stored role stayed `viewer` |
| Viewer on `/api/admin/audit-logs` | ✅ 403 `FORBIDDEN` |
| Database state | ✅ 2 sessions (1 revoked), audit rows for login/logout |

Two real bugs were caught by this end-to-end run rather than by unit tests, both
now fixed and documented in [PROMPTS.md](PROMPTS.md) and
[docs/DATABASE.md](docs/DATABASE.md#timezone-invariant-learned-the-hard-way):

1. SQL `NOW()` (server time zone) disagreed with the driver's UTC frame, so fresh
   sessions looked older than `password_changed_at` and were revoked instantly.
2. The migration suite assumed exactly one migration file existed.

---

## Day 3 — Document management (current state)

Uploads, search, metadata, protected downloads, metadata edits and soft delete
are live. Bytes live outside the repo in private storage; MySQL holds metadata
only.

### Requirements → implementation

| Requirement | Implementation |
|-------------|----------------|
| Upload documents | `POST /api/documents` (multipart, one file, optional title/category/description) |
| List discoverable documents | `GET /api/documents`, scoped by the access predicate |
| Search by name, owner, category, date | `search`, `owner`, `category`, `from`/`to` query parameters, all parameterized |
| View metadata | `GET /api/documents/:id` |
| Protected download | `GET /api/documents/:id/download`, authorized then streamed as an attachment |
| Edit permitted metadata | `PATCH /api/documents/:id` — owner, co-owner or admin only |
| Soft delete | `DELETE /api/documents/:id` sets `deleted_at`, hides every read path, keeps the bytes |
| Display fields | Name/title, owner, category, size and creation date in the client table |

### Security properties

| Property | How |
|----------|-----|
| Private storage | `STORAGE_DIR` outside `client/`, mode `0700`/`0600`, never web-served |
| Server-generated keys | `yyyy/mm/<uuid>.<ext>`; the upload name never becomes a path |
| No overwrites | Keys are UUIDs and files are written with `flag: 'wx'` |
| Content validation | Extension allow-list + MIME consistency + magic bytes (PDF/PNG/JPEG), OOXML structure, UTF-8 text check |
| Size/type rejection | `MAX_UPLOAD_BYTES`, 415 for unsupported or mismatched content, 413 for oversize |
| Path traversal | Strict key pattern + containment check before any filesystem call |
| No public links | Only authorized, audited streaming; `no-store`, `attachment`, no redirects |
| Authorization everywhere | The same predicate is applied to list, count, fetch, update, delete and download |

### Endpoints

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/documents` | any signed-in user (becomes owner) |
| GET | `/api/documents` | any signed-in user (own + granted) |
| GET | `/api/documents/:id` | admin, owner, co-owner, granted viewer |
| PATCH | `/api/documents/:id` | admin, owner, co-owner |
| DELETE | `/api/documents/:id` | admin, owner, co-owner |
| GET | `/api/documents/:id/download` | admin, owner, co-owner, granted viewer |

Full reference: [docs/API.md](docs/API.md#documents-day-3).

### Run it

```powershell
npm run migrate        # applies 0003_document_management
npm run seed           # demo admin/owner/viewer
npm run dev            # http://localhost:5173, sign in and use the Documents panel
```

Upload flow: pick a file, optionally set a title/category, press **Upload**. The
table shows name, owner, category, size and created date; **Download**, **Edit**
and **Delete** appear according to your access.

### Storage layout

```
server/storage/2026/10/6e3e793b-a510-4b24-b94f-6bccb8da0c6d.pdf
                 └ date ┘ └──────── server-generated uuid ────────┘
```

`server/storage/` is git-ignored. Nothing under it is reachable over HTTP.

### Test coverage added

| Area | Tests |
|------|-------|
| Upload success, generated key, checksum, no `storageKey` in responses | `server/tests/documents.test.ts` |
| Unauthenticated upload, CSRF, unsupported extension, content mismatch, empty, no extension, oversize | same file |
| Filename traversal and same-name overwrite avoidance | same file |
| Listing isolation, grants, admin visibility | same file |
| Search (title/file name), category, owner, date range, LIKE escaping, pagination | same file |
| Metadata edits: owner, co-owner, admin, viewer 403, stranger 404, validation | same file |
| Download: bytes, headers, stranger 404, grant 200, deleted 404, no public link | same file |
| Storage key traversal and UUID-only keys | same file |
| Client query building, formatting, upload/PATCH wiring | `client/src/lib/documents.test.ts` |

### Verified on this machine (Day 3)

Executed against a throwaway MySQL 8.0.46 instance and a temporary storage
directory (both removed afterwards):

| Check | Result |
|-------|--------|
| Migrations | ✅ 0001 (160 ms), 0002 (762 ms), **0003 (251 ms)** — 3 applied, 0 drifted |
| Seed | ✅ 3 demo accounts |
| Upload valid PDF | ✅ 201, `access.mode: owner`, checksum present, no storage key in the response |
| List / search | ✅ owner sees 1, `search=quarterly` matches, a miss returns 0 |
| Metadata | ✅ 200 |
| Download | ✅ 200, SHA-256 of the downloaded file matches the source |
| Metadata edit | ✅ 200, title updated |
| Stranger | ✅ 0 documents, download 404, edit 404 |
| Granted viewer (direct SQL grant) | ✅ list sees 1 (`viewer`), download 200, edit 403 `DOCUMENT_FORBIDDEN` |
| Admin | ✅ can edit any document |
| Invalid uploads | ✅ content mismatch 415, `.exe` 415, oversize 413, unauthenticated 401 |
| Storage | ✅ exactly one file, `2026/10/<uuid>.pdf`, name unrelated to the upload |
| Soft delete | ✅ 204, list 0, metadata 404, download 404, bytes retained |
| Audit | ✅ `document.uploaded`, `document.downloaded` (×2), `document.updated`, `document.deleted` |

### Notes and deliberate limits

- `vitest` was bumped from 3.2.7 to 5.0.5 by the dependency install; the full
  suite was re-run on 5.0.5 and passes.
- Uploads are parsed in memory for exactly one file per request, bounded by
  `MAX_UPLOAD_BYTES`. Streaming to a temp file is the next step if the limit grows.
- There is **no share endpoint yet** (Day 4). Grants are enforced by the API and
  tested; inserting one requires SQL for now:
  `INSERT INTO document_permissions (id, document_id, user_id, role, granted_by) VALUES (UUID(), ?, ?, 'viewer', ?);`
- The OOXML check is structural (ZIP signature + `[Content_Types].xml` + the
  `word/`, `xl/` or `ppt/` folder). It is not a full archive parser and no
  antivirus scanning happens.
- Soft delete deliberately keeps bytes; purging is a scheduled job, not a user
  action.

---

## Day 4 — Document-Level Permissions & Immediate Revocation

Per-document access control, owner-governed sharing, instant revocation, and complete administrative isolation.

### Permission Model
- **Owner**: Full control. Only owners may grant or revoke permissions.
- **Viewer**: Read metadata and download permitted document contents.
- **Editor**: Read metadata, download contents, and edit permitted metadata.
- **Admin**: System governance only. **Does NOT have automatic permission to read or download document contents.**

### Endpoints Added
- `GET /api/documents/stats`: Aggregated dashboard metrics for current viewer.
- `GET /api/documents/:id/permissions`: List current grants (owner only).
- `POST /api/documents/:id/permissions`: Grant or update permission role.
- `DELETE /api/documents/:id/permissions/:userId`: Revoke access immediately.
- `GET /api/documents/:id/access-history`: Audit history for a specific document.
- `GET /api/access-history`: Cross-document access history for manageable documents.

---

## Day 5 — Tamper-Evident Audit Trail, Security Review & Production Hardening

The final submission delivers full administrative governance, cryptographic tamper evidence, an independent security review, and vulnerability remediation.

### Audit Security & Tamper Resistance
- **Database Engine Immutability**: MySQL `BEFORE UPDATE` and `BEFORE DELETE` triggers reject any raw SQL modification or deletion of `audit_logs` or `audit_checkpoints` with `SQLSTATE '45000'`.
- **SHA-256 Hash Chaining**: Every audit entry commits to the canonical JSON digest of the current record plus the preceding record's `entry_hash`.
- **Periodic Checkpoints**: Cryptographic checkpoints anchor chain state, detecting retroactive tampering or entry splicing.
- **Admin Dashboard**: Search and filter events across actors, documents, outcomes, and dates. Includes full user lifecycle activation/deactivation controls.

### Security Review Findings & Resolutions
An independent review evaluated the codebase across 13 threat categories:
1. **Finding 1 (Medium - DB Privileges):** Resolved by splitting `database/bootstrap.sql` into deployment user (`trustvault_deploy` with DDL) and runtime user (`trustvault` with DML on operational tables and strictly `SELECT, INSERT` on audit tables).
2. **Finding 2 (Medium - Password Spraying):** Resolved by implementing dual-tier rate limiting in `server/src/app.ts`: Tier-1 global per-IP ceiling (30 req / 15 min) + Tier-2 per-(IP+email) limit (10 req / 15 min).
3. **Finding 3 (Low-Medium - Title Leakage):** Resolved by conditionally projecting document titles with `CASE WHEN d.owner_id = ? OR p.user_id IS NOT NULL THEN d.title ELSE '[Restricted]' END` in manager history queries.
4. **Finding 4 (Low - Stream Revocation):** Documented architectural boundary: revocation immediately denies all new HTTP requests; active in-flight streams cannot recall already-sent bytes.

Automated regression coverage: `server/tests/security-regression.test.ts` (5 tests passing).

---

## Clean Clone Deployment Instructions

Follow these steps to deploy and run TrustVault on a fresh machine:

### 1. Prerequisites
- **Node.js**: v22.x LTS (tested on v22.13.0)
- **npm**: v10.x or higher
- **MySQL Server**: v8.0 or higher running on port 3306

### 2. Clone and Install
```powershell
git clone <repository-url> trustvault
cd trustvault
npm install
```

### 3. Environment Configuration
```powershell
Copy-Item .env.example .env
```
Generate a strong 64-character session secret:
```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```
Edit `.env` and set:
```ini
NODE_ENV=production
PORT=4000
SESSION_SECRET=<generated-64-char-hex-secret>
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=trustvault
DATABASE_PASSWORD=<your-runtime-db-password>
DATABASE_NAME=trustvault
CLIENT_ORIGINS=http://localhost:5173
STORAGE_DIR=./storage
```

For the client:
```powershell
Copy-Item client/.env.example client/.env
```
Ensure `VITE_API_BASE_URL=http://localhost:4000` is configured in `client/.env`.

### 4. Database Bootstrap & Migrations
Log in to MySQL as root and execute `database/bootstrap.sql` (replacing the placeholder passwords):
```powershell
mysql -u root -p < database/bootstrap.sql
```
Run the forward-only migration runner to create tables and triggers:
```powershell
npm run migrate
```
Verify status:
```powershell
npm run migrate:status
# Expected: 7 applied, 0 pending, 0 drifted, 0 missing
```

### 5. Seed Demo Accounts (Development Only)
Safely seed demo accounts (admin, owner, viewer) for local testing:
```powershell
# For production mode, pass SEED_ALLOW_PRODUCTION=true
$env:SEED_ALLOW_PRODUCTION="true"
npm run seed
```
Save the printed generated passwords. Passwords are shown once and stored solely as bcrypt hashes. In production, public registration (`/register`) allows organizations to self-onboard securely without needing demo seeds.

### 6. Build and Run Production Services
Build both client and server:
```powershell
npm run build
```

Run tests to verify deployment integrity:
```powershell
npm test
# Expected: 215 server tests + 22 client tests passing (237 total)
```

Start the API and Client:
```powershell
# Terminal 1: API
npm start

# Terminal 2: Client
cd client
npx vite preview --port 5173
```
Access the application at `http://localhost:5173`.

---

## Multi-Tenant Architecture & Workspace Management

TrustVault operates as a multi-tenant platform designed for open-source self-hosting and public deployment:

### 1. Self-Service Public Registration & Onboarding
- **Personal Workspaces:** Individuals can register with their own email and password without a company name. Personal users have `company_id = NULL` and full ownership of their library. They can share documents with any registered user or upgrade to a Company Workspace at any time via `/workspace/create`.
- **Company Workspaces:** Teams and businesses can register a company workspace directly at `/register` by specifying their company name. The creator becomes the workspace `owner` with a cryptographically generated tenant UUID.
- **Invitation Acceptance:** Team members join an existing company workspace by following an invite link (`/register?invite=<token>`) or accepting an invitation while logged in.

### 2. Multi-Tenant Data Isolation & Cross-Company Sharing
- **Tenant Isolation:** Every company-owned document, membership, and audit entry is bound to its `company_id`. The backend enforces tenant boundaries on all document listings, uploads, downloads, updates, and deletions.
- **Explicit Cross-Tenant Sharing:** Documents can only cross tenant boundaries through explicit, authorized grants in `document_permissions`. Uninvited users receive an immediate `404 Not Found`. Revoking an access grant instantly cuts off access with zero caching latency.

### 3. Role-Based Access Control (RBAC)
- **`owner`:** Complete workspace control, workspace settings (name, domain), member invitation and removal, role promotion/demotion, and document management.
- **`admin`:** Workspace administration, member invites, user management, and governance logs.
- **`editor`:** Document creation and upload, editing owned documents and shared documents granted with edit permissions.
- **`viewer`:** Read-only access and secure streaming downloads for granted documents.

### 4. Database Migration 0007
Migration `0007_company_invitations_and_roles.sql` applies forward-only schema updates:
- Extends the `users.role` enum to include `editor`.
- Creates the `company_invitations` table with secure random tokens, role assignment, status tracking (`pending`, `accepted`, `revoked`, `expired`), expiration timestamps, and indexed foreign keys to `companies` and `users`.

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

---

## Pushing to GitHub

To push this repository to GitHub so that anyone can clone, test, or deploy it:

1. **Verify no secrets are tracked**:
   ```powershell
   git status
   # Ensure .env and server/storage/ are ignored and untracked
   ```

2. **Commit your changes**:
   ```powershell
   git add -A
   git commit -m "feat: multi-tenant company registration, workspace isolation, and production UI"
   ```

3. **Link to your GitHub repository**:
   Create a new public repository on [GitHub](https://github.com/new) (e.g. `trustvault`), then link and push:
   ```powershell
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/trustvault.git
   git branch -M main
   git push -u origin main
   ```

---

## Live Deployment (Getting a Public URL)

TrustVault can be deployed to any Node.js + MySQL cloud host (e.g., Render, Railway, AWS ECS, Fly.io):

### Option A: Railway / Render (Easiest)
1. **Provision MySQL**:
   - Create a MySQL 8 database service on [Railway](https://railway.app) or [Render](https://render.com).
   - Copy the MySQL connection parameters (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`).

2. **Deploy API (`server`)**:
   - Connect your GitHub repository as a Web Service.
   - Set Root Directory: `server` (or build from root using workspace scripts).
   - Set Build Command: `npm install && npm run build`
   - Set Start Command: `npm run migrate && npm start`
   - Set Environment Variables:
     - `NODE_ENV=production`
     - `PORT=4000`
     - `SESSION_SECRET=<random 64-character hex string>`
     - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
     - `CLIENT_ORIGIN=https://<your-frontend-domain>`
     - `FRONTEND_URL=https://<your-frontend-domain>`

3. **Deploy Web Client (`client`)**:
   - Create a Static Site service connected to your GitHub repo.
   - Set Root Directory: `client`
   - Set Build Command: `npm install && npm run build`
   - Set Publish Directory: `dist`
   - Set Environment Variable:
     - `VITE_API_BASE_URL=https://<your-api-domain>`

4. **Live Access**:
   - Open your frontend URL: `https://<your-frontend-domain>`.
   - Anyone can click **Register company workspace** to register their company, or log in with their credentials!

### Option B: GitHub Pages (Frontend Client Only)

A GitHub Actions workflow is provided at `.github/workflows/deploy-pages.yml` to build and deploy the React frontend to GitHub Pages.

#### How to Enable GitHub Pages:
1. In your GitHub repository, navigate to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. (Optional) Go to **Settings** → **Secrets and variables** → **Actions** → **Variables**, click **New repository variable**, and add:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://<your-deployed-api-url>` (e.g. your Render or Railway backend).
4. Push a commit to `main` (or trigger the workflow manually under the **Actions** tab).
5. The frontend will be published at `https://<YOUR_GITHUB_USERNAME>.github.io/trustvault/`.

> [!WARNING]
> **Limitations of GitHub Pages**:
> - GitHub Pages hosts **only static assets** (HTML, CSS, JS).
> - It **cannot** host the Node.js Express backend, the MySQL 8 database, HttpOnly session cookies, or private document filesystem storage.
> - Unless a real TrustVault API backend is deployed and configured via `VITE_API_BASE_URL`, authentication and document features on the GitHub Pages site will display connection errors when attempting to reach the server.

---

## Workspace Invitations, SPA Deep-Linking, and Revocation Persistence

### 1. SPA Deep-Link Routing and Direct Refresh Fallback (Bug 1 Fix)
- **Problem**: When navigating to `/register?invite=<token>` directly in a new tab or refreshing on Render Static Sites, the static file server returned plain HTTP 404 `Not Found` because client-side routes were not mapped to physical static files or an SPA fallback.
- **Multi-Layered Solution**:
  1. **Infrastructure Rewrite Rule**: Added root `render.yaml` defining a static site route rewrite (`source: /*`, `destination: /index.html`).
  2. **Static Rewrite File**: Added `client/public/_redirects` (`/* /index.html 200`) automatically copied to build output.
  3. **Build Fallback Generator (`client/scripts/postbuild.js`)**: Runs automatically after `vite build` to generate static entrypoints for common routes (`dist/register/index.html`, `dist/login/index.html`, `dist/accept-invite/index.html`, `dist/workspace/members/index.html`, etc.) along with `dist/404.html` and `dist/200.html`. Even without server-side rewrite rules, hosts serving directory indexes load the React application directly with zero 404 errors.
  4. **Account Mismatch Detection**: On `/register?invite=...`, if an authenticated user opens an invite intended for a different email address, the UI renders an account mismatch alert with an explicit **Sign Out & Switch Account** button instead of letting an invalid acceptance fail silently.

### 2. Revocation & Database State Persistence (Bug 2 & Bug 3 Fix)
- **Problem**: When revoking an invitation or removing a member on `/workspace/members`, the item reappeared upon page refresh.
- **Root Cause**:
  1. `listCompanyInvitations(companyId)` in the database store returns all invitation rows for the company regardless of status (`pending`, `revoked`, `accepted`, `expired`).
  2. The frontend rendered all records under `<h4>Pending Invitations</h4>` with a "Revoke" button, without checking `inv.status`.
  3. Frontend action handlers failed to inspect `res.ok`, updating local React state optimistically without refetching authoritative server state.
  4. Demo account seeding on startup re-assigned `company_id = COALESCE(company_id, DEMO_COMPANY_ID)`, re-attaching removed members to the demo company.
- **Solution**:
  1. **Partitioned Frontend State**: `WorkspaceMembersPage.tsx` splits invitations into active `pendingInvitations` (`status === 'pending' && expiresAt > now`) and historical `pastInvitations` (`status !== 'pending' || expiresAt <= now`).
  2. **Separated UI Tables**: Pending invitations have "Copy Link" and "Revoke" actions; past invitations are displayed in an "Invitation History" table with status badges (`Accepted`, `Revoked`, `Expired`) and no Revoke button.
  3. **Authoritative Server Sync**: Action handlers (`handleRevokeInvite`, `handleRemoveMember`, `handleChangeRole`) verify `res.ok`, extract server error envelopes upon failure, and call `await loadData()` upon success to synchronize with MySQL/TiDB.
  4. **Document Permission Cleanup**: `removeCompanyMember` clears `company_id = NULL` and executes `DELETE FROM document_permissions` for that user on that company's documents, revoking active sessions.
  5. **Idempotent Seeding**: `seed.ts` preserves existing users' company associations when seeding runs.




