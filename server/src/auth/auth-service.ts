import type { Env } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import { AppError } from '../http/errors.js';
import type {
  AuditEventInput,
  AuditFilterParams,
  AuditLogEntry,
  AuditVerificationResult,
  AuthStore,
  CheckpointRecord,
  UserWithCredentials,
} from './auth-store.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from './password.js';
import {
  constantTimeEqual,
  generateCsrfToken,
  generateSessionToken,
  hashIpAddress,
  hashSessionToken,
  newId,
  truncate,
} from './tokens.js';
import type { AuthContext, AuthUser } from './types.js';

export class AuthError extends AppError {
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super({ statusCode, code, message, details, expose: true });
    this.name = 'AuthError';
  }
}

export interface LoginInput {
  email: string;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  /** A session cookie presented alongside the login request (fixation defence). */
  existingToken?: string | null;
}

export interface LoginResult {
  user: AuthUser;
  session: { id: string; csrfToken: string; createdAt: Date; expiresAt: Date };
  /** Raw session token. Only ever written to the HttpOnly cookie. */
  token: string;
}

export interface AuthenticateResult extends AuthContext {
  token: string;
}

export interface RequestContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AuthServiceOptions {
  store: AuthStore;
  env: Env;
  clock?: () => Date;
  logger?: Logger;
}

/** Re-touch at most once a minute: a read on every request, a write rarely. */
const TOUCH_INTERVAL_MS = 60_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface RegisterCompanyInput {
  displayName: string;
  email: string;
  password: string;
  companyName: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

function toAuthUser(user: AuthUser): AuthUser {
  const result: AuthUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
  };
  if (user.companyId) result.companyId = user.companyId;
  if (user.companyName) result.companyName = user.companyName;
  return result;
}

function invalidCredentials(): AuthError {
  // Deliberately identical for unknown email, wrong password and disabled
  // account: the response must not reveal which one it was.
  return new AuthError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
}

export class AuthService {
  private readonly store: AuthStore;
  private readonly env: Env;
  private readonly clock: () => Date;
  private readonly logger: Logger | undefined;

  constructor(options: AuthServiceOptions) {
    this.store = options.store;
    this.env = options.env;
    this.clock = options.clock ?? (() => new Date());
    this.logger = options.logger;
  }

  async registerCompany(input: RegisterCompanyInput): Promise<LoginResult> {
    const now = this.clock();
    const email = normalizeEmail(input.email);

    if (input.password.length < 12) {
      throw new AuthError(422, 'WEAK_PASSWORD', 'Password must be at least 12 characters.');
    }

    const existing = await this.store.findUserByEmail(email);
    if (existing) {
      throw new AuthError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email address already exists. Please sign in or use a different email.',
      );
    }

    const companyId = newId();
    const company = await this.store.createCompany({
      id: companyId,
      name: input.companyName.trim(),
      createdAt: now,
    });

    const passwordHash = await hashPassword(input.password, this.env.security.bcryptCost);
    const userId = newId();
    const user = await this.store.createUser({
      id: userId,
      email,
      displayName: input.displayName.trim(),
      companyId: company.id,
      role: 'owner',
      passwordHash,
      createdAt: now,
    });
    user.companyName = company.name;

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const csrfToken = generateCsrfToken();
    const sessionId = newId();
    const expiresAt = new Date(now.getTime() + this.env.session.ttlHours * 3600_000);

    await this.store.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash,
      csrfToken,
      ipHash: hashIpAddress(input.ip, this.env.session.secret),
      userAgent: truncate(input.userAgent, 255),
      createdAt: now,
      expiresAt,
    });

    await this.audit({
      userId: user.id,
      companyId: company.id,
      action: 'company_registered',
      outcome: 'success',
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
      metadata: { companyName: company.name },
    });

    return {
      user: toAuthUser(user),
      session: {
        id: sessionId,
        csrfToken,
        createdAt: now,
        expiresAt,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const now = this.clock();
    const email = normalizeEmail(input.email);
    const user = await this.store.findUserByEmail(email);

    if (!user) {
      // Spend the same bcrypt time as a real verification.
      await verifyAgainstDummyHash(input.password);
      await this.audit({
        userId: null,
        action: 'login_failed',
        outcome: 'failure',
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: { reason: 'unknown_email' },
      });
      throw invalidCredentials();
    }

    if (user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1_000),
      );
      await this.audit({
        userId: user.id,
        action: 'login_locked',
        outcome: 'failure',
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: { retryAfterSeconds },
      });
      throw new AuthError(
        429,
        'ACCOUNT_LOCKED',
        'Too many failed sign-in attempts. Try again later.',
        { retryAfterSeconds },
      );
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      await this.store.recordLoginFailure(user.id, {
        now,
        maxAttempts: this.env.security.maxFailedLoginAttempts,
        lockMinutes: this.env.security.lockMinutes,
      });
      await this.audit({
        userId: user.id,
        action: 'login_failed',
        outcome: 'failure',
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: { reason: 'bad_password' },
      });
      throw invalidCredentials();
    }

    // The account must be active. A disabled account cannot obtain a session
    // even with the correct password, and the response stays generic.
    if (!user.isActive) {
      await this.audit({
        userId: user.id,
        action: 'login_denied',
        outcome: 'denied',
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: { reason: 'inactive' },
      });
      throw invalidCredentials();
    }

    await this.store.recordLoginSuccess(user.id, now);

    // Session-fixation defence: whatever session the browser presented is
    // destroyed before a brand-new id/token pair is issued.
    if (input.existingToken) {
      const existing = await this.store.findSessionByTokenHash(
        hashSessionToken(input.existingToken),
      );
      if (existing) await this.store.revokeSession(existing.id, now);
    }

    const token = generateSessionToken();
    const csrfToken = generateCsrfToken();
    const sessionId = newId();
    const expiresAt = new Date(now.getTime() + this.env.session.ttlHours * 3_600_000);

    await this.store.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      csrfToken,
      ipHash: hashIpAddress(input.ip, this.env.session.secret),
      userAgent: truncate(input.userAgent, 255),
      createdAt: now,
      expiresAt,
    });

    await this.audit({
      userId: user.id,
      action: 'login_success',
      outcome: 'success',
      resourceType: 'session',
      resourceId: sessionId,
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });

    return {
      user: toAuthUser(user),
      session: { id: sessionId, csrfToken, createdAt: now, expiresAt },
      token,
    };
  }

  /**
   * Resolves a cookie value into an authenticated context.
   * Order matters: cheap cryptographic checks, then expiry, then account state.
   */
  async authenticate(rawToken: string | null): Promise<AuthenticateResult> {
    if (!rawToken) {
      throw new AuthError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
    }

    const session = await this.store.findSessionByTokenHash(hashSessionToken(rawToken));
    const now = this.clock();

    if (!session || session.revokedAt !== null) {
      throw new AuthError(401, 'SESSION_INVALID', 'Your session is no longer valid. Sign in again.');
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.store.revokeSession(session.id, now);
      throw new AuthError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }

    const idleMs = now.getTime() - session.lastSeenAt.getTime();
    if (idleMs > this.env.session.idleMinutes * 60_000) {
      await this.store.revokeSession(session.id, now);
      throw new AuthError(401, 'SESSION_IDLE_TIMEOUT', 'Your session timed out. Sign in again.');
    }

    // A password change invalidates every session created before it.
    if (
      session.user.passwordChangedAt !== null &&
      session.createdAt.getTime() < session.user.passwordChangedAt.getTime()
    ) {
      await this.store.revokeSession(session.id, now);
      throw new AuthError(401, 'SESSION_INVALID', 'Your session is no longer valid. Sign in again.');
    }

    // Sessions minted before the CSRF column existed cannot be trusted.
    if (!session.csrfToken) {
      await this.store.revokeSession(session.id, now);
      throw new AuthError(401, 'SESSION_INVALID', 'Your session is no longer valid. Sign in again.');
    }

    // The account is re-checked on EVERY authenticated request, not just at
    // login: a deactivated user loses access immediately.
    if (!session.user.isActive) {
      await this.store.revokeUserSessions(session.user.id, now);
      await this.audit({
        userId: session.user.id,
        action: 'session_denied',
        outcome: 'denied',
        resourceType: 'session',
        resourceId: session.id,
        metadata: { reason: 'inactive' },
      });
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
    }

    if (idleMs > TOUCH_INTERVAL_MS) {
      await this.store.touchSession(session.id, now);
    }

    return {
      token: rawToken,
      user: toAuthUser(session.user),
      session: {
        id: session.id,
        csrfToken: session.csrfToken,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    };
  }

  async logout(context: AuthContext, request: RequestContext = {}): Promise<void> {
    const now = this.clock();
    await this.store.revokeSession(context.session.id, now);
    await this.audit({
      userId: context.user.id,
      action: 'logout',
      outcome: 'success',
      resourceType: 'session',
      resourceId: context.session.id,
      ip: request.ip,
      userAgent: request.userAgent,
      requestId: request.requestId,
    });
  }

  async setUserStatus(
    adminActor: AuthUser,
    targetUserId: string,
    isActive: boolean,
    context: RequestContext = {},
  ): Promise<void> {
    if (adminActor.role !== 'admin') {
      throw new AppError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Administrator access is required.',
      });
    }

    if (adminActor.id === targetUserId && !isActive) {
      throw new AppError({
        statusCode: 422,
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'Administrators cannot deactivate their own account.',
      });
    }

    const targetUser = await this.store.findUserById(targetUserId);
    if (!targetUser) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'No TrustVault account found with that ID.',
      });
    }

    const changed = await this.store.setUserActive(targetUserId, isActive);
    if (!changed) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'Failed to update account status.',
      });
    }

    await this.audit({
      userId: adminActor.id,
      targetUserId,
      action: isActive ? 'user.activated' : 'user.deactivated',
      outcome: 'success',
      resourceType: 'user',
      resourceId: targetUserId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        targetEmail: targetUser.email,
        previousStatus: targetUser.isActive ? 'active' : 'disabled',
        newStatus: isActive ? 'active' : 'disabled',
      },
    });
  }

  async listAuditLogs(
    params: AuditFilterParams,
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const [entries, total] = await Promise.all([
      this.store.listAuditLogs(params),
      this.store.countAuditLogs(params),
    ]);
    return { entries, total };
  }

  async verifyAuditIntegrity(): Promise<AuditVerificationResult> {
    return this.store.verifyAuditIntegrity();
  }

  async createCheckpoint(): Promise<CheckpointRecord | null> {
    return this.store.createCheckpoint();
  }

  async listCheckpoints(): Promise<CheckpointRecord[]> {
    return this.store.listCheckpoints();
  }

  /** Constant-time CSRF check, exposed so the middleware stays declarative. */
  verifyCsrfToken(provided: string | undefined, expected: string): boolean {
    if (provided === undefined || provided.length === 0) return false;
    return constantTimeEqual(provided, expected);
  }

  private async audit(input: {
    userId: string | null;
    companyId?: string | null;
    targetUserId?: string | null;
    action: string;
    outcome: 'success' | 'failure' | 'denied';
    resourceType?: string | null;
    resourceId?: string | null;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const event: AuditEventInput = {
      userId: input.userId,
      companyId: input.companyId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      outcome: input.outcome,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      ipHash: hashIpAddress(input.ip, this.env.session.secret),
      userAgent: truncate(input.userAgent, 255),
      requestId: input.requestId ?? null,
      metadata: input.metadata ?? null,
    };

    try {
      await this.store.recordAudit(event);
    } catch (error) {
      // Audit persistence must never crash user flows, but is logged for operators.
      this.logger?.warn({ err: error, action: event.action }, 'failed to persist audit event');
    }
  }
}
