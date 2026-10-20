import type { Pool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { checkDatabase, extractErrorCode } from '../src/db/pool.js';
import { resolveWithinStorage, STORAGE_DIR_MODE } from '../src/storage/private-storage.js';

describe('checkDatabase', () => {
  it('reports success and latency when the pool answers', async () => {
    const pool = { query: async () => [[{ ok: 1 }], []] } as unknown as Pool;

    const result = await checkDatabase(pool, 200);

    expect(result.ok).toBe(true);
    expect(result.code).toBeUndefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports a sanitized driver code when the connection fails', async () => {
    const pool = {
      query: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
          code: 'ECONNREFUSED',
        });
      },
    } as unknown as Pool;

    const result = await checkDatabase(pool, 200);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('ECONNREFUSED');
    expect(JSON.stringify(result)).not.toContain('127.0.0.1');
  });

  it('times out instead of hanging the readiness endpoint', async () => {
    const pool = { query: () => new Promise(() => {}) } as unknown as Pool;

    const result = await checkDatabase(pool, 25);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('TIMEOUT');
  });
});

describe('extractErrorCode', () => {
  it('keeps a bounded driver code', () => {
    expect(extractErrorCode(Object.assign(new Error('x'), { code: 'ER_ACCESS_DENIED_ERROR' }))).toBe(
      'ER_ACCESS_DENIED_ERROR',
    );
  });

  it('falls back to the error name, then to UNKNOWN', () => {
    expect(extractErrorCode(Object.assign(new Error('x'), { name: 'MysqlError' }))).toBe('MYSQLERROR');
    expect(extractErrorCode(new Error('plain'))).toBe('ERROR');
    expect(extractErrorCode('a string')).toBe('UNKNOWN');
    expect(extractErrorCode(null)).toBe('UNKNOWN');
  });

  it('rejects codes that could smuggle content into logs', () => {
    expect(extractErrorCode({ code: 'bad code with spaces' })).toBe('UNKNOWN');
    expect(extractErrorCode({ code: 'x'.repeat(64) })).toBe('UNKNOWN');
  });
});

describe('private storage helpers', () => {
  it('uses owner-only permissions', () => {
    expect(STORAGE_DIR_MODE).toBe(0o700);
  });

  it('resolves document paths inside the storage root', () => {
    const root = process.platform === 'win32' ? 'C:\\vault\\storage' : '/vault/storage';
    const resolved = resolveWithinStorage(root, 'tenant-1/doc.pdf');

    expect(resolved.endsWith('doc.pdf')).toBe(true);
  });

  it('rejects traversal outside the storage root', () => {
    const root = process.platform === 'win32' ? 'C:\\vault\\storage' : '/vault/storage';

    expect(() => resolveWithinStorage(root, '../secrets.env')).toThrow(/escapes/);
    expect(() => resolveWithinStorage(root, 'tenant/../../secrets.env')).toThrow(/escapes/);
  });

  it('rejects the storage root itself as a document path', () => {
    const root = process.platform === 'win32' ? 'C:\\vault\\storage' : '/vault/storage';

    expect(() => resolveWithinStorage(root, '.')).toThrow(/not the root itself/);
  });
});
