import { Router, type CookieOptions, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../../auth/auth-service.js';
import { readCookie } from '../../auth/cookies.js';
import { requireAuth, requireAuthContext } from '../../auth/middleware.js';
import type { AuthContext } from '../../auth/types.js';

const loginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(320)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'),
  // Only shape is validated here. Password *policy* belongs to account
  // creation; a login must fail as invalid credentials, not as a 422.
  password: z.string().min(1).max(200),
});

export interface AuthRouterOptions {
  env: Env;
  service: AuthService;
  /**
   * Tier-1: global per-IP limiter, applied first.
   * Prevents horizontal password spraying across many email addresses.
   */
  loginIpRateLimiter?: RequestHandler;
  /** Tier-2: per-(IP+email) limiter — tight account-level brute-force throttle. */
  loginRateLimiter?: RequestHandler;
}

function cookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.session.secure,
    sameSite: env.session.sameSite,
    path: '/',
  };
}

function serializeSession(context: AuthContext): {
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
} {
  return {
    csrfToken: context.session.csrfToken,
    createdAt: context.session.createdAt.toISOString(),
    expiresAt: context.session.expiresAt.toISOString(),
  };
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const { env, service } = options;
  const router = Router();
  const guard = requireAuth({ service, env });

  const loginHandlers: RequestHandler[] = [
    ...(options.loginIpRateLimiter ? [options.loginIpRateLimiter] : []),
    ...(options.loginRateLimiter ? [options.loginRateLimiter] : []),
    login,
  ];

  /**
   * POST /api/auth/login
   * Body: { email, password }. Any `role`/`userId` in the body is stripped by
   * the schema and ignored: identity comes from the database row only.
   */
  async function login(
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1],
  ): Promise<void> {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const result = await service.login({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      existingToken: readCookie(req.headers.cookie, env.session.cookieName),
    });

    const maxAge = Math.max(0, result.session.expiresAt.getTime() - Date.now());
    res.cookie(env.session.cookieName, result.token, { ...cookieOptions(env), maxAge });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      user: result.user,
      session: {
        csrfToken: result.session.csrfToken,
        createdAt: result.session.createdAt.toISOString(),
        expiresAt: result.session.expiresAt.toISOString(),
      },
    });
  }

  router.post('/login', ...loginHandlers);

  /** GET /api/auth/me — who am I, and what is my CSRF token after a reload. */
  router.get('/me', guard, (req, res) => {
    const context = requireAuthContext(req);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      user: context.user,
      session: serializeSession(context),
    });
  });

  /**
   * POST /api/auth/logout — revokes the server-side session, then clears the
   * cookie. CSRF-protected because it mutates server state.
   */
  router.post('/logout', guard, async (req, res) => {
    const context = requireAuthContext(req);
    await service.logout(context, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    res.clearCookie(env.session.cookieName, cookieOptions(env));
    res.status(204).end();
  });

  return router;
}
