import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { InMemoryAuthStore } from './support/in-memory-auth-store.js';
import { InMemoryDocumentActivityStore } from './support/in-memory-activity-store.js';
import { InMemoryDocumentStore } from './support/in-memory-document-store.js';
import { InMemoryDocumentStorage } from '../src/documents/storage.js';
import { testEnv, testLogger } from './support/test-env.js';

function buildStack() {
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
});
