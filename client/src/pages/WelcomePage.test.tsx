import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../context/AuthContext';
import * as AuthContextModule from '../context/AuthContext';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage - 3D Animated Welcome Experience', () => {
  const mockAuthContext = (overrides: Partial<AuthContextValue>): AuthContextValue => ({
    status: 'anonymous',
    user: null,
    session: null,
    csrfToken: null,
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the cinematic welcome experience with required title, tagline, logo, and Enter button', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      mockAuthContext({ status: 'anonymous' }),
    );

    const html = renderToString(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    // 1. Logo and Brand
    expect(html).toContain('TrustVault');
    expect(html).toContain('v2.4 Enterprise');
    expect(html).toContain('class="brand-mark"');

    // 2. Headings and Tagline
    expect(html).toContain('WELCOME TO');
    expect(html).toContain('TRUSTVAULT');
    expect(html).toContain('Your Documents. Your Control. Your Security.');
    expect(html).toContain('ENTERPRISE ZERO-TRUST SECURITY');

    // 3. Security Feature Pills
    expect(html).toContain('SHA-256 Hash Chain');
    expect(html).toContain('Strict Multi-Tenant Isolation');
    expect(html).toContain('Real-Time Tamper Evidence');

    // 4. Enter TrustVault glowing button
    expect(html).toContain('welcome-enter-btn');
    expect(html).toContain('Enter TrustVault');
    expect(html).toContain('welcome-btn-glow');

    // 5. Skip button and keyboard shortcuts
    expect(html).toContain('Skip to Login');
    expect(html).toContain('welcome-skip-btn');
    expect(html).toContain('Press <kbd class="welcome-kbd">Enter</kbd>');
    expect(html).toContain('<kbd class="welcome-kbd">Esc</kbd>');

    // 6. Registration and Platform Admin links
    expect(html).toContain('href="/register"');
    expect(html).toContain('Create Company Workspace');
    expect(html).toContain('href="/platform-admin/login"');
    expect(html).toContain('Platform Admin Portal');
  });

  it('renders fallback 3D scene elements when WebGL is unavailable in test environment', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      mockAuthContext({ status: 'anonymous' }),
    );

    const html = renderToString(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Fallback scene renders floating document panels and security badges
    expect(html).toContain('welcome-fallback-scene');
    expect(html).toContain('CONFIDENTIAL');
    expect(html).toContain('Audit_Ledger.enc');
    expect(html).toContain('RESTRICTED');
    expect(html).toContain('Security_Policy.pdf');
    expect(html).toContain('SHA-256 Chain');
    expect(html).toContain('Zero-Knowledge');
  });

  it('renders correctly for authenticated users without crashing', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      mockAuthContext({
        status: 'authenticated',
        user: {
          id: 'usr-1',
          email: 'owner@example.com',
          displayName: 'Workspace Owner',
          role: 'owner',
          isActive: true,
          companyId: 'comp-1',
          companyName: 'Acme Corp',
        },
      }),
    );

    const html = renderToString(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('Enter TrustVault');
    expect(html).toContain('WELCOME TO');
  });
});
