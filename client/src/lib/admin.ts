import { API_PREFIX, request, type ApiResult } from './api';

export interface AdminOverview {
  users: number;
  activeUsers: number;
  documents: number;
  deletedDocuments: number;
  totalBytes: number;
  activeSessions: number;
  auditEvents: number;
  grants: number;
}

export interface AdminUserEntry {
  id: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  documentCount: number;
}

export interface AdminAuditEntry {
  id: string;
  userId: string | null;
  targetUserId: string | null;
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  resourceType: string | null;
  resourceId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  requestId: string | null;
  prevHash: string | null;
  entryHash: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  pagination: { limit: number; offset: number; total: number };
}

export interface AuditFilterParams {
  actor?: string | undefined;
  documentId?: string | undefined;
  action?: string | undefined;
  outcome?: 'success' | 'failure' | 'denied' | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface AuditRecoveryIncident {
  eventId: string;
  incidentType: string;
  action: string;
  corruptedField: string;
  remediationStatus: string;
  forensicNote: string;
}

export interface AuditVerificationResult {
  verified: boolean;
  totalEntries: number;
  checkedCheckpoints: number;
  lastVerifiedHash: string | null;
  failureReason?: string;
  failedAtId?: string;
  incidents?: AuditRecoveryIncident[];
}

export function fetchAdminOverview(): Promise<ApiResult<{ overview: AdminOverview }>> {
  return request<{ overview: AdminOverview }>(`${API_PREFIX}/admin/overview`);
}

export function fetchAdminUsers(): Promise<ApiResult<{ users: AdminUserEntry[] }>> {
  return request<{ users: AdminUserEntry[] }>(`${API_PREFIX}/admin/users`);
}

export function fetchAdminAuditLogs(
  params: AuditFilterParams | number = 20,
  offset = 0,
): Promise<ApiResult<AdminAuditPage>> {
  let query = '';
  if (typeof params === 'number') {
    query = `limit=${params}&offset=${offset}`;
  } else {
    const sp = new URLSearchParams();
    if (params.limit !== undefined) sp.set('limit', String(params.limit));
    if (params.offset !== undefined) sp.set('offset', String(params.offset));
    if (params.actor) sp.set('actor', params.actor);
    if (params.documentId) sp.set('documentId', params.documentId);
    if (params.action) sp.set('action', params.action);
    if (params.outcome) sp.set('outcome', params.outcome);
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    query = sp.toString();
  }

  return request<AdminAuditPage>(`${API_PREFIX}/admin/audit-logs?${query}`);
}

export function fetchPermissionHistory(
  documentId?: string,
  actor?: string,
  limit = 20,
  offset = 0,
): Promise<ApiResult<AdminAuditPage>> {
  const sp = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (documentId) sp.set('documentId', documentId);
  if (actor) sp.set('actor', actor);
  return request<AdminAuditPage>(`${API_PREFIX}/admin/permission-history?${sp.toString()}`);
}

export function verifyAuditIntegrity(): Promise<ApiResult<AuditVerificationResult>> {
  return request<AuditVerificationResult>(`${API_PREFIX}/admin/audit-logs/verify`);
}

export function createAuditCheckpoint(
  csrfToken: string,
): Promise<ApiResult<{ checkpoint: unknown }>> {
  return request<{ checkpoint: unknown }>(`${API_PREFIX}/admin/audit-logs/checkpoints`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export function setAdminUserStatus(
  userId: string,
  isActive: boolean,
  csrfToken: string,
): Promise<ApiResult<{ ok: boolean; userId: string; isActive: boolean }>> {
  return request<{ ok: boolean; userId: string; isActive: boolean }>(
    `${API_PREFIX}/admin/users/${userId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ isActive }),
    },
  );
}
