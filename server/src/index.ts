import http from 'node:http';
import { createApp } from './app.js';
import { EnvValidationError, loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { API_PREFIX, SERVICE_NAME, SERVICE_VERSION } from './config/service-info.js';
import { closePool, hasPool } from './db/pool.js';
import { ensureStorageDir } from './storage/private-storage.js';

/** How long in-flight requests get before the process is forced down. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const { env, warnings, loadedFiles } = loadEnv();
  const logger = createLogger(env);

  for (const warning of warnings) logger.warn(warning);
  if (loadedFiles.length > 0) logger.debug({ loadedFiles }, 'environment files loaded');

  try {
    await ensureStorageDir(env.storageDir, logger);
  } catch (error) {
    // Storage is prepared here so upload endpoints can rely on it. Failing to
    // create it must not stop health checks from answering.
    logger.warn({ err: error, storageDir: env.storageDir }, 'private storage directory unavailable');
  }

  const app = createApp({ env, logger });
  const server = http.createServer(app);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown signal received, finishing in-flight requests');

    const forceTimer = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'graceful shutdown timed out, exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    server.close((closeError) => {
      void (async () => {
        if (closeError) logger.error({ err: closeError }, 'error while closing the HTTP server');
        if (hasPool()) await closePool();
        logger.info('shutdown complete');
        process.exit(closeError ? 1 : 0);
      })();
    });
  };

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: env.port }, 'port is already in use');
    } else {
      logger.fatal({ err: error }, 'HTTP server failed to start');
    }
    process.exit(1);
  });

  server.listen(env.port, env.host, () => {
    logger.info(
      {
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: env.nodeEnv,
        health: `http://localhost:${env.port}${API_PREFIX}/health`,
        databaseHealth: `http://localhost:${env.port}${API_PREFIX}/health/database`,
        database: `${env.database.user}@${env.database.host}:${env.database.port}/${env.database.name}`,
        clientOrigins: env.clientOrigins,
        storageDir: env.storageDir,
      },
      `TrustVault API listening on http://${env.host}:${env.port}`,
    );
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    // Configuration errors are for the operator, not the logger: print the
    // full, actionable list before exiting.
    console.error(`\n${error.message}\n`);
  } else {
    console.error('Failed to start TrustVault API:', error);
  }
  process.exit(1);
});
