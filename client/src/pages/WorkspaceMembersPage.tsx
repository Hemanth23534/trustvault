import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchWorkspaceMembers,
  fetchWorkspaceInvitations,
  inviteWorkspaceMember,
  revokeWorkspaceInvitation,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type CompanyInvitation,
} from '../lib/workspace';
import type { AuthUser, UserRole } from '../lib/auth';
import { extractErrorMessage } from '../lib/auth';
import { roleLabel, formatDate } from '../lib/format';
import { IconUsers, IconShield, IconClose } from '../components/ui/Icons';
import { Skeleton, EmptyState } from '../components/ui/Feedback';

export function WorkspaceMembersPage(): JSX.Element {
  const { user, csrfToken } = useAuth();
  const [members, setMembers] = useState<AuthUser[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const canManage = isOwner || isAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetchWorkspaceMembers(),
        canManage ? fetchWorkspaceInvitations() : Promise.resolve({ ok: true as const, status: 200, data: { invitations: [] } }),
      ]);

      if (!membersRes.ok) {
        setError(extractErrorMessage(membersRes.data) ?? 'Failed to load members.');
        return;
      }

      setMembers(membersRes.data.members);
      if (invitesRes.ok) {
        setInvitations(invitesRes.data.invitations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load workspace members.');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleInvite(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!csrfToken) {
      setError('Security token not ready. Reload the page and try again.');
      return;
    }
    setInviting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await inviteWorkspaceMember(
        {
          email: inviteEmail.trim(),
          role: inviteRole,
        },
        csrfToken,
      );

      if (!result.ok) {
        setError(extractErrorMessage(result.data) ?? 'Failed to send invitation.');
        setInviting(false);
        return;
      }

      const invite = result.data.invitation;
      const inviteUrl = `${window.location.origin}/register?invite=${encodeURIComponent(invite.token)}`;
      setLastInviteLink(inviteUrl);
      setNotice(`Invitation email sent to ${invite.email}!`);
      setInviteEmail('');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(id: string): Promise<void> {
    if (!csrfToken) {
      setError('Security token not ready.');
      return;
    }
    try {
      await revokeWorkspaceInvitation(id, csrfToken);
      setInvitations((prev) => prev.filter((i) => i.id !== id));
      setNotice('Invitation revoked.');
    } catch {
      setError('Could not revoke invitation.');
    }
  }

  async function handleRemoveMember(member: AuthUser): Promise<void> {
    if (!csrfToken) {
      setError('Security token not ready.');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${member.displayName ?? member.email} from the workspace?`)) {
      return;
    }
    try {
      await removeWorkspaceMember(member.id, csrfToken);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setNotice(`Removed ${member.displayName ?? member.email}.`);
    } catch {
      setError('Could not remove member.');
    }
  }

  async function handleChangeRole(memberId: string, newRole: UserRole): Promise<void> {
    if (!csrfToken) {
      setError('Security token not ready.');
      return;
    }
    try {
      await updateWorkspaceMemberRole(memberId, newRole, csrfToken);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
      setNotice('Role updated.');
    } catch {
      setError('Could not update role.');
    }
  }

  if (!user?.companyId) {
    return (
      <div className="stack" style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <header className="card-header">
            <h2>Personal Workspace</h2>
            <p className="muted">
              You are currently using a personal workspace. Create a company workspace to invite team members and collaborate.
            </p>
          </header>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/workspace/create" className="button button-primary">
              Create Company Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 960, margin: '0 auto', gap: '2rem' }}>
      <div className="card">
        <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>{user.companyName ?? 'Workspace'} Members</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Manage access and roles for users in this workspace.
            </p>
          </div>
          <span className="badge badge-info">{members.length} member{members.length === 1 ? '' : 's'}</span>
        </header>

        {notice !== null ? (
          <p className="alert alert-success" role="status" style={{ marginTop: '1rem' }}>
            {notice}
          </p>
        ) : null}

        {error !== null ? (
          <p className="alert alert-error" role="alert" style={{ marginTop: '1rem' }}>
            {error}
          </p>
        ) : null}

        {loading ? (
          <div style={{ marginTop: '1.5rem' }}>
            <Skeleton lines={4} />
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  {canManage ? <th style={{ textAlign: 'right' }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.displayName ?? '—'}</strong>
                      {member.id === user.id ? <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>You</span> : null}
                    </td>
                    <td>{member.email}</td>
                    <td>
                      {isOwner && member.id !== user.id ? (
                        <select
                          value={member.role}
                          onChange={(e) => void handleChangeRole(member.id, e.target.value as UserRole)}
                          className="input-select-sm"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Administrator</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="badge badge-neutral">{roleLabel(member.role)}</span>
                      )}
                    </td>
                    {canManage ? (
                      <td style={{ textAlign: 'right' }}>
                        {member.id !== user.id && member.role !== 'owner' ? (
                          <button
                            type="button"
                            className="button button-ghost button-sm"
                            style={{ color: 'var(--color-error)' }}
                            onClick={() => void handleRemoveMember(member)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage ? (
        <div className="card">
          <header className="card-header">
            <h3 style={{ margin: 0 }}>Invite Team Member</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Send an invitation code or link to collaborate in this workspace.
            </p>
          </header>

          <form onSubmit={(e) => void handleInvite(e)} style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 240 }}>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                disabled={inviting}
              />
            </div>
            <div style={{ width: 140 }}>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                disabled={inviting}
              >
                {isOwner ? <option value="admin">Admin</option> : null}
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="button button-primary" disabled={inviting}>
              {inviting ? 'Inviting...' : 'Send Invitation'}
            </button>
          </form>

          {lastInviteLink ? (
            <div className="alert alert-info" style={{ marginTop: '1.25rem' }}>
              <strong>Invitation Email Dispatched:</strong>
              <p className="small muted" style={{ margin: '0.25rem 0 0.5rem 0' }}>
                An email was sent with joining instructions. You can also share this direct link as a fallback:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={lastInviteLink}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                />
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(lastInviteLink);
                    setNotice('Invitation link copied to clipboard!');
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          ) : null}

          {invitations.length > 0 ? (
            <div style={{ marginTop: '1.75rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Pending Invitations</h4>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td><span className="badge badge-neutral">{roleLabel(inv.role)}</span></td>
                        <td>{formatDate(inv.expiresAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="button button-ghost button-sm"
                            onClick={() => void handleRevokeInvite(inv.id)}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
