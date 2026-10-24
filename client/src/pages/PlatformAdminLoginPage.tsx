import { useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { IconLock, IconShield } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/auth';
import { roleLabel } from '../lib/format';

export function PlatformAdminLoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, status, login, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated:
  if (status === 'authenticated' && user) {
    if (user.role === 'platform_admin') {
      return (
        <div className="auth-shell">
          <div className="auth-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <BrandMark size={44} />
            </div>
            <div className="tag tag-role-owner" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
              <IconShield width={14} height={14} /> Platform Administrator Active
            </div>
            <h2>Welcome Back, {user.displayName ?? user.email}</h2>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>
              You are currently authenticated as the Platform Administrator.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => navigate('/admin')}
              >
                Go to Platform Dashboard
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void logout()}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Authenticated as a non-platform admin
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandMark size={44} />
          </div>
          <div className="tag tag-muted" style={{ display: 'inline-flex', marginBottom: '1rem', color: '#f87171' }}>
            <IconLock width={14} height={14} /> Platform Portal Restricted
          </div>
          <h2>Access Restricted</h2>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            You are currently signed in as <strong>{user.email}</strong> with company role <strong>{roleLabel(user.role)}</strong>.
          </p>
          <div className="panel" style={{ textAlign: 'left', margin: '1rem 0', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#fca5a5' }}>
              This portal is strictly reserved for the Platform Administrator (website creator). Company owners, administrators, and team members must use the Company Workspace dashboard.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate('/dashboard')}
            >
              Go to Workspace Dashboard
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void logout()}
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setError(null);

    const result = await login(email.trim().toLowerCase(), password);

    if (result.ok) {
      if (result.user?.role === 'platform_admin') {
        navigate('/admin');
      } else {
        // Logged in user is not a platform admin
        // State will re-render into the restricted view above
      }
    } else {
      setError(result.message ?? 'Invalid administrator credentials.');
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <header className="auth-card-head" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <BrandMark size={40} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <span
              className="tag"
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <IconShield width={13} height={13} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Platform Administration
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', margin: '0.25rem 0' }}>Creator & Platform Portal</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Dedicated secure access for TrustVault platform governance, cross-company visibility, and audit ledger integrity.
          </p>
        </header>

        {error ? (
          <div
            className="alert alert-error"
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              margin: '1rem 0',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="form" style={{ marginTop: '1.25rem' }}>
          <div className="form-field">
            <label htmlFor="admin-email">Platform Administrator Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@trustvault.local"
              disabled={submitting}
            />
          </div>

          <div className="form-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="button button-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={submitting}
          >
            {submitting ? 'Verifying Platform Credentials…' : 'Sign In as Platform Administrator'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
            textAlign: 'center',
          }}
        >
          <p className="muted small" style={{ margin: '0 0 0.5rem 0' }}>
            Are you a Company Workspace owner or employee?
          </p>
          <Link
            to="/login"
            className="button button-secondary button-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            Go to Company Workspace Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
export default PlatformAdminLoginPage;
