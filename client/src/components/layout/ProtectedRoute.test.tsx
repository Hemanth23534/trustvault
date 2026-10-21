import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../context/AuthContext';
import * as AuthContextModule from '../../context/AuthContext';
import { RequireAuth, RequireRole } from './ProtectedRoute';

describe('ProtectedRoute components', () => {
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
  });

  describe('RequireRole', () => {
    it('blocks owner from admin route with 403 and provides working Dashboard link', () => {
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
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/admin" element={<div>Super Secret Admin Panel</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(html).toContain('403');
      expect(html).toContain('Access restricted');
      expect(html).toContain('You do not have the required permissions to view this section.');
      expect(html).toContain('Return to Dashboard');
      expect(html).toContain('href="/dashboard"');
      expect(html).not.toContain('Super Secret Admin Panel');
    });

    it('allows admin role to access admin-gated routes', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        mockAuthContext({
          status: 'authenticated',
          user: {
            id: 'usr-admin',
            email: 'admin@trustvault.local',
            displayName: 'Admin User',
            role: 'admin',
            isActive: true,
            companyId: null,
            companyName: null,
          },
        }),
      );

      const html = renderToString(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/admin" element={<div>Super Secret Admin Panel</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(html).toContain('Super Secret Admin Panel');
      expect(html).not.toContain('403');
    });
  });
});
