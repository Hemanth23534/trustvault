import { useState, type FormEvent, type JSX } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { IconActivity, IconLock, IconShare, IconShield } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';

const HIGHLIGHTS = [
  {
    icon: <IconShield width={17} height={17} />,
    title: 'Server-side sessions',
    body: 'The browser holds an opaque token in an HttpOnly cookie — never a password or a token in storage.',
  },
  {
    icon: <IconLock width={17} height={17} />,
    title: 'Private by default',
    body: 'Documents live outside the web root and are streamed only after an authorization check.',
  },
  {
    icon: <IconShare width={17} height={17} />,
    title: 'Explicit sharing',
    body: 'Every non-owner needs an active grant, and revoking one takes effect on the next request.',
  },
  {
    icon: <IconActivity width={17} height={17} />,
    title: 'Auditable access',
    body: 'Uploads, downloads, edits and permission changes are recorded for owners and administrators.',
  },
];

export function LoginPage(): JSX.Element {
  const { status, login, notice, clearNotice } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestedPath = (location.state as { from?: string } | null)?.from;
  const redirectTo =
    requestedPath !== undefined && requestedPath.startsWith('/') ? requestedPath : '/';

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    clearNotice();

    const outcome = await login(email.trim(), password);
    if (!outcome.ok) {
      setError(outcome.message ?? 'Sign-in failed.');
    }
    setBusy(false);
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <BrandMark />
          <span>TrustVault</span>
        </div>

        <div className="login-hero-copy">
          <p className="eyebrow">Secure document sharing</p>
          <h1>
            Share documents with people,
            <span className="accent-text"> not with the internet.</span>
          </h1>
          <p className="login-lede">
            Private storage, explicit grants and a complete access history — built for teams that
            need to prove who could see what.
          </p>
        </div>

        <ul className="login-points">
          {HIGHLIGHTS.map((point) => (
            <li key={point.title}>
              <span className="login-point-icon">{point.icon}</span>
              <div>
                <strong>{point.title}</strong>
                <p>{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header>
            <h2>Sign in</h2>
            <p className="muted">Use your TrustVault account to continue.</p>
          </header>

          {notice !== null ? (
            <p className="alert alert-info" role="status">
              {notice}
            </p>
          ) : null}
          {error !== null ? (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          ) : null}

          <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="input-with-action">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <button
                  className="input-action"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button className="button button-primary button-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login-hint" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            New company or organization?{' '}
            <Link to="/register" style={{ fontWeight: 600, color: 'var(--color-brand)' }}>
              Register company workspace
            </Link>
          </p>

          <p className="login-hint">
            Demo accounts are created with <code className="mono">npm run seed</code> in the server
            workspace; the seed prints each generated password once.
          </p>
        </div>

        <p className="login-footnote">
          Sessions expire automatically. If yours ends, you will be returned here with an
          explanation — your password is never stored in the browser.
        </p>
      </section>
    </div>
  );
}
