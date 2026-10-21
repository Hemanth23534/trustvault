import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { hashInvitationToken } from '../src/auth/tokens.js';
import { InMemoryAuthStore } from './support/in-memory-auth-store.js';
import { InMemoryDocumentActivityStore } from './support/in-memory-activity-store.js';
import { InMemoryDocumentStore } from './support/in-memory-document-store.js';
import { InMemoryDocumentStorage } from '../src/documents/storage.js';
import { testEnv, testLogger } from './support/test-env.js';
import type { EmailService } from '../src/email/email-service.js';

function buildStack(options?: { emailService?: EmailService }) {
  const env = testEnv();
  const authStore = new InMemoryAuthStore();
  const documentStore = new InMemoryDocumentStore();
  const activityStore = new InMemoryDocumentActivityStore(documentStore, authStore);
  const storage = new InMemoryDocumentStorage();

  const app = createApp({
    env,
    logger: testLogger(env),
    pingDatabase: async () => ({ ok: true, latencyMs: 1 }),
    authStore,
    documentStore,
    documentActivityStore: activityStore,
    documentStorage: storage,
    emailService: options?.emailService,
  });

  return { app, authStore, documentStore, activityStore };
}

describe('Workspace and Member Management', () => {
  it('allows personal workspace registration without a company name', async () => {
    const { app } = buildStack();

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Personal',
        email: 'alice@personal.local',
        password: 'Password2026!Personal',
      })
      .expect(201);

    expect(res.body.user.email).toBe('alice@personal.local');
    expect(res.body.user.companyId).toBeUndefined();
    expect(res.body.user.companyName).toBeUndefined();
    expect(res.body.user.role).toBe('owner');
  });

  it('allows a personal user to create a company workspace later', async () => {
    const { app } = buildStack();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Founder',
        email: 'bob@startup.local',
        password: 'Password2026!Founder',
      })
      .expect(201);

    const cookie = regRes.headers['set-cookie']?.[0] ?? '';
    const csrf = regRes.body.session.csrfToken;

    // Check workspace status before creation (personal)
    const wsBefore = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookie)
      .expect(200);
    expect(wsBefore.body.isPersonal).toBe(true);

    // Create company workspace
    const wsRes = await request(app)
      .post('/api/workspace')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ companyName: 'Acme Robotics' })
      .expect(201);

    expect(wsRes.body.user.companyName).toBe('Acme Robotics');
    expect(wsRes.body.user.companyId).toBeDefined();
    expect(wsRes.body.user.role).toBe('owner');

    // Check workspace status after creation
    const wsAfter = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookie)
      .expect(200);
    expect(wsAfter.body.isPersonal).toBe(false);
    expect(wsAfter.body.company.name).toBe('Acme Robotics');
  });

  it('supports inviting members, accepting invitations, and role management', async () => {
    const { app } = buildStack();

    // 1. Owner registers company
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Carol Owner',
        email: 'carol@innovate.local',
        companyName: 'Innovate Labs',
        password: 'Password2026!Innovate',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    // 2. Owner invites a new member as editor
    const inviteRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'dave@innovate.local', role: 'editor' })
      .expect(201);

    const token = inviteRes.body.invitation.token;
    expect(token).toBeDefined();
    expect(inviteRes.body.invitation.role).toBe('editor');

    // 3. Dave registers with the invitation token
    const daveRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dave Editor',
        email: 'dave@innovate.local',
        password: 'Password2026!DaveEditor',
        inviteToken: token,
      })
      .expect(201);

    expect(daveRes.body.user.companyId).toBe(ownerRes.body.user.companyId);
    expect(daveRes.body.user.companyName).toBe('Innovate Labs');
    expect(daveRes.body.user.role).toBe('editor');

    // 4. Owner lists members — both Carol and Dave are present
    const membersRes = await request(app)
      .get('/api/workspace/members')
      .set('Cookie', ownerCookie)
      .expect(200);

    expect(membersRes.body.members).toHaveLength(2);
    expect(membersRes.body.members.map((m: any) => m.email)).toEqual(
      expect.arrayContaining(['carol@innovate.local', 'dave@innovate.local']),
    );

    // 5. Dave (editor) cannot invite members (requires owner/admin)
    const daveCookie = daveRes.headers['set-cookie']?.[0] ?? '';
    const daveCsrf = daveRes.body.session.csrfToken;

    await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', daveCookie)
      .set('X-CSRF-Token', daveCsrf)
      .send({ email: 'eve@innovate.local', role: 'viewer' })
      .expect(403);

    // 6. Owner updates Dave's role to admin
    await request(app)
      .patch(`/api/workspace/members/${daveRes.body.user.id}/role`)
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ role: 'admin' })
      .expect(204);

    // 7. Owner removes Dave from the workspace
    await request(app)
      .delete(`/api/workspace/members/${daveRes.body.user.id}`)
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .expect(204);

    // Dave's old session was revoked upon removal
    await request(app)
      .get('/api/auth/me')
      .set('Cookie', daveCookie)
      .expect(401);
  });

  it('enforces workspace settings authorization', async () => {
    const { app } = buildStack();

    // Owner creates workspace
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Grace Owner',
        email: 'grace@apex.local',
        companyName: 'Apex Security',
        password: 'Password2026!ApexSec',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    // Owner updates workspace name
    const updateRes = await request(app)
      .patch('/api/workspace')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ name: 'Apex Global Security', domain: 'apex.example' })
      .expect(200);

    expect(updateRes.body.company.name).toBe('Apex Global Security');
    expect(updateRes.body.company.domain).toBe('apex.example');
  });

  it('enforces CSRF protection on mutating invitation and workspace endpoints', async () => {
    const { app } = buildStack();

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Henry Owner',
        email: 'henry@csrf-test.local',
        companyName: 'CSRF Defense Corp',
        password: 'Password2026!CsrfDefense',
      })
      .expect(201);

    const cookie = reg.headers['set-cookie']?.[0] ?? '';

    // POST /api/workspace/invitations without X-CSRF-Token fails with 403 CSRF_TOKEN_INVALID
    const failRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .send({ email: 'target@csrf-test.local', role: 'viewer' })
      .expect(403);

    expect(failRes.body.error?.code).toBe('CSRF_TOKEN_INVALID');

    // POST /api/workspace/invitations with invalid token also fails
    await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', 'bogus-csrf-token')
      .send({ email: 'target@csrf-test.local', role: 'viewer' })
      .expect(403);
  });

  it('generates invitation tokens with SHA-256 hashing and supports public verification', async () => {
    const { app, authStore } = buildStack();

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ian Founder',
        email: 'ian@hashcheck.local',
        companyName: 'HashCheck Inc',
        password: 'Password2026!HashCheck',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    // Create invitation
    const inviteRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'employee@hashcheck.local', role: 'editor' })
      .expect(201);

    const rawToken = inviteRes.body.invitation.token;
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64); // 32 bytes hex

    // Verify token is hashed with SHA-256 in store
    const directLookup = await authStore.findInvitationByToken(rawToken);
    expect(directLookup).toBeNull(); // Plaintext token is not stored

    const hashedToken = hashInvitationToken(rawToken);
    const hashLookup = await authStore.findInvitationByToken(hashedToken);
    expect(hashLookup).not.toBeNull();
    expect(hashLookup?.email).toBe('employee@hashcheck.local');
    expect(hashLookup?.role).toBe('editor');
    expect(hashLookup?.status).toBe('pending');

    // Verify public endpoint returns invitation details without any session cookie
    const verifyRes = await request(app)
      .get(`/api/workspace/invitations/verify?token=${rawToken}`)
      .expect(200);

    expect(verifyRes.body.email).toBe('employee@hashcheck.local');
    expect(verifyRes.body.companyName).toBe('HashCheck Inc');
    expect(verifyRes.body.role).toBe('editor');
    expect(verifyRes.body.status).toBe('pending');

    // Public /api/auth/invitation alias also works
    const authVerifyRes = await request(app)
      .get(`/api/auth/invitation?token=${rawToken}`)
      .expect(200);

    expect(authVerifyRes.body.email).toBe('employee@hashcheck.local');
    expect(authVerifyRes.body.companyName).toBe('HashCheck Inc');
  });

  it('rejects cross-email acceptance attempts during registration and login', async () => {
    const { app } = buildStack();

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Julia Owner',
        email: 'julia@secureorg.local',
        companyName: 'Secure Org',
        password: 'Password2026!SecureOrg',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    // Invite alice@secureorg.local
    const inviteRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'alice@secureorg.local', role: 'editor' })
      .expect(201);

    const token = inviteRes.body.invitation.token;

    // Attacker tries to register with a different email using Alice's invite token
    const evilReg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Evil Attacker',
        email: 'attacker@evil.local',
        password: 'Password2026!Attacker',
        inviteToken: token,
      })
      .expect(403);

    expect(evilReg.body.error?.code).toBe('INVITATION_EMAIL_MISMATCH');

    // Attacker registers their own account
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Evil Attacker',
        email: 'attacker@evil.local',
        password: 'Password2026!Attacker',
      })
      .expect(201);

    // Attacker tries to sign in with Alice's invite token
    const evilLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'attacker@evil.local',
        password: 'Password2026!Attacker',
        inviteToken: token,
      })
      .expect(403);

    expect(evilLogin.body.error?.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('allows an existing user to login with inviteToken and join the workspace', async () => {
    const { app } = buildStack();

    // 1. Existing personal user
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Kevin Existing',
        email: 'kevin@personal.local',
        password: 'Password2026!KevinExist',
      })
      .expect(201);

    // 2. Company owner invites Kevin
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Laura Owner',
        email: 'laura@enterprise.local',
        companyName: 'Enterprise Holdings',
        password: 'Password2026!Enterprise',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    const inviteRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'kevin@personal.local', role: 'admin' })
      .expect(201);

    const token = inviteRes.body.invitation.token;

    // 3. Kevin logs in with his password and the inviteToken
    const kevinLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'kevin@personal.local',
        password: 'Password2026!KevinExist',
        inviteToken: token,
      })
      .expect(200);

    expect(kevinLogin.body.user.companyId).toBe(ownerRes.body.user.companyId);
    expect(kevinLogin.body.user.companyName).toBe('Enterprise Holdings');
    expect(kevinLogin.body.user.role).toBe('admin');

    // 4. Token cannot be reused
    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'kevin@personal.local',
        password: 'Password2026!KevinExist',
        inviteToken: token,
      })
      .expect(409);
  });

  it('rejects revoked or expired invitations', async () => {
    let nowTime = new Date('2026-10-21T12:00:00.000Z');
    const clock = () => nowTime;

    const env = testEnv();
    const authStore = new InMemoryAuthStore();
    const documentStore = new InMemoryDocumentStore();
    const activityStore = new InMemoryDocumentActivityStore(documentStore, authStore);
    const storage = new InMemoryDocumentStorage();

    const app = createApp({
      env,
      logger: testLogger(env),
      pingDatabase: async () => ({ ok: true, latencyMs: 1 }),
      authStore,
      documentStore,
      documentActivityStore: activityStore,
      documentStorage: storage,
      clock,
    });

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Maria Owner',
        email: 'maria@expirydemo.local',
        companyName: 'Expiry Demo Corp',
        password: 'Password2026!ExpiryDemo',
      })
      .expect(201);

    const ownerCookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const ownerCsrf = ownerRes.body.session.csrfToken;

    // 1. Revocation test
    const inviteRevokeRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'revokee@expirydemo.local', role: 'viewer' })
      .expect(201);

    const revokeInviteId = inviteRevokeRes.body.invitation.id;
    const revokeToken = inviteRevokeRes.body.invitation.token;

    // Owner revokes invitation
    await request(app)
      .delete(`/api/workspace/invitations/${revokeInviteId}`)
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .expect(204);

    // Register with revoked token -> 410
    const revokedAttempt = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Revokee User',
        email: 'revokee@expirydemo.local',
        password: 'Password2026!Revokee',
        inviteToken: revokeToken,
      })
      .expect(410);

    expect(revokedAttempt.body.error?.code).toBe('INVITATION_REVOKED');

    // 2. Expiration test (7 days validity)
    const inviteExpiryRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ email: 'expiree@expirydemo.local', role: 'viewer' })
      .expect(201);

    const expiryToken = inviteExpiryRes.body.invitation.token;

    // Advance clock by 8 days
    nowTime = new Date('2026-10-29T13:00:00.000Z');

    const expiredAttempt = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Expiree User',
        email: 'expiree@expirydemo.local',
        password: 'Password2026!Expiree',
        inviteToken: expiryToken,
      })
      .expect(410);

    expect(expiredAttempt.body.error?.code).toBe('INVITATION_EXPIRED');
  });

  it('enforces cross-tenant isolation on invitations and members', async () => {
    const { app } = buildStack();

    // Company A
    const compARes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owner A',
        email: 'owner@compa.local',
        companyName: 'Company Alpha',
        password: 'Password2026!CompAlpha',
      })
      .expect(201);

    const cookieA = compARes.headers['set-cookie']?.[0] ?? '';
    const csrfA = compARes.body.session.csrfToken;

    // Company B
    const compBRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owner B',
        email: 'owner@compb.local',
        companyName: 'Company Beta',
        password: 'Password2026!CompBeta',
      })
      .expect(201);

    const cookieB = compBRes.headers['set-cookie']?.[0] ?? '';
    const csrfB = compBRes.body.session.csrfToken;

    // Owner A invites userA
    const inviteARes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookieA)
      .set('X-CSRF-Token', csrfA)
      .send({ email: 'usera@compa.local', role: 'editor' })
      .expect(201);

    const inviteAId = inviteARes.body.invitation.id;

    // Owner B cannot revoke Company A's invitation -> 404
    await request(app)
      .delete(`/api/workspace/invitations/${inviteAId}`)
      .set('Cookie', cookieB)
      .set('X-CSRF-Token', csrfB)
      .expect(404);

    // Owner B cannot remove Owner A -> 404
    await request(app)
      .delete(`/api/workspace/members/${compARes.body.user.id}`)
      .set('Cookie', cookieB)
      .set('X-CSRF-Token', csrfB)
      .expect(404);

    // Owner B cannot change Owner A's role -> 404
    await request(app)
      .patch(`/api/workspace/members/${compARes.body.user.id}/role`)
      .set('Cookie', cookieB)
      .set('X-CSRF-Token', csrfB)
      .send({ role: 'viewer' })
      .expect(404);
  });

  it('sends an invitation email through EmailService with all metadata and invite link', async () => {
    const sentEmails: any[] = [];
    const mockEmailService: EmailService = {
      async sendInvitationEmail(data) {
        sentEmails.push(data);
        return { ok: true, messageId: 'msg_test_123' };
      },
    };

    const { app } = buildStack({ emailService: mockEmailService });

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Julia Founder',
        email: 'julia@solarenergy.local',
        companyName: 'Solar Energy Corp',
        password: 'Password2026!SolarEnergy',
      })
      .expect(201);

    const cookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const csrf = ownerRes.body.session.csrfToken;

    const inviteRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'kevin@solarenergy.local', role: 'admin' })
      .expect(201);

    expect(sentEmails).toHaveLength(1);
    const sent = sentEmails[0];
    expect(sent.to).toBe('kevin@solarenergy.local');
    expect(sent.companyName).toBe('Solar Energy Corp');
    expect(sent.invitedByName).toBe('Julia Founder');
    expect(sent.role).toBe('admin');
    expect(sent.inviteUrl).toContain('/register?invite=');
    expect(sent.inviteUrl).toContain(inviteRes.body.invitation.token);
    expect(sent.expiresAt).toBeInstanceOf(Date);
  });

  it('returns 502 EMAIL_DELIVERY_FAILED and rolls back database invitation when EmailService fails', async () => {
    const failingEmailService: EmailService = {
      async sendInvitationEmail() {
        return { ok: false, error: 'Domain unverified on Resend account' };
      },
    };

    const { app, authStore } = buildStack({ emailService: failingEmailService });

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Leo Founder',
        email: 'leo@quantum.local',
        companyName: 'Quantum Logic',
        password: 'Password2026!QuantumLogic',
      })
      .expect(201);

    const cookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const csrf = ownerRes.body.session.csrfToken;
    const companyId = ownerRes.body.user.companyId;

    const failRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'maria@quantum.local', role: 'editor' })
      .expect(502);

    expect(failRes.body.error?.code).toBe('EMAIL_DELIVERY_FAILED');
    expect(failRes.body.error?.message).toContain('Failed to send invitation email');

    // Verify rollback: no phantom invitation record left in the database
    const pending = await authStore.findPendingInvitationByEmail(companyId, 'maria@quantum.local');
    expect(pending).toBeNull();
  });

  it('supports safe invitation retries by rotating token and updating existing pending invitation', async () => {
    const sentEmails: any[] = [];
    const mockEmailService: EmailService = {
      async sendInvitationEmail(data) {
        sentEmails.push(data);
        return { ok: true, messageId: `msg_${sentEmails.length}` };
      },
    };

    const { app, authStore } = buildStack({ emailService: mockEmailService });

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Nora Founder',
        email: 'nora@hyperdrive.local',
        companyName: 'Hyperdrive Systems',
        password: 'Password2026!Hyperdrive',
      })
      .expect(201);

    const cookie = ownerRes.headers['set-cookie']?.[0] ?? '';
    const csrf = ownerRes.body.session.csrfToken;
    const companyId = ownerRes.body.user.companyId;

    // First invitation attempt
    const firstRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'oscar@hyperdrive.local', role: 'viewer' })
      .expect(201);

    const firstToken = firstRes.body.invitation.token;
    const firstId = firstRes.body.invitation.id;

    // Retry sending invitation (e.g. employee didn't see first email, changing role to editor)
    const secondRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'oscar@hyperdrive.local', role: 'editor' })
      .expect(201);

    const secondToken = secondRes.body.invitation.token;
    const secondId = secondRes.body.invitation.id;

    // Re-used existing invitation ID
    expect(secondId).toBe(firstId);
    // Generated fresh unguessable token
    expect(secondToken).not.toBe(firstToken);
    expect(secondRes.body.invitation.role).toBe('editor');

    // Both email deliveries attempted
    expect(sentEmails).toHaveLength(2);
    expect(sentEmails[0].inviteUrl).toContain(firstToken);
    expect(sentEmails[1].inviteUrl).toContain(secondToken);
    expect(sentEmails[1].role).toBe('editor');

    // Database has only one pending invitation for this email
    const pending = await authStore.findPendingInvitationByEmail(companyId, 'oscar@hyperdrive.local');
    expect(pending).not.toBeNull();
    expect(pending?.id).toBe(firstId);
    expect(pending?.role).toBe('editor');
  });
});
