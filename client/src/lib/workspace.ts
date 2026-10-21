import { API_PREFIX, request, type ApiResult } from './api';
import type { AuthUser, UserRole } from './auth';

export interface Company {
  id: string;
  name: string;
  domain?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceStatus {
  company: Company | null;
  isPersonal: boolean;
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
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchWorkspace(): Promise<ApiResult<WorkspaceStatus>> {
  return request<WorkspaceStatus>(`${API_PREFIX}/workspace`);
}

export function createWorkspace(companyName: string): Promise<ApiResult<{ user: AuthUser }>> {
  return request<{ user: AuthUser }>(`${API_PREFIX}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName }),
  });
}

export function updateWorkspaceSettings(patch: {
  name?: string;
  domain?: string | null;
}): Promise<ApiResult<{ company: Company }>> {
  return request<{ company: Company }>(`${API_PREFIX}/workspace`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function fetchWorkspaceMembers(): Promise<ApiResult<{ members: AuthUser[] }>> {
  return request<{ members: AuthUser[] }>(`${API_PREFIX}/workspace/members`);
}

export function fetchWorkspaceInvitations(): Promise<
  ApiResult<{ invitations: CompanyInvitation[] }>
> {
  return request<{ invitations: CompanyInvitation[] }>(`${API_PREFIX}/workspace/invitations`);
}

export function inviteWorkspaceMember(input: {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}): Promise<ApiResult<{ invitation: CompanyInvitation }>> {
  return request<{ invitation: CompanyInvitation }>(`${API_PREFIX}/workspace/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function revokeWorkspaceInvitation(id: string): Promise<ApiResult<void>> {
  return request<void>(`${API_PREFIX}/workspace/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function acceptWorkspaceInvitation(token: string): Promise<ApiResult<{ user: AuthUser }>> {
  return request<{ user: AuthUser }>(`${API_PREFIX}/workspace/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export function removeWorkspaceMember(userId: string): Promise<ApiResult<void>> {
  return request<void>(`${API_PREFIX}/workspace/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export function updateWorkspaceMemberRole(
  userId: string,
  role: UserRole,
): Promise<ApiResult<void>> {
  return request<void>(`${API_PREFIX}/workspace/members/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}
