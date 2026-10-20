import { useEffect, useState, type JSX } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { minutesUntil, roleLabel } from '../../lib/format';
import { BrandMark } from '../BrandMark';
import {
  IconActivity,
  IconClose,
  IconDashboard,
  IconFile,
  IconLogout,
  IconMenu,
  IconShield,
  IconUpload,
  IconUsers,
} from '../ui/Icons';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  end?: boolean;
  roles?: Array<'admin' | 'owner' | 'viewer'>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
  { to: '/documents', label: 'Documents', icon: <IconFile /> },
  { to: '/documents/new', label: 'Upload', icon: <IconUpload />, roles: ['admin', 'owner'] },
  { to: '/history', label: 'Access history', icon: <IconActivity />, roles: ['admin', 'owner'] },
  { to: '/admin', label: 'Administration', icon: <IconUsers />, roles: ['admin'] },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/documents') return 'Documents';
  if (pathname === '/documents/new') return 'Upload document';
  if (pathname.startsWith('/documents/')) return 'Document details';
  if (pathname === '/history') return 'Access history';
  if (pathname === '/admin') return 'Administration';
  return 'TrustVault';
}

function sessionLabel(expiresAt: string, now: number): string {
  void now;
  const minutes = minutesUntil(expiresAt);
  if (minutes <= 0) return 'Session expired';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m left` : `${rest}m left`;
}

/** Persistent application frame: sidebar navigation, top bar and page outlet. */
export function AppShell(): JSX.Element {
  const { user, session, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === undefined || (user !== null && item.roles.includes(user.role)),
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <span className="sidebar-name">TrustVault</span>
            <span className="sidebar-tagline">Secure document sharing</span>
          </div>
          <button
            className="icon-button sidebar-close"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="session-chip">
            <IconShield width={14} height={14} />
            <span>{session !== null ? sessionLabel(session.expiresAt, now) : 'No session'}</span>
          </div>

          {user !== null ? (
            <div className="sidebar-user">
              <div className="avatar" aria-hidden="true">
                {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <strong>{user.displayName ?? user.email}</strong>
                <span className="muted small">
                  {roleLabel(user.role)}
                  {user.companyName ? ` • ${user.companyName}` : ''}
                </span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
              >
                <IconLogout />
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="shell-main">
        <header className="topbar">
          <button
            className="icon-button topbar-menu"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <IconMenu />
          </button>
          <div className="topbar-heading">
            <span className="topbar-eyebrow">
              {user?.companyName ? `${user.companyName} workspace` : 'TrustVault workspace'}
            </span>
            <h1>{pageTitle(location.pathname)}</h1>
          </div>
          <div className="topbar-account">
            <span className="muted small">{user?.email}</span>
            <button className="button button-ghost button-sm" type="button" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
