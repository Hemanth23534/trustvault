import { useCallback, useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { DocumentTable } from '../components/documents/DocumentTable';
import { IconArrowRight, IconFile, IconShare, IconUpload } from '../components/ui/Icons';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/auth';
import {
  downloadDocument,
  fetchDocumentStats,
  fetchDocuments,
  formatBytes,
  saveBlob,
  type DocumentItem,
  type DocumentStats,
} from '../lib/documents';

export function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, documentsResult] = await Promise.all([
        fetchDocumentStats(),
        fetchDocuments({ limit: 6, sort: 'created_at', order: 'desc' }),
      ]);

      if (!statsResult.ok) {
        setError(extractErrorMessage(statsResult.data) ?? `Could not load dashboard (HTTP ${statsResult.status}).`);
        return;
      }
      if (!documentsResult.ok) {
        setError(
          extractErrorMessage(documentsResult.data) ??
            `Could not load documents (HTTP ${documentsResult.status}).`,
        );
        return;
      }

      setStats(statsResult.data.stats);
      setDocuments(documentsResult.data.documents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload(document: DocumentItem): Promise<void> {
    setDownloadingId(document.id);
    setError(null);
    try {
      const blob = await downloadDocument(document.id);
      saveBlob(blob, document.fileName);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  const isViewer = user?.role === 'viewer';
  const canUpload = user?.role === 'admin' || user?.role === 'owner';

  if (loading && stats === null) {
    return (
      <div className="stack">
        <Skeleton lines={2} />
        <Skeleton lines={4} />
      </div>
    );
  }

  if (error !== null && stats === null) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="stack">
      <section className="page-intro">
        <div>
          <p className="eyebrow">{isViewer ? 'Viewer workspace' : 'Owner workspace'}</p>
          <h2>
            {isViewer
              ? 'Documents shared with you'
              : `Welcome back${user?.displayName !== undefined && user?.displayName !== null ? `, ${user.displayName.split(' ')[0]}` : ''}`}
          </h2>
          <p className="muted">
            {isViewer
              ? 'You can open and download documents that an owner has explicitly shared with you.'
              : 'Upload, organize and share documents. Every action is authorized by the API and recorded.'}
          </p>
        </div>

        {canUpload ? (
          <div className="intro-actions">
            <Link className="button button-primary" to="/documents/new">
              <IconUpload width={16} height={16} />
              Upload document
            </Link>
            <Link className="button button-secondary" to="/documents">
              Browse library
            </Link>
          </div>
        ) : null}
      </section>

      {error !== null ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="stat-grid" aria-label="Document statistics">
        <article className="stat-card">
          <span className="stat-label">{isViewer ? 'Shared with you' : 'Accessible documents'}</span>
          <strong className="stat-value">{stats?.totalDocuments ?? 0}</strong>
          <span className="stat-hint">
            {isViewer
              ? 'Explicit grants from owners'
              : `${stats?.ownedCount ?? 0} owned · ${stats?.sharedCount ?? 0} shared with you`}
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Storage used</span>
          <strong className="stat-value">{formatBytes(stats?.totalBytes ?? 0)}</strong>
          <span className="stat-hint">Sum of documents you can access</span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Categories</span>
          <strong className="stat-value">{stats?.byCategory.length ?? 0}</strong>
          <span className="stat-hint">
            {stats !== null && stats.byCategory.length > 0
              ? stats.byCategory.map((entry) => entry.category).join(', ')
              : 'No documents yet'}
          </span>
        </article>

        {user?.role === 'admin' ? (
          <article className="stat-card stat-card-accent">
            <span className="stat-label">Administration</span>
            <strong className="stat-value">Platform</strong>
            <Link className="stat-link" to="/admin">
              Open activity dashboard <IconArrowRight width={14} height={14} />
            </Link>
          </article>
        ) : (
          <article className="stat-card">
            <span className="stat-label">Access model</span>
            <strong className="stat-value">Owner + grants</strong>
            <span className="stat-hint">No public links exist for any document</span>
          </article>
        )}
      </section>

      <section className="panel" aria-labelledby="recent-documents">
        <header className="panel-head">
          <div>
            <h3 id="recent-documents">{isViewer ? 'Recent shares' : 'Recent documents'}</h3>
            <p className="muted small">Newest first</p>
          </div>
          <Link className="link-inline" to="/documents">
            View all <IconArrowRight width={14} height={14} />
          </Link>
        </header>

        {documents.length === 0 ? (
          <EmptyState
            icon={isViewer ? <IconShare width={26} height={26} /> : <IconFile width={26} height={26} />}
            title={isViewer ? 'Nothing has been shared with you yet' : 'No documents yet'}
            description={
              isViewer
                ? 'When an owner grants you access, the document appears here and in your library.'
                : 'Upload your first document to see it here. Files are validated by content on the server.'
            }
            action={
              canUpload ? (
                <Link className="button button-primary" to="/documents/new">
                  Upload a document
                </Link>
              ) : undefined
            }
          />
        ) : (
          <DocumentTable
            documents={documents}
            downloadingId={downloadingId}
            onDownload={(document) => void handleDownload(document)}
          />
        )}
      </section>
    </div>
  );
}
