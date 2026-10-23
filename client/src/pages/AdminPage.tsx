import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { AccessDenied, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { IconActivity, IconLock, IconShield, IconUsers } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/auth';
import {
  createAuditCheckpoint,
  fetchAdminAuditLogs,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchPermissionHistory,
  setAdminUserStatus,
  verifyAuditIntegrity,
  type AdminAuditEntry,
  type AdminOverview,
  type AdminUserEntry,
  type AuditFilterParams,
  type AuditVerificationResult,
} from '../lib/admin';
import { formatBytes } from '../lib/documents';
import { actionLabel, formatDateTime, relativeTime, roleLabel } from '../lib/format';

const PAGE_SIZE = 20;

export function AdminPage(): JSX.Element {
  const { user: currentActor, csrfToken } = useAuth();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [activity, setActivity] = useState<AdminAuditEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [permissionHistory, setPermissionHistory] = useState<AdminAuditEntry[]>([]);
  const [permissionTotal, setPermissionTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Tabs: 'audit' | 'permissions' | 'users'
  const [activeTab, setActiveTab] = useState<'audit' | 'permissions' | 'users'>('audit');

  // Audit Filters
  const [filterActor, setFilterActor] = useState('');
  const [filterDocId, setFilterDocId] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<'success' | 'failure' | 'denied' | ''>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [auditPage, setAuditPage] = useState(0);

  // Integrity Verification
  const [integrity, setIntegrity] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [creatingCheckpoint, setCreatingCheckpoint] = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  const loadAuditLogs = useCallback(async (page: number, filters?: Partial<AuditFilterParams>) => {
    try {
      const result = await fetchAdminAuditLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        actor: filters?.actor || undefined,
        documentId: filters?.documentId || undefined,
        action: filters?.action || undefined,
        outcome: filters?.outcome || undefined,
        from: filters?.from || undefined,
        to: filters?.to || undefined,
      });
      if (result.ok) {
        setActivity(result.data.entries);
        setActivityTotal(result.data.pagination.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query audit logs.');
    }
  }, []);

  const loadPermissionHistory = useCallback(async () => {
    try {
      const result = await fetchPermissionHistory(undefined, undefined, PAGE_SIZE, 0);
      if (result.ok) {
        setPermissionHistory(result.data.entries);
        setPermissionTotal(result.data.pagination.total);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewResult, usersResult, activityResult, permResult] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminUsers(),
        fetchAdminAuditLogs(PAGE_SIZE, 0),
        fetchPermissionHistory(undefined, undefined, PAGE_SIZE, 0),
      ]);

      const results = [overviewResult, usersResult, activityResult, permResult];
      if (results.some((result) => result.status === 403)) {
        setDenied(true);
        return;
      }

      const failed = results.find((result) => !result.ok);
      if (failed !== undefined) {
        setError(extractErrorMessage(failed.data) ?? `Could not load administration data (HTTP ${failed.status}).`);
        return;
      }

      if (overviewResult.ok) setOverview(overviewResult.data.overview);
      if (usersResult.ok) setUsers(usersResult.data.users);
      if (activityResult.ok) {
        setActivity(activityResult.data.entries);
        setActivityTotal(activityResult.data.pagination.total);
      }
      if (permResult.ok) {
        setPermissionHistory(permResult.data.entries);
        setPermissionTotal(permResult.data.pagination.total);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load administration data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleApplyFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditPage(0);
    await loadAuditLogs(0, {
      actor: filterActor.trim(),
      documentId: filterDocId.trim(),
      action: filterAction.trim(),
      outcome: filterOutcome || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    });
  };

  const handleResetFilters = async () => {
    setFilterActor('');
    setFilterDocId('');
    setFilterAction('');
    setFilterOutcome('');
    setFilterFrom('');
    setFilterTo('');
    setAuditPage(0);
    await loadAuditLogs(0);
  };

  const handlePageChange = async (newPage: number) => {
    setAuditPage(newPage);
    await loadAuditLogs(newPage, {
      actor: filterActor.trim(),
      documentId: filterDocId.trim(),
      action: filterAction.trim(),
      outcome: filterOutcome || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    });
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setFeedback(null);
    try {
      const res = await verifyAuditIntegrity();
      if (res.ok) {
        setIntegrity(res.data);
        if (res.data.verified) {
          const incidentMsg = res.data.incidents && res.data.incidents.length > 0
            ? ` (${res.data.incidents.length} legacy cascade anomalies formally attested)`
            : '';
          setFeedback(`Audit integrity verified! SHA-256 chain intact across ${res.data.totalEntries} entries and ${res.data.checkedCheckpoints} checkpoints${incidentMsg}.`);
        } else {
          setError(`Tamper alert! ${res.data.failureReason ?? 'Cryptographic chain verification failed.'}`);
        }
      } else {
        setError(extractErrorMessage(res.data) ?? 'Failed to verify audit ledger integrity.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking audit integrity.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    if (!csrfToken) {
      setError('Security token not ready. Reload the page and try again.');
      return;
    }
    setCreatingCheckpoint(true);
    setFeedback(null);
    try {
      const res = await createAuditCheckpoint(csrfToken);
      if (res.ok) {
        setFeedback('Cryptographic checkpoint successfully anchored.');
        await handleVerifyIntegrity();
      } else {
        setError(extractErrorMessage(res.data) ?? 'Failed to anchor checkpoint.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating checkpoint.');
    } finally {
      setCreatingCheckpoint(false);
    }
  };

  const handleToggleUserStatus = async (user: AdminUserEntry) => {
    if (user.id === currentActor?.id) {
      setError('You cannot deactivate your own administrative account.');
      return;
    }
    if (!csrfToken) {
      setError('Security token not ready. Reload the page and try again.');
      return;
    }
    setTogglingUser(user.id);
    setError(null);
    setFeedback(null);

    const nextState = !user.isActive;
    try {
      const res = await setAdminUserStatus(user.id, nextState, csrfToken);
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: nextState } : u)),
        );
        setFeedback(`Account ${user.email} has been ${nextState ? 'activated' : 'deactivated'}.`);
        await loadAuditLogs(auditPage);
        const overRes = await fetchAdminOverview();
        if (overRes.ok) setOverview(overRes.data.overview);
      } else {
        setError(extractErrorMessage(res.data) ?? 'Failed to change user account status.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user status.');
    } finally {
      setTogglingUser(null);
    }
  };

  const emailById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.email);
    return map;
  }, [users]);

  if (denied) {
    return (
      <AccessDenied
        title="Administrator access required"
        message="This dashboard is only available to platform administrators."
      />
    );
  }

  if (loading && overview === null) {
    return <LoadingBlock label="Loading platform activity…" />;
  }

  if (error !== null && overview === null) {
    return <ErrorState message={error} onRetry={() => void loadInitial()} />;
  }

  const totalAuditPages = Math.ceil(activityTotal / PAGE_SIZE) || 1;

  return (
    <div className="stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>Platform & Audit Security</h2>
          <p className="muted">
            Tamper-evident append-only audit trail, cross-tenant permission history, and account governance.
          </p>
        </div>
        <div className="intro-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void loadInitial()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>
      </section>

      {/* Security Invariant Notice */}
      <aside className="alert alert-info" role="status">
        <IconShield width={16} height={16} />
        <div>
          <strong>Administrator Separation Invariant Active:</strong> Platform administrators have no
          automatic authorization to view or download document contents. Only document metadata, audit events,
          and identity records are accessible through administrative endpoints.
        </div>
      </aside>

      {feedback !== null ? (
        <p className="alert alert-success" role="status">
          {feedback}
        </p>
      ) : null}

      {error !== null ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Overview Counters */}
      <section className="stat-grid" aria-label="Platform counters">
        <article className="stat-card">
          <span className="stat-label">Accounts</span>
          <strong className="stat-value">{overview?.users ?? 0}</strong>
          <span className="stat-hint">{overview?.activeUsers ?? 0} active</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Documents</span>
          <strong className="stat-value">{overview?.documents ?? 0}</strong>
          <span className="stat-hint">{overview?.deletedDocuments ?? 0} soft-deleted</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Stored bytes</span>
          <strong className="stat-value">{formatBytes(overview?.totalBytes ?? 0)}</strong>
          <span className="stat-hint">Across all documents</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Active sessions</span>
          <strong className="stat-value">{overview?.activeSessions ?? 0}</strong>
          <span className="stat-hint">Not revoked or expired</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Grants</span>
          <strong className="stat-value">{overview?.grants ?? 0}</strong>
          <span className="stat-hint">Explicit permissions</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Audit events</span>
          <strong className="stat-value">{overview?.auditEvents ?? 0}</strong>
          <span className="stat-hint">Cryptographically chained</span>
        </article>
      </section>

      {/* Tamper-Evidence & Integrity Status */}
      <section className="panel" aria-labelledby="audit-integrity">
        <header className="panel-head">
          <div>
            <h3 id="audit-integrity">
              <IconLock width={16} height={16} /> Audit Trail Tamper Evidence
            </h3>
            <p className="muted small">
              Cryptographic SHA-256 hash chain and periodic checkpoints guarantee ledger integrity.
            </p>
          </div>
          <div className="intro-actions">
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => void handleVerifyIntegrity()}
              disabled={verifying}
            >
              {verifying ? 'Verifying Chain…' : 'Verify Integrity'}
            </button>
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => void handleCreateCheckpoint()}
              disabled={creatingCheckpoint}
            >
              {creatingCheckpoint ? 'Anchoring…' : 'Anchor Checkpoint'}
            </button>
          </div>
        </header>

        <div className={`callout ${integrity?.verified === false ? 'callout-danger' : 'callout-subtle'}`}>
          <div className="split">
            <div>
              <p className="small">
                <strong>Status: </strong>
                {integrity === null ? (
                  <span className="muted">Not checked this session</span>
                ) : integrity.verified ? (
                  <span className="tag tag-active">Verified Intact ({integrity.totalEntries} entries, {integrity.checkedCheckpoints} checkpoints)</span>
                ) : (
                  <span className="tag tag-danger">Tamper Detected</span>
                )}
              </p>
              {integrity?.lastVerifiedHash ? (
                <p className="mono small muted" style={{ marginTop: '0.25rem' }}>
                  Anchor Hash: {integrity.lastVerifiedHash.slice(0, 24)}…
                </p>
              ) : null}
              {integrity?.verified && integrity.incidents && integrity.incidents.length > 0 ? (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <p style={{ margin: '0.2rem 0', color: 'var(--color-primary, #38bdf8)' }}>
                    <strong>Attested Recovery: </strong>{integrity.incidents.length} historical events (IDs: {integrity.incidents.map((i) => `#${i.eventId}`).join(', ')}) formally attested in recovery registry. Original audit evidence preserved without data fabrication.
                  </p>
                </div>
              ) : null}
              {integrity?.verified === false ? (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {integrity.failedAtId ? (
                    <p style={{ margin: '0.2rem 0', fontWeight: 600 }}>
                      Failed Event ID: <span className="mono">#{integrity.failedAtId}</span>
                    </p>
                  ) : null}
                  {integrity.failureReason ? (
                    <p style={{ margin: '0.2rem 0', color: 'var(--color-danger, #ef4444)' }}>
                      <strong>Failure Reason: </strong>{integrity.failureReason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="small muted" style={{ maxWidth: '440px' }}>
              Database triggers enforce append-only immutability by rejecting raw UPDATE and DELETE operations on audit tables.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="toolbar" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className={`button ${activeTab === 'audit' ? 'button-primary' : 'button-secondary'}`}
          onClick={() => setActiveTab('audit')}
        >
          <IconActivity width={16} height={16} /> Audit Trail ({activityTotal})
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'permissions' ? 'button-primary' : 'button-secondary'}`}
          onClick={() => {
            setActiveTab('permissions');
            void loadPermissionHistory();
          }}
        >
          <IconShield width={16} height={16} /> Permission Changes ({permissionTotal})
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'users' ? 'button-primary' : 'button-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          <IconUsers width={16} height={16} /> Accounts ({users.length})
        </button>
      </div>

      {/* TAB 1: Audit Trail with Filters */}
      {activeTab === 'audit' ? (
        <section className="panel" aria-labelledby="admin-activity">
          <header className="panel-head">
            <div>
              <h3 id="admin-activity">Audit Events</h3>
              <p className="muted small">
                Every login, upload, view, download, edit, deletion, permission change, and denied attempt.
              </p>
            </div>
          </header>

          {/* Filter Form */}
          <form className="toolbar" onSubmit={(e) => void handleApplyFilters(e)} style={{ marginBottom: '1.25rem' }}>
            <div className="field" style={{ minWidth: '150px' }}>
              <label htmlFor="filter-actor">Actor (Email / ID)</label>
              <input
                id="filter-actor"
                type="text"
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                placeholder="User email or ID"
              />
            </div>

            <div className="field" style={{ minWidth: '150px' }}>
              <label htmlFor="filter-doc">Document ID</label>
              <input
                id="filter-doc"
                type="text"
                value={filterDocId}
                onChange={(e) => setFilterDocId(e.target.value)}
                placeholder="UUID"
              />
            </div>

            <div className="field" style={{ minWidth: '160px' }}>
              <label htmlFor="filter-action">Action</label>
              <select
                id="filter-action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="">All Actions</option>
                <option value="login_success">login_success</option>
                <option value="login_failed">login_failed</option>
                <option value="document.uploaded">document.uploaded</option>
                <option value="document.viewed">document.viewed</option>
                <option value="document.downloaded">document.downloaded</option>
                <option value="document.updated">document.updated</option>
                <option value="document.deleted">document.deleted</option>
                <option value="document.permission_%">Permission changes</option>
                <option value="document.%denied%">Denied access attempts</option>
                <option value="user.activated">user.activated</option>
                <option value="user.deactivated">user.deactivated</option>
              </select>
            </div>

            <div className="field" style={{ minWidth: '120px' }}>
              <label htmlFor="filter-outcome">Outcome</label>
              <select
                id="filter-outcome"
                value={filterOutcome}
                onChange={(e) =>
                  setFilterOutcome(e.target.value as 'success' | 'failure' | 'denied' | '')
                }
              >
                <option value="">All Outcomes</option>
                <option value="success">Success</option>
                <option value="denied">Denied</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="filter-from">From Date</label>
              <input
                id="filter-from"
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="filter-to">To Date</label>
              <input
                id="filter-to"
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>

            <div className="field" style={{ justifyContent: 'flex-end', flexDirection: 'row', gap: '0.5rem' }}>
              <button className="button button-primary" type="submit">
                Apply
              </button>
              <button className="button button-secondary" type="button" onClick={() => void handleResetFilters()}>
                Reset
              </button>
            </div>
          </form>

          {activity.length === 0 ? (
            <p className="muted" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              No audit events match the selected criteria.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">Resource / Target</th>
                    <th scope="col">Correlation & Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((entry) => (
                    <tr key={entry.id}>
                      <td className="cell-number" title={entry.createdAt}>
                        {relativeTime(entry.createdAt)}
                      </td>
                      <td>
                        <strong>{actionLabel(entry.action)}</strong>
                        <div className="mono muted small">{entry.action}</div>
                      </td>
                      <td className="mono small">
                        {entry.userId === null
                          ? 'system'
                          : (emailById.get(entry.userId) ?? entry.userId.slice(0, 8))}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            entry.outcome === 'success'
                              ? 'tag-active'
                              : entry.outcome === 'denied'
                                ? 'tag-warning'
                                : 'tag-danger'
                          }`}
                        >
                          {entry.outcome}
                        </span>
                      </td>
                      <td className="small">
                        {entry.resourceId ? (
                          <div>
                            <span className="muted">{entry.resourceType ?? 'res'}: </span>
                            <span className="mono">{entry.resourceId.slice(0, 8)}…</span>
                          </div>
                        ) : null}
                        {entry.targetUserId ? (
                          <div>
                            <span className="muted">target: </span>
                            <span className="mono">
                              {emailById.get(entry.targetUserId) ?? entry.targetUserId.slice(0, 8)}
                            </span>
                          </div>
                        ) : null}
                        {entry.outcome === 'denied' && entry.metadata ? (
                          <div className="tag tag-muted" style={{ marginTop: '0.2rem' }}>
                            {JSON.stringify(entry.metadata)}
                          </div>
                        ) : null}
                      </td>
                      <td className="mono small muted">
                        {entry.requestId ? (
                          <div title={`Request ID: ${entry.requestId}`}>
                            req: {entry.requestId.slice(0, 8)}…
                          </div>
                        ) : null}
                        {entry.entryHash ? (
                          <div title={`SHA-256: ${entry.entryHash}`}>
                            hash: {entry.entryHash.slice(0, 8)}…
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="split" style={{ marginTop: '1rem', alignItems: 'center' }}>
            <span className="muted small">
              Page {auditPage + 1} of {totalAuditPages} ({activityTotal} total entries)
            </span>
            <div className="intro-actions">
              <button
                className="button button-secondary button-sm"
                type="button"
                onClick={() => void handlePageChange(auditPage - 1)}
                disabled={auditPage === 0}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-sm"
                type="button"
                onClick={() => void handlePageChange(auditPage + 1)}
                disabled={auditPage >= totalAuditPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* TAB 2: Permission Change History */}
      {activeTab === 'permissions' ? (
        <section className="panel" aria-labelledby="admin-perms">
          <header className="panel-head">
            <div>
              <h3 id="admin-perms">Permission Change History</h3>
              <p className="muted small">
                Full chronological ledger of explicit grants and revocations across all documents.
              </p>
            </div>
          </header>

          {permissionHistory.length === 0 ? (
            <p className="muted" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              No permission grant or revocation events recorded.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Grantor / Owner</th>
                    <th scope="col">Target User</th>
                    <th scope="col">Document ID</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td className="cell-number" title={entry.createdAt}>
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            entry.action.includes('granted') ? 'tag-active' : 'tag-muted'
                          }`}
                        >
                          {entry.action.includes('granted') ? 'Granted' : 'Revoked'}
                        </span>
                      </td>
                      <td className="mono small">
                        {entry.userId ? (emailById.get(entry.userId) ?? entry.userId) : 'system'}
                      </td>
                      <td className="mono small">
                        {entry.targetUserId
                          ? (emailById.get(entry.targetUserId) ?? entry.targetUserId)
                          : ((entry.metadata as Record<string, unknown>)?.targetEmail as string) ?? 'unknown'}
                      </td>
                      <td className="mono small">
                        {entry.resourceId ? `${entry.resourceId.slice(0, 13)}…` : '-'}
                      </td>
                      <td className="small">
                        {(entry.metadata as Record<string, unknown>)?.role ? (
                          <span className="tag tag-role-owner">
                            Role: {String((entry.metadata as Record<string, unknown>).role)}
                          </span>
                        ) : (
                          <span className="muted">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 3: Accounts Management */}
      {activeTab === 'users' ? (
        <section className="panel" aria-labelledby="admin-users">
          <header className="panel-head">
            <div>
              <h3 id="admin-users">
                <IconUsers width={16} height={16} /> User Accounts & Activation
              </h3>
              <p className="muted small">
                Deactivating an account immediately revokes all of its active sessions and denies subsequent requests.
              </p>
            </div>
          </header>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="cell-owner">
                        <span>{user.displayName ?? user.email}</span>
                        {user.displayName !== null ? (
                          <span className="muted small">{user.email}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={`tag tag-role-${user.role === 'admin' ? 'owner' : user.role}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${user.isActive ? 'tag-active' : 'tag-muted'}`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="cell-number">{user.documentCount}</td>
                    <td className="cell-number">
                      {user.lastLoginAt !== null ? formatDateTime(user.lastLoginAt) : 'Never'}
                    </td>
                    <td>
                      {user.id === currentActor?.id ? (
                        <span className="muted small">(Current account)</span>
                      ) : (
                        <button
                          type="button"
                          className={`button button-sm ${user.isActive ? 'button-danger' : 'button-secondary'}`}
                          onClick={() => void handleToggleUserStatus(user)}
                          disabled={togglingUser === user.id}
                        >
                          {togglingUser === user.id
                            ? 'Updating…'
                            : user.isActive
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="muted small">
        <IconShield width={14} height={14} /> Passwords, session cookies, auth tokens, and document contents are strictly excluded from the audit log. IP addresses are HMAC-hashed with server secrets.
      </p>
    </div>
  );
}
