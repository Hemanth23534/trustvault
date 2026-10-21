export interface InvitationEmailData {
  to: string;
  companyName: string;
  invitedByName: string;
  role: 'admin' | 'editor' | 'viewer';
  inviteUrl: string;
  expiresAt: Date;
}

export function roleDisplay(role: 'admin' | 'editor' | 'viewer'): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

export function formatExpiry(date: Date): string {
  return date.toUTCString();
}

export function renderInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const roleName = roleDisplay(data.role);
  const expiryFormatted = formatExpiry(data.expiresAt);
  const subject = `You're invited to join ${data.companyName} on TrustVault`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #151d30;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 36px 32px;
      box-sizing: border-box;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      border-radius: 8px;
      display: inline-block;
      vertical-align: middle;
      text-align: center;
      line-height: 32px;
      font-weight: 800;
      color: #ffffff;
      font-size: 16px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.02em;
      vertical-align: middle;
      display: inline-block;
      margin-left: 8px;
    }
    h1 {
      margin: 0 0 16px 0;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
    }
    .card {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
    }
    .card-label {
      color: #64748b;
    }
    .card-value {
      color: #f1f5f9;
      font-weight: 600;
    }
    .button-wrap {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    }
    .link-alt {
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
      margin-top: 20px;
    }
    .link-alt a {
      color: #818cf8;
      text-decoration: underline;
    }
    .instructions {
      background-color: rgba(79, 70, 229, 0.08);
      border-left: 3px solid #6366f1;
      padding: 14px 16px;
      border-radius: 0 6px 6px 0;
      margin: 20px 0;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .instructions strong {
      color: #ffffff;
    }
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">
        <span class="brand-mark">&#9670;</span>
        <span class="brand-name">TrustVault</span>
      </div>

      <h1>You're invited to join ${escapeHtml(data.companyName)}</h1>

      <p>
        <strong>${escapeHtml(data.invitedByName)}</strong> has invited you to join the
        <strong>${escapeHtml(data.companyName)}</strong> workspace on TrustVault as an
        <strong>${roleName}</strong>.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="card-label">Workspace</span>
          <span class="card-value">${escapeHtml(data.companyName)}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Invited Role</span>
          <span class="card-value">${roleName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Recipient</span>
          <span class="card-value">${escapeHtml(data.to)}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Expires</span>
          <span class="card-value">${expiryFormatted}</span>
        </div>
      </div>

      <div class="instructions">
        <strong>Getting started:</strong><br>
        &bull; <strong>New to TrustVault?</strong> Click the button below to choose your password and set up your account.<br>
        &bull; <strong>Already have an account?</strong> Sign in with ${escapeHtml(data.to)} to accept the invitation and enter the workspace.
      </div>

      <div class="button-wrap">
        <a href="${data.inviteUrl}" class="button" target="_blank" rel="noopener noreferrer">
          Accept Invitation &amp; Join Workspace
        </a>
      </div>

      <div class="link-alt">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${data.inviteUrl}">${data.inviteUrl}</a>
      </div>

      <div class="footer">
        This invitation was intended for <strong>${escapeHtml(data.to)}</strong>.<br>
        If you were not expecting this invitation, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} TrustVault. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `TrustVault — Workspace Invitation

You're invited to join ${data.companyName} on TrustVault!

${data.invitedByName} has invited you to join the "${data.companyName}" workspace as a ${roleName}.

Invitation Details:
- Workspace: ${data.companyName}
- Assigned Role: ${roleName}
- Recipient Email: ${data.to}
- Expiration Time: ${expiryFormatted}

How to accept:
1. If you don't have a TrustVault account yet, follow the link below to set your password and join.
2. If you already have an account with this email, simply sign in to accept.

Accept invitation link:
${data.inviteUrl}

Note: This invitation was sent to ${data.to}. If you were not expecting this invitation, you can safely ignore this email.

— TrustVault Team
`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
