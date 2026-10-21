/** The product roles: owner (full workspace control), admin (member/document management), editor (edit own and granted), viewer (read/download). */
export const USER_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Account-level role check that never trusts client input. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export interface Company {
  id: string;
  name: string;
  domain?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyInvitation {
  id: string;
  companyId: string;
  companyName?: string;
  invitedBy: string;
  invitedByName?: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** The only user shape that is ever returned by an API response. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  companyId?: string | null;
  companyName?: string | null;
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
