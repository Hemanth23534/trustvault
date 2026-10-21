import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../../auth/auth-service.js';
import { requireAuth, requireAuthContext } from '../../auth/middleware.js';
import type { Env } from '../../config/env.js';
import { USER_ROLES } from '../../auth/types.js';

export interface WorkspaceRouterOptions {
  env: Env;
  service: AuthService;
}

const createWorkspaceSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').max(120),
});

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(120).optional(),
  domain: z.string().trim().max(120).nullable().optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
});

const updateRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export function createWorkspaceRouter(options: WorkspaceRouterOptions): Router {
  const { env, service } = options;
  const guard = requireAuth({ service, env });
  const router = Router();

  /** GET /api/workspace/invitations/verify — public verification of an invitation token. */
  router.get('/invitations/verify', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const details = await service.getInvitationDetails(token);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(details);
  });

  /** GET /api/workspace — get current workspace status (company vs personal). */
  router.get('/', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const workspace = await service.getWorkspace(actor);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(workspace);
  });

  /** POST /api/workspace — create a company workspace for a personal user. */
  router.post('/', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const user = await service.createCompanyWorkspace(
      actor,
      { companyName: parsed.data.companyName },
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ user });
  });

  /** PATCH /api/workspace — update company workspace settings (owner only). */
  router.patch('/', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const parsed = updateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const company = await service.updateWorkspaceSettings(
      actor,
      parsed.data,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ company });
  });

  /** GET /api/workspace/members — list all members of the current workspace. */
  router.get('/members', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const members = await service.listWorkspaceMembers(actor);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ members });
  });

  /** POST /api/workspace/invitations — invite a user to the workspace (owner/admin). */
  router.post('/invitations', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const invitation = await service.inviteMember(
      actor,
      parsed.data,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ invitation });
  });

  /** GET /api/workspace/invitations — list pending invitations (owner/admin). */
  router.get('/invitations', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const invitations = await service.listWorkspaceInvitations(actor);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ invitations });
  });

  /** DELETE /api/workspace/invitations/:id — revoke an invitation (owner/admin). */
  router.delete('/invitations/:id', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const id = String(req.params.id);
    await service.revokeInvitation(
      actor,
      id,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );
    res.status(204).end();
  });

  /** POST /api/workspace/invitations/accept — accept an invitation token. */
  router.post('/invitations/accept', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const user = await service.acceptInvitation(
      actor,
      parsed.data.token,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ user });
  });

  /** DELETE /api/workspace/members/:userId — remove a member from the workspace (owner/admin). */
  router.delete('/members/:userId', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const targetUserId = String(req.params.userId);
    await service.removeMember(
      actor,
      targetUserId,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );
    res.status(204).end();
  });

  /** PATCH /api/workspace/members/:userId/role — update a member's role (owner only). */
  router.patch('/members/:userId/role', guard, async (req, res) => {
    const actor = requireAuthContext(req).user;
    const targetUserId = String(req.params.userId);
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await service.updateMemberRole(
      actor,
      targetUserId,
      parsed.data.role,
      { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id },
    );

    res.status(204).end();
  });

  return router;
}
