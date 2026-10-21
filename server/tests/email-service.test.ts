import { describe, expect, it } from 'vitest';
import {
  formatExpiry,
  renderInvitationEmail,
  roleDisplay,
} from '../src/email/invitation-template.js';
import {
  ConsoleEmailService,
  createEmailService,
  ResendEmailService,
} from '../src/email/email-service.js';
import { testEnv } from './support/test-env.js';

describe('Invitation Email Template', () => {
  it('formats role display correctly for all user roles', () => {
    expect(roleDisplay('admin')).toBe('Administrator');
    expect(roleDisplay('editor')).toBe('Editor');
    expect(roleDisplay('viewer')).toBe('Viewer');
  });

  it('formats expiration date as UTC string', () => {
    const date = new Date('2026-10-28T12:00:00.000Z');
    expect(formatExpiry(date)).toBe('Wed, 28 Oct 2026 12:00:00 GMT');
  });

  it('renders responsive HTML and plain-text invitation emails with all required details', () => {
    const data = {
      to: 'employee@example.com',
      companyName: 'Acme Corp',
      invitedByName: 'Alice Founder',
      role: 'editor' as const,
      inviteUrl: 'https://trustvault-app-1i2l.onrender.com/register?invite=sample-secure-token-123',
      expiresAt: new Date('2026-10-28T15:30:00.000Z'),
    };

    const { subject, html, text } = renderInvitationEmail(data);

    // Subject
    expect(subject).toBe("You're invited to join Acme Corp on TrustVault");

    // HTML assertions
    expect(html).toContain('TrustVault');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Alice Founder');
    expect(html).toContain('Editor');
    expect(html).toContain('employee@example.com');
    expect(html).toContain(data.inviteUrl);
    expect(html).toContain('Wed, 28 Oct 2026 15:30:00 GMT');
    expect(html).toContain('Accept Invitation &amp; Join Workspace');

    // Plain text assertions
    expect(text).toContain('TrustVault — Workspace Invitation');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Alice Founder');
    expect(text).toContain('Editor');
    expect(text).toContain('employee@example.com');
    expect(text).toContain(data.inviteUrl);
    expect(text).toContain('Wed, 28 Oct 2026 15:30:00 GMT');
  });

  it('escapes HTML special characters in company name and inviter name to prevent XSS in email clients', () => {
    const data = {
      to: 'safety@example.com',
      companyName: '<script>alert("hack")</script> & "Co"',
      invitedByName: 'Mallory <tag>',
      role: 'viewer' as const,
      inviteUrl: 'https://trustvault.example.com/register?invite=token',
      expiresAt: new Date('2026-10-28T12:00:00.000Z'),
    };

    const { html, text } = renderInvitationEmail(data);

    // HTML should escape angle brackets and quotes
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt; &amp; &quot;Co&quot;');
    expect(html).toContain('Mallory &lt;tag&gt;');

    // Plain text preserves raw names
    expect(text).toContain('<script>alert("hack")</script> & "Co"');
    expect(text).toContain('Mallory <tag>');
  });
});

describe('Email Service Factory and Implementations', () => {
  it('returns ConsoleEmailService when resendApiKey is empty or not configured', () => {
    const env = testEnv({
      RESEND_API_KEY: '',
    });

    const service = createEmailService(env);
    expect(service).toBeInstanceOf(ConsoleEmailService);
  });

  it('returns ResendEmailService when resendApiKey is set', () => {
    const env = testEnv({
      RESEND_API_KEY: 're_mock_test_key_12345',
    });

    const service = createEmailService(env);
    expect(service).toBeInstanceOf(ResendEmailService);
  });

  it('ConsoleEmailService successfully simulates sending without errors', async () => {
    const service = new ConsoleEmailService();
    const result = await service.sendInvitationEmail({
      to: 'dev@example.local',
      companyName: 'Local Dev Co',
      invitedByName: 'Dev Admin',
      role: 'viewer',
      inviteUrl: 'http://localhost:5173/register?invite=dev-token',
      expiresAt: new Date(Date.now() + 86400000),
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toMatch(/^simulated-/);
  });
});
