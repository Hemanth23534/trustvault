/** The three product roles. Kept in one place so SQL, guards and UI agree. */
export const USER_ROLES = ['admin', 'owner', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Account-level role check that never trusts client input. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** The only user shape that is ever returned by an API response. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedSession {
  id: string;
  /** Synchroniser token the browser must echo on state-changing requests. */
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthContext {
  user: AuthUser;
  session: AuthenticatedSession;
}
