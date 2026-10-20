# TrustVault — Threat Model

> Scope: the whole five-day build, with a clear marker on what exists **today**
> (Day 1 foundation) versus what is **planned**. A threat model that pretends
> everything is finished is worse than no threat model.

Last reviewed: Day 1 of the Snovasys hackathon.

---

## 1. What we are protecting

| # | Asset | Why it matters | Where it lives |
|---|-------|----------------|----------------|
| A1 | User credentials | Password reuse makes a leak an attack on other services | `users.password_hash` (bcrypt only, never plaintext) |
| A2 | Session tokens | A stolen token is a full account takeover | Browser cookie (opaque token) + `sessions.token_hash` (SHA-256) |
| A3 | **Documents** | This is the product: confidential client files | Private storage directory outside the web root |
| A4 | Share links | Bearer capability to a specific document | `share_links` (planned, Day 3) |
| A5 | Access-control metadata | Who may read what; forged rows = data breach | MySQL |
| A6 | Secrets | `SESSION_SECRET`, DB password — full compromise | `.env` locally, host env in production |
| A7 | Availability | A dead API on demo day is a failed project | Node process + MySQL |
| A8 | Audit trail | Probe answer "what did this account do?" | Append-only table (planned, Day 4) |

## 2. Actors and trust boundaries

| Actor | Capability | Trust |
|-------|------------|-------|
| Anonymous internet | Can reach the API, guess ids, replay tokens | **Untrusted** |
| Authenticated user | Owns their documents | Semi-trusted |
| Malicious authenticated user | Valid account, tries to read other tenants' data | **Untrusted** |
| Compromised browser | Malicious extension, stolen laptop | Untrusted |
| Operator / developer | Shell access, DB access, env vars | Trusted but fallible |
| Automated scanners | Directory brute force, injection probes | Untrusted |

Boundaries crossed on every request:

```
Browser ──(1)──> API ──(2)──> MySQL
                    └──(3)──> private storage
Operator ──(4)──> deploy platform / CI
```

1. Untrusted network: HTTPS + CORS + cookies + CSRF apply here.
2. Server-side only: parameterized SQL, least-privilege DB user.
3. Filesystem: path containment, owner-only permissions, never web-served.
4. Supply chain + config: lockfile, env validation, no committed secrets.

## 3. Threats and mitigations

Risk = likelihood × impact, rated **High / Medium / Low** for this project.
Status: **Done** (in this repo), **Partial** (foundation in place), **Planned**
(scheduled day).

| ID | Threat | STRIDE | Risk | Mitigation | Status |
|----|--------|--------|------|------------|--------|
| T1 | Credential stuffing / password brute force | Spoofing | High | bcrypt cost 12, generic login errors, per-IP and per-account throttling, lockout via `failed_login_count` / `locked_until` | Planned (Day 2); columns already migrated |
| T2 | Session hijacking via stolen cookie | Spoofing | High | HttpOnly + Secure + SameSite cookies, opaque 256-bit token, only its SHA-256 stored, absolute + idle expiry, rotation on login | Partial (schema ready, cookie flags in env) |
| T3 | Cross-site scripting (XSS) | Tampering | High | React auto-escaping, no `dangerouslySetInnerHTML`, `X-Content-Type-Options: nosniff`, JSON response escaping (`app.set('json escape')`), CSP on the static host | Partial (headers + escaping done; CSP header for SPA pending) |
| T4 | Cross-site request forgery | Spoofing | High | Exact-origin CORS allow-list with credentials, `SameSite=Lax`, per-session CSRF token for state-changing routes | Partial (CORS done; CSRF token in Day 2) |
| T5 | SQL injection | Tampering | High | `mysql2` parameterized queries only, named placeholders, `multipleStatements: false`, DB name/user restricted by regex, least-privilege DB user | **Done** |
| T6 | IDOR — reading another user's document | Elevation | High | Every document/share read is scoped by `owner_id`; ids are server-generated UUIDs; no raw paths accepted from clients | Planned (Day 3); `resolveWithinStorage` guard exists |
| T7 | Path traversal / arbitrary file read | Information disclosure | High | Storage root resolved absolutely, `resolveWithinStorage` rejects `..`, documents never served by the static host, names generated server-side | Partial |
| T8 | Malicious upload (web shell, zip bomb, huge file) | Tampering / DoS | High | Size ceiling (`MAX_UPLOAD_BYTES`), MIME + magic-byte check, extension allow-list, generated filenames, storage outside web root, no execution | Planned (Day 3); size config done |
| T9 | Secret leakage via git or logs | Information disclosure | High | `.env*` git-ignored with `*.example` templates, production refuses placeholder `SESSION_SECRET` and empty DB password, pino redaction paths, generic error bodies | **Done** |
| T10 | CORS misconfiguration | Elevation | High | Exact origin allow-list, wildcards rejected at validation, `credentials: true` only for allow-listed origins, `Vary: Origin` | **Done** |
| T11 | Stack trace / SQL error disclosure | Information disclosure | Medium | Single error handler, generic 500 in production, sanitized driver codes, request id for correlation | **Done** |
| T12 | Log injection / PII in logs | Repudiation | Medium | Inbound request ids validated against `^[A-Za-z0-9._:-]{8,128}$`, redaction paths, URLs truncated to 200 chars, bodies never logged | **Done** |
| T13 | Resource exhaustion (large JSON, slow clients) | DoS | Medium | 64 kb JSON / 16 kb form limits, pool connection cap, 2 s readiness timeout, platform-level DDoS protection | Partial (global rate limit Day 4) |
| T14 | Destructive or drifting schema change | Tampering | High | Forward-only migrations, SHA-256 checksums, advisory lock, no `down` command, additive DDL only | **Done** |
| T15 | Supply-chain compromise | Tampering | Medium | Lockfile committed, caret-pinned direct deps, small dependency surface, `npm audit` in CI | Partial |
| T16 | Session fixation | Spoofing | Medium | New session row + token on every login and privilege change; old tokens revoked | Planned (Day 2) |
| T17 | Account enumeration | Information disclosure | Medium | Identical response and comparable timing for unknown email vs wrong password | Planned (Day 2) |
| T18 | Share-link brute force | Spoofing | High | 256-bit random tokens, hashed at rest, expiry, revocation, attempt throttling | Planned (Day 3) |
| T19 | Insider / DB dump exposure | Information disclosure | High | No plaintext passwords, no plaintext documents in MySQL, storage directory `0700`, session tokens hashed | **Done** (as far as the schema goes) |
| T20 | Backup / dump leak | Information disclosure | High | Dumps git-ignored, encrypted backups, restore tested before demo | Planned (Day 5) |
| T21 | Clickjacking | Tampering | Low | `X-Frame-Options: SAMEORIGIN`; CSP `frame-ancestors` on the SPA | Partial |
| T22 | Misconfigured production origin | Elevation | Medium | Production rejects `localhost` origins and wildcard entries at boot | **Done** |

## 4. Explicitly out of scope (five days)

- End-to-end encryption with client-held keys (breaks server-side search and
  sharing; a real product decision, not a hackathon one).
- Antivirus / DLP scanning of uploaded documents.
- SOC 2 / GDPR certification artefacts.
- Multi-region disaster recovery.
- Protection against a completely compromised host or database administrator.
- Hardware-backed secrets (HSM / KMS) — env vars are the day-5 compromise.

## 5. Residual risks we accept for the demo

1. **Single MySQL instance.** No replica, no automatic failover. Mitigated by
   the readiness endpoint returning 503 so a platform can route around it.
2. **Env-var secrets.** A process dump or misconfigured log could expose them;
   we compensate with redaction and by never logging config objects wholesale.
3. **No WAF.** Application-level throttling arrives on Day 4; the host's edge
   protection is the only line before that.
4. **Session storage in MySQL.** Every request will need a row lookup; at demo
   scale this is fine and it keeps revocation instant.

## 6. How each "Done" claim is verified

| Claim | Evidence |
|-------|----------|
| Prompt-injection-safe request ids | `tests/health.test.ts` — hostile id replaced with UUID |
| CORS allow-list | `tests/middleware.test.ts` — allowed origin echoed, unlisted origin gets 403 |
| No framework fingerprint | `tests/middleware.test.ts` — `x-powered-by` absent |
| Body limits | `tests/middleware.test.ts` — 100 kb body → 413, malformed JSON → 400 |
| No internal leakage | `tests/middleware.test.ts` — production 500 hides message and details |
| Secret hygiene | `tests/env.test.ts` — placeholder secret and empty DB password rejected in production |
| Migration safety | `tests/migrations.test.ts` — drift, missing files, lock contention, dry run |
| DB probe never hangs | `tests/db-and-storage.test.ts` — 25 ms timeout returns `TIMEOUT` |
| Path containment | `tests/db-and-storage.test.ts` — `../secrets.env` rejected |

## 7. Changing this document

Every new feature updates this table **before** merge:

1. Add the new asset, if any.
2. Add the threat and its mitigation.
3. Mark the status honestly.
4. Add or update the test that proves it.

---

## 8. Day 2 update — authentication shipped

Section 3 was written on Day 1, when none of this existed. This section
**supersedes** the status of the IDs below; everything not listed is still
planned.

| ID | Was | Now | Evidence |
|----|-----|-----|----------|
| T1 Brute force | Planned | **Done** | bcrypt cost 12, per-(IP+email) window limiter, 5-failure lockout with `Retry-After`; `tests/auth.test.ts` |
| T2 Session hijacking | Partial | **Done** | 256-bit opaque token, SHA-256 at rest, `HttpOnly`/`Secure`/`SameSite`, absolute + idle expiry, rotation on login, password-change invalidation |
| T4 CSRF | Partial | **Done** | per-session synchroniser token, constant-time compare, `Origin` allow-list, `SameSite=Lax` |
| T16 Session fixation | Planned | **Done** | a new session row/token is issued on every login and any presented session is revoked first |
| T17 Account enumeration | Planned | **Done** | identical `INVALID_CREDENTIALS` for unknown email, wrong password and disabled account; a dummy bcrypt comparison runs for unknown emails |
| T19 Insider / DB dump | Done | **Done (stronger)** | bcrypt hashes, hashed session tokens, HMAC'd IPs, no document bytes in MySQL |

### New threats introduced by Day 2

| ID | Threat | Mitigation | Residual |
|----|--------|------------|----------|
| T23 | Login rate limiter is per-process, so a second instance resets the count | Account lockout is stored in MySQL and still applies across instances; the limiter is the cheap first gate. A shared store (Redis) is the fix when scaling | Low |
| T24 | An attacker can intentionally lock a known account (denial of service) | Lock is temporary (15 min), rate limiting is per IP+email, and an operator can clear `locked_until` | Low |
| T25 | XSS can read the CSRF token from the API response | XSS already defeats CSRF defences; the token is not an authentication credential and cannot be used without the HttpOnly cookie | Low |
| T26 | Seed prints generated demo passwords | Printed once to a local terminal, never logged by the API, refuses `NODE_ENV=production` without an explicit override | Low |
| T27 | A failing audit insert could hide an event | The failure is logged at `warn` and the auth decision still fails closed; audit rows are never updated or deleted | Low |
| T28 | Session table growth over time | Expired/idle sessions are revoked on use; a scheduled cleanup job is Day 4 work | Low |

### Verification for the new claims

| Claim | Evidence |
|-------|----------|
| Passwords are never exposed | `tests/auth.test.ts` → "never returns a password hash or the raw session token" |
| Session tokens are hashed at rest | `tests/auth.test.ts` → "stores only the SHA-256 hash of the session token" |
| Logout revokes server-side | `tests/auth.test.ts` → logout test asserts `revoked_at` and a 401 afterwards |
| Disabled accounts lose access | `tests/auth.test.ts` → 403 `ACCOUNT_DISABLED`, all sessions revoked |
| Expiry is enforced | absolute TTL and idle timeout tests with an injected clock |
| Privilege escalation is blocked | role-in-body ignored; viewer/owner get 403 on the admin route; forged cookie 401 |
| CSRF is enforced | missing token → 403 with the session still usable; token from another session → 403 |
| Brute force is throttled | rate-limit test returns 429 with `Retry-After`; lockout test returns `ACCOUNT_LOCKED` even with the correct password |

---

## 9. Day 3 update — document management

Section 3 was written on Day 1. This section supersedes the document-related
rows.

| ID | Was | Now | Evidence |
|----|-----|-----|----------|
| T6 IDOR / broken access control | Planned | **Done** | One access predicate (`admin OR owner OR grant`) in list, count and fetch; a stranger gets `404` for metadata, download, edit and delete. `tests/documents.test.ts` |
| T7 Path traversal | Partial | **Done** | Storage keys are server-generated (`yyyy/mm/<uuid>.<ext>`), pattern-checked, containment-checked, and written with `wx`. The uploaded filename is display-only. Tests include `../../../etc/passwd.pdf` |
| T8 Malicious upload | Planned | **Done (content checks)** | Size ceiling, extension allow-list, declared-MIME consistency and magic-byte/structural validation; text types must be valid UTF-8 with no NULs; files are never executed or web-served |
| T13 Resource exhaustion | Partial | **Partial** | Upload size is capped and parsed in memory for one file only; there is still no per-user quota or global upload rate limit |

### New threats introduced by Day 3

| ID | Threat | Mitigation | Residual |
|----|--------|------------|----------|
| T29 | MIME/extension spoofing — a malicious file renamed to `.pdf` | The decisive check is content, not the name: magic bytes for PDF/PNG/JPEG, ZIP container plus OOXML folder for Office files, UTF-8/printable checks for text | Medium-low: the OOXML check is structural, not a full ZIP parse; no antivirus/AV scanning |
| T30 | Storage exhaustion by repeated uploads | Size ceiling, authentication required, audit trail records every upload | Medium: no per-user quota yet — Day 4/5 work |
| T31 | Bulk exfiltration through downloads | Every download is authorized and audited (`document.downloaded`); no public or long-lived links exist | Low |
| T32 | Soft-deleted bytes stay on disk | Deliberate recovery trade-off; purge job planned | Low for the demo, must be documented for production retention |

### Verification for the new claims

| Claim | Evidence |
|-------|----------|
| Strangers cannot see or download documents | `tests/documents.test.ts` — listing returns 0, download 404, metadata 404 |
| Grants grant access, not more | Granted viewer can list/download (200) but edit gets `403 DOCUMENT_FORBIDDEN` |
| Invalid uploads are rejected | 415 for `.exe`, 415 for PNG bytes named `.pdf`, 413 for oversize, 422 for empty/no-extension |
| Files are not stored under user names | Storage-key assertions and the `../../../etc/passwd.pdf` upload test |
| Deleted documents disappear | Delete → list 0, metadata 404, download 404, bytes still present |
| Every document action is audited | Audit rows asserted in the end-to-end run (`document.uploaded/downloaded/updated/deleted`) |

---

## 10. Day 4 update — Document authorization and immediate revocation

Section 3 was written on Day 1. This section supersedes document sharing and authorization rows.

| ID | Was | Now | Evidence |
|----|-----|-----|----------|
| T18 Share-link brute force | Planned | **Superseded & Done** | Replaced bearer share-links with strict account-bound document grants in `document_permissions` (`role: owner \| editor \| viewer`); no bearer URLs to guess. `tests/document-authorization.test.ts` |
| T6 IDOR & Escalation | Partial | **Done (strict roles)** | DB predicate re-evaluated on every request (`findAccessible`); non-owners cannot grant or revoke (`403`); viewers cannot edit (`403`); editors cannot delete (`403`); immediate revocation invalidates the viewer's next request with 0 decision caching |
| Administrator Isolation | Planned | **Done** | Admin role stripped from `ACCESS_PREDICATE`; administrators have zero automatic document-reading access unless explicitly granted by the owner |

### Residual risks and limits

- **Pre-revocation downloads:** Revocation cannot erase or recall files already downloaded by a client before their permission was revoked. Private storage serves bytes with `Cache-Control: no-store, private`, preventing browser disk-caching, but endpoint control ends once bytes are saved locally.

---

## 11. Day 5 update — Audit trail, tamper evidence, and admin dashboard

This section documents the audit trail and administrative security implementation.

| ID | Threat | STRIDE | Risk | Mitigation | Status |
|----|--------|--------|------|------------|--------|
| T33 | Audit modification / deletion by compromised user | Tampering / Repudiation | High | Database-level `BEFORE UPDATE` and `BEFORE DELETE` triggers reject any SQL DML modifying `audit_logs` or `audit_checkpoints` with `SQLSTATE '45000'` | **Done** |
| T34 | Audit record forgery / history injection | Repudiation | High | Cryptographic SHA-256 hash chaining: every entry contains `prev_hash` linking to the prior record, plus `entry_hash` over canonical JSON payload. Tamper verification detects breaks or content mutation | **Done** |
| T35 | Privileged attacker rewriting database and checkpoints | Tampering | High | Periodic protected checkpoints (`audit_checkpoints`) anchor the chain. **Limitation:** If an attacker has full MySQL `root` / host OS access to rewrite tables, disable triggers, and recompute all hashes, database-internal controls alone cannot prevent history rewriting. External ledger/WORM anchoring is required for host-compromise resilience | **Done (Documented Limitation)** |
| T36 | Confidential metadata leakage in audit logs or error responses | Information disclosure | Medium | Passwords, session cookies, auth tokens, and document contents are strictly excluded from audit events. Denied access attempts return sanitized 403/404 JSON envelopes with zero file titles or private metadata | **Done** |
| T37 | Administrator privilege escalation to read documents | Elevation | High | Admin dashboard accesses audit logs, cross-tenant permission history, user accounts, and platform metrics only. Administrators cannot download or view document contents via admin tools | **Done** |
| T38 | Accidental administrator lockout | Denial of Service | Medium | Admin cannot deactivate their own administrative account (`422 CANNOT_DEACTIVATE_SELF`) | **Done** |

### Detailed Analysis of Privileged Attacker Limitations (T35)

A frequent misconception in security architecture is that database triggers or in-table hash chains provide absolute protection against a superuser or root attacker. We explicitly document the threat boundaries:

1. **What the TrustVault audit architecture prevents:**
   - Any application user, compromised viewer, editor, owner, or platform administrator interacting through SQL DML or the API cannot `UPDATE` or `DELETE` audit events. Triggers raise `SQLSTATE '45000'`, failing any modification attempts.
   - Any single-row alteration, deleted row, or spliced record breaks the SHA-256 hash chain and is immediately flagged by `verifyAuditIntegrity()`.
   - Any attempt to retroactively alter past records without updating checkpoints is detected because checkpoint digests commit to `(checkpoint_seq, last_log_id, last_entry_hash, entry_count)`.

2. **The Root Attacker Limitation:**
   - If an attacker obtains **MySQL superuser privileges (`SUPER` or `SYSTEM_VARIABLES_ADMIN`) or direct host OS filesystem access**, they can:
     1. Disable triggers (`DROP TRIGGER trg_audit_logs_no_update;`).
     2. Rewrite historical records in `audit_logs`.
     3. Recalculate the entire forward hash chain from the modified point.
     4. Rewrite the `audit_checkpoints` table with corresponding fraudulent checkpoint hashes.
   - **Compensating architectural mitigations for production deployment:**
     - Ship audit logs synchronously to an off-box, write-once logging service (remote append-only SIEM, AWS CloudWatch Logs with retention lock, GCP Cloud Logging bucket with WORM retention).
     - Periodically publish audit checkpoint hashes to an external timestamping authority (RFC 3161) or a public transparency log (e.g. Certificate Transparency / Rekor ledger).

### Verification Evidence for Audit and Admin Governance

| Claim | Evidence |
|-------|----------|
| Full lifecycle auditing | `tests/audit-trail.test.ts` → uploads, views, downloads, edits, soft-deletions recorded with correlation `requestId` and actor |
| Permission grant & revocation auditing | `tests/audit-trail.test.ts` → `document.permission_granted/revoked` records target user ID and granted role |
| Denied attempts logged as `denied` | `tests/audit-trail.test.ts` → unauthorized downloads, edits, deletes, and share attempts return 404/403 and log `outcome: 'denied'` |
| Zero confidential metadata leakage | `tests/audit-trail.test.ts` → asserts error responses contain no document titles or file contents |
| Append-only immutability | `tests/audit-trail.test.ts` → update/delete attempts trigger `Audit log records are immutable` |
| Hash chain & tamper detection | `tests/audit-trail.test.ts` → `verifyAuditIntegrity()` passes on authentic sequence; simulated record mutation fails with exact `failedAtId` |
| Admin isolation | `tests/audit-trail.test.ts` → admin download returns 404; admin metadata query returns 404; admin dashboard filters audit events by actor, document, action, outcome, and date |
| Account deactivation & self-lockout defence | `tests/audit-trail.test.ts` → deactivating account revokes active sessions immediately (401/403); admin cannot deactivate self (422) |

