import { createPool as createMysqlPool, type Pool } from 'mysql2/promise';
import type { Env } from '../config/env.js';

/** Upper bound for the readiness probe so /health never hangs. */
export const DB_PING_TIMEOUT_MS = 2_000;

export interface DatabaseHealthResult {
  ok: boolean;
  latencyMs: number;
  /** Sanitized driver error code, e.g. ECONNREFUSED or ER_ACCESS_DENIED_ERROR. */
  code?: string;
}

class DatabaseTimeoutError extends Error {
  readonly code = 'TIMEOUT';

  constructor(timeoutMs: number) {
    super(`Database health check timed out after ${timeoutMs} ms`);
    this.name = 'DatabaseTimeoutError';
  }
}

/**
 * Builds the mysql2 pool.
 *
 * Deliberate choices:
 * - `multipleStatements: false` so a single injection cannot chain queries.
 * - `namedPlaceholders` for readable, still-parameterized queries.
 * - UTC (`timezone: 'Z'`) so persisted timestamps are unambiguous.
 */
export function createPool(env: Env): Pool {
  const pool = createMysqlPool({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    waitForConnections: true,
    connectionLimit: env.database.connectionLimit,
    maxIdle: env.database.connectionLimit,
    idleTimeout: 60_000,
    queueLimit: 0,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
    charset: 'utf8mb4',
    decimalNumbers: true,
    namedPlaceholders: true,
    multipleStatements: false,
  });

  // Pin every pooled connection to UTC.
  //
  // `timezone: 'Z'` above only tells the driver how to *parse and format*
  // dates. Server-side expressions such as NOW() still use the MySQL session
  // time zone, which on a Windows install is the machine's local zone. Mixing
  // the two made `password_changed_at` (written with NOW()) appear hours in the
  // future, which invalidated freshly created sessions. One SET per connection
  // keeps SQL time and driver time in the same frame.
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  return pool;
}

let pool: Pool | null = null;

/** Process-wide pool. Created lazily so importing the app never opens sockets. */
export function getPool(env: Env): Pool {
  pool ??= createPool(env);
  return pool;
}

export function hasPool(): boolean {
  return pool !== null;
}

/** Closes the pool if one exists. Safe to call during shutdown or tests. */
export async function closePool(): Promise<void> {
  const current = pool;
  pool = null;
  if (!current) return;
  try {
    await current.end();
  } catch {
    // Already closed or never connected: nothing useful to do.
  }
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Never echo raw driver messages to clients: only a bounded code. */
export function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, name } = error as { code?: unknown; name?: unknown };
    if (typeof code === 'string' && /^[A-Z0-9_]{2,40}$/.test(code)) return code;
    if (typeof name === 'string' && /^[A-Za-z0-9_]{2,40}$/.test(name)) return name.toUpperCase();
  }
  return 'UNKNOWN';
}

/**
 * Readiness probe: runs a trivial round-trip and reports latency.
 * Never throws - a failed probe is data, not an exception.
 */
export async function checkDatabase(
  pool: Pool,
  timeoutMs: number = DB_PING_TIMEOUT_MS,
): Promise<DatabaseHealthResult> {
  const startedAt = performance.now();
  let timer: NodeJS.Timeout | undefined;

  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new DatabaseTimeoutError(timeoutMs)), timeoutMs);
      timer.unref();
    });

    await Promise.race([pool.query('SELECT 1 AS ok'), timeout]);
    return { ok: true, latencyMs: roundMs(performance.now() - startedAt) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: roundMs(performance.now() - startedAt),
      code: extractErrorCode(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
