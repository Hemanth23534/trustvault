import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../context/AuthContext';
import * as AuthContextModule from '../../context/AuthContext';
import { RequireAuth, RequireRole } from './ProtectedRoute';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean; state?: unknown }) => {
      navigateSpy(props);
      return <div data-testid="navigate-mock" data-to={props.to} />;
    },
  };
});

describe('ProtectedRoute components', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    vi.restoreAllMocks();
  });
  const mockAuthContext = (overrides: Partial<AuthContextValue>): AuthContextValue => ({
    status: 'authenticated',
    user: {
      id: 'usr-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'owner',
      isActive: true,
      companyId: 'comp-1',
      companyName: 'Acme',
    },
    session: {
      csrfToken: 'csrf-123',
      createdAt: '2026-10-21T00:00:00Z',
      expiresAt: '2026-10-22T00:00:00Z',
    },
    csrfToken: 'csrf-123',
    notice: null,
    login: vi.fn(),
    register: vi.fn(),
    registerCompany: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn(),
    expireSession: vi.fn(),
    clearNotice: vi.fn(),
    ...overrides,
  });

  describe('RequireAuth', () => {
    it('renders session loading block during checking phase to prevent race conditions', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({ status: 'checking', user: null, session: null }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(html).toContain('Checking your session…');
      expect(html).not.toContain('Dashboard content');
    });

    it('redirects anonymous user at root / to /welcome on first visit before session flag is set', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({ status: 'anonymous', user: null, session: null }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route index element={<div>Dashboard content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(navigateSpy).toHaveBeenCalledWith({ to: '/welcome', replace: true });
      expect(html).toContain('data-to="/welcome"');
      expect(html).not.toContain('Dashboard content');
    });

    it('redirects anonymous user to /login directly once welcome experience was seen', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({ status: 'anonymous', user: null, session: null }),
      );

      const originalSessionStorage = globalThis.sessionStorage;
      globalThis.sessionStorage = {
        getItem: vi.fn((key: string) => (key === 'trustvault_welcome_seen' ? '1' : null)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 1,
      };

      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route index element={<div>Dashboard content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(navigateSpy).toHaveBeenCalledWith({ to: '/login', replace: true, state: { from: '/' } });
      expect(html).toContain('data-to="/login"');
      expect(html).not.toContain('Dashboard content');

      globalThis.sessionStorage = originalSessionStorage;
    });

    it('redirects anonymous user with deep link directly to /login with preserve state', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({ status: 'anonymous', user: null, session: null }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/documents/doc-456']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/documents/doc-456" element={<div>Document 456</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(navigateSpy).toHaveBeenCalledWith({
        to: '/login',
        replace: true,
        state: { from: '/documents/doc-456' },
      });
      expect(html).toContain('data-to="/login"');
    });
  });

  describe('RequireRole', () => {
    it('redirects company admin away from platform admin route to dashboard without 403 error', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({
          status: 'authenticated',
          user: {
            id: 'usr-comp-admin',
            email: 'admin@acme.example',
            displayName: 'Company Admin',
            role: 'admin',
            isActive: true,
            companyId: 'comp-1',
            companyName: 'Acme',
          },
        }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<RequireRole roles={['platform_admin']} />}>
              <Route path="/admin" element={<div>Platform Admin Dashboard</div>} />
            </Route>
            <Route path="/dashboard" element={<div>Company Dashboard Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(html).not.toContain('Platform Admin Dashboard');
      expect(html).not.toContain('403');
      expect(html).toContain('data-to="/dashboard"');
      expect(navigateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/dashboard', replace: true }),
      );
    });

    it('redirects company owner away from platform admin route to dashboard without 403 error', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({
          status: 'authenticated',
          user: {
            id: 'usr-owner',
            email: 'owner@example.com',
            displayName: 'Company Owner',
            role: 'owner',
            isActive: true,
            companyId: 'comp-1',
            companyName: 'Acme',
          },
        }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<RequireRole roles={['platform_admin']} />}>
              <Route path="/admin" element={<div>Platform Admin Dashboard</div>} />
            </Route>
            <Route path="/dashboard" element={<div>Company Dashboard Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(html).not.toContain('Platform Admin Dashboard');
      expect(html).not.toContain('403');
      expect(html).toContain('data-to="/dashboard"');
      expect(navigateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/dashboard', replace: true }),
      );
    });

    it('redirects normal employees (editor/viewer) away from platform admin route to dashboard', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({
          status: 'authenticated',
          user: {
            id: 'usr-viewer',
            email: 'viewer@acme.example',
            displayName: 'Viewer',
            role: 'viewer',
            isActive: true,
            companyId: 'comp-1',
            companyName: 'Acme',
          },
        }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<RequireRole roles={['platform_admin']} />}>
              <Route path="/admin" element={<div>Platform Admin Dashboard</div>} />
            </Route>
            <Route path="/dashboard" element={<div>Company Dashboard Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(html).not.toContain('Platform Admin Dashboard');
      expect(html).not.toContain('403');
      expect(html).toContain('data-to="/dashboard"');
      expect(navigateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/dashboard', replace: true }),
      );
    });

    it('allows platform_admin role to access platform admin route', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({
          status: 'authenticated',
          user: {
            id: 'usr-platform-admin',
            email: 'admin@trustvault.local',
            displayName: 'System Creator',
            role: 'platform_admin',
            isActive: true,
            companyId: null,
            companyName: null,
          },
        }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<RequireRole roles={['platform_admin']} />}>
              <Route path="/admin" element={<div>Platform Admin Dashboard</div>} />
            </Route>
            <Route path="/dashboard" element={<div>Company Dashboard Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(html).toContain('Platform Admin Dashboard');
      expect(html).not.toContain('403');
    });
  });
});
