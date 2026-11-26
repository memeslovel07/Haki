import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import {
  ChangeTeamMemberRoleRequestSchema, CreateTeamRequestSchema, InviteTeamMemberRequestSchema,
  RespondTeamInvitationRequestSchema, TransferTeamOwnershipRequestSchema, UpdateTeamSettingsRequestSchema,
} from "@haki/schemas";

const DEFAULT_SETTINGS = { defaultBranch: "main", requireReviews: true, requiredApprovals: 1 };
type Role = "OWNER" | "ADMIN" | "DEVELOPER" | "REVIEWER";
function fail(res: Response, status: number, code: string, message: string) { return res.status(status).json({ success: false, error: { code, message } }); }
function parseFail(res: Response) { return fail(res, 400, "VALIDATION_ERROR", "Invalid request data."); }
function teamIdOf(req: AuthenticatedRequest) { return typeof req.params.teamId === "string" ? req.params.teamId : ""; }
async function membership(teamId: string, userId: string) { return prisma.teamMember.findFirst({ where: { teamId, userId, status: "ACTIVE" } }); }
async function allowed(teamId: string, userId: string, roles: Role[]) { const m = await membership(teamId, userId); return !!m && roles.includes(m.role); }
function slugify(name: string) { return name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 84) || "team"; }

export async function createTeam(req: AuthenticatedRequest, res: Response) {
  if (!req.userId) return fail(res, 401, "UNAUTHORIZED", "Authentication required.");
  const parsed = CreateTeamRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const slug = `${slugify(parsed.data.name)}-${randomUUID().slice(0, 8)}`;
  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({ data: { name: parsed.data.name, slug }, select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } });
    await tx.teamMember.create({ data: { teamId: created.id, userId: req.userId!, role: "OWNER", status: "ACTIVE" } });
    await tx.teamSettings.create({ data: { teamId: created.id, config: DEFAULT_SETTINGS } });
    await tx.auditEvent.create({ data: { teamId: created.id, actorId: req.userId!, action: "team.created", entityType: "Team", entityId: created.id } });
    return created;
  });
  return res.status(201).json({ success: true, data: { ...team, settings: DEFAULT_SETTINGS, members: [{ userId: req.userId, role: "OWNER", status: "ACTIVE" }] } });
}

export async function listMyTeams(req: AuthenticatedRequest, res: Response) {
  const teams = await prisma.team.findMany({ where: { members: { some: { userId: req.userId, status: "ACTIVE" } } }, orderBy: { name: "asc" }, include: { members: { where: { userId: req.userId, status: "ACTIVE" }, select: { role: true } }, settings: true } });
  return res.json({ success: true, data: teams.map(({ members, settings, ...team }) => ({ ...team, role: members[0]?.role, settings: settings?.config ?? DEFAULT_SETTINGS })) });
}

export async function getTeam(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); if (!req.userId || !await membership(teamId, req.userId)) return fail(res, 403, "FORBIDDEN", "Active team membership is required.");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { settings: true, _count: { select: { members: { where: { status: "ACTIVE" } } } } } });
  if (!team) return fail(res, 404, "NOT_FOUND", "Team not found.");
  return res.json({ success: true, data: { id: team.id, name: team.name, slug: team.slug, createdAt: team.createdAt, updatedAt: team.updatedAt, memberCount: team._count.members, settings: team.settings?.config ?? DEFAULT_SETTINGS } });
}

export async function listMembers(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); if (!req.userId || !await membership(teamId, req.userId)) return fail(res, 403, "FORBIDDEN", "Active team membership is required.");
  const members = await prisma.teamMember.findMany({ where: { teamId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: { select: { id: true, email: true, name: true } } } });
  return res.json({ success: true, data: members.map((m) => ({ userId: m.user.id, email: m.user.email, name: m.user.name, role: m.role, status: m.status, createdAt: m.createdAt })) });
}

export async function inviteMember(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); if (!req.userId) return fail(res, 401, "UNAUTHORIZED", "Authentication required.");
  const parsed = InviteTeamMemberRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const actor = await membership(teamId, req.userId); if (!actor || !["OWNER", "ADMIN"].includes(actor.role)) return fail(res, 403, "FORBIDDEN", "Owner or admin access is required.");
  const invitee = await prisma.user.findFirst({ where: { email: parsed.data.email, deletedAt: null }, select: { id: true } });
  if (!invitee) return fail(res, 404, "USER_NOT_FOUND", "An HAKI account with that email was not found.");
  if (invitee.id === req.userId) return fail(res, 409, "DUPLICATE_INVITATION", "You are already a member of this team.");
  const existingMember = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: invitee.id } } });
  if (existingMember?.status === "ACTIVE") return fail(res, 409, "DUPLICATE_INVITATION", "This user is already an active member.");
  if (actor.role === "ADMIN" && parsed.data.role === "ADMIN") return fail(res, 403, "FORBIDDEN", "Only an owner can invite administrators.");
  const existingInvitation = await prisma.teamInvitation.findUnique({ where: { teamId_email: { teamId, email: parsed.data.email } } });
  if (existingInvitation && existingInvitation.respondedAt === null && existingInvitation.expiresAt > new Date()) return fail(res, 409, "DUPLICATE_INVITATION", "A pending invitation already exists for this email.");
  if (existingMember?.status === "INVITED" && !existingInvitation) return fail(res, 409, "DUPLICATE_INVITATION", "This user already has a pending invitation.");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let invitation;
  try { invitation = await prisma.$transaction(async (tx) => {
    const invite = await tx.teamInvitation.upsert({ where: { teamId_email: { teamId, email: parsed.data.email } }, create: { teamId, email: parsed.data.email, role: parsed.data.role, invitedById: req.userId!, expiresAt }, update: { role: parsed.data.role, invitedById: req.userId!, expiresAt, respondedAt: null } });
    await tx.teamMember.upsert({ where: { teamId_userId: { teamId, userId: invitee.id } }, create: { teamId, userId: invitee.id, role: parsed.data.role, status: "INVITED" }, update: { role: parsed.data.role, status: "INVITED" } });
    await tx.auditEvent.create({ data: { teamId, actorId: req.userId!, action: "team.member.invited", entityType: "TeamInvitation", entityId: invite.id } });
    return invite;
  }); } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return fail(res, 409, "DUPLICATE_INVITATION", "A pending invitation already exists for this email.");
    throw error;
  }
  return res.status(201).json({ success: true, data: invitation });
}

export async function listMyInvitations(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
  if (!user) return fail(res, 401, "UNAUTHORIZED", "Authentication required.");
  const invitations = await prisma.teamInvitation.findMany({ where: { email: user.email, respondedAt: null, expiresAt: { gt: new Date() } }, include: { team: { select: { id: true, name: true, slug: true } }, invitedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  return res.json({ success: true, data: invitations });
}

export async function respondToInvitation(req: AuthenticatedRequest, res: Response) {
  const parsed = RespondTeamInvitationRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const invitationId = typeof req.params.invitationId === "string" ? req.params.invitationId : "";
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
  const invitation = user && await prisma.teamInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.email !== user!.email) return fail(res, 404, "NOT_FOUND", "Invitation not found.");
  if (invitation.respondedAt || invitation.expiresAt <= new Date()) return fail(res, 409, "INVITATION_UNAVAILABLE", "Invitation has already been answered or expired.");
  const updated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.teamInvitation.updateMany({ where: { id: invitation.id, respondedAt: null, expiresAt: { gt: new Date() } }, data: { respondedAt: new Date() } });
    if (consumed.count !== 1) return false;
    await tx.teamMember.upsert({ where: { teamId_userId: { teamId: invitation.teamId, userId: req.userId! } }, create: { teamId: invitation.teamId, userId: req.userId!, status: parsed.data.accept ? "ACTIVE" : "DECLINED", role: invitation.role }, update: { status: parsed.data.accept ? "ACTIVE" : "DECLINED", role: invitation.role } });
    await tx.auditEvent.create({ data: { teamId: invitation.teamId, actorId: req.userId!, action: parsed.data.accept ? "team.invitation.accepted" : "team.invitation.declined", entityType: "TeamInvitation", entityId: invitation.id } });
    return true;
  });
  if (!updated) return fail(res, 409, "INVITATION_UNAVAILABLE", "Invitation has already been answered or expired.");
  return res.json({ success: true, data: { accepted: parsed.data.accept } });
}

async function removeMember(teamId: string, actorId: string, targetId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const [actor, target] = await Promise.all([
      tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: actorId } } }),
      tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: targetId } } }),
    ]);
    if (!actor || actor.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(actor.role)) throw new Error("FORBIDDEN");
    if (!target || target.status !== "ACTIVE") throw new Error("NOT_FOUND");
    if (actor.role === "ADMIN" && ["OWNER", "ADMIN"].includes(target.role)) throw new Error("FORBIDDEN");
    if (target.role === "OWNER") {
      const owners = await tx.teamMember.count({ where: { teamId, role: "OWNER", status: "ACTIVE" } });
      if (owners <= 1) throw new Error("LAST_OWNER");
    }
    await tx.teamMember.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });
    await tx.auditEvent.create({ data: { teamId, actorId, action: "team.member.removed", entityType: "TeamMember", entityId: target.id } });
    return true;
  });
}

export async function removeTeamMember(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); const targetId = typeof req.params.userId === "string" ? req.params.userId : "";
  try { await removeMember(teamId, req.userId!, targetId); return res.json({ success: true, data: { removed: true } }); }
  catch (error) { const msg = error instanceof Error ? error.message : ""; return fail(res, msg === "FORBIDDEN" ? 403 : msg === "LAST_OWNER" ? 409 : 404, msg === "LAST_OWNER" ? "LAST_OWNER" : msg, msg === "LAST_OWNER" ? "Transfer ownership before removing the last active owner." : msg === "FORBIDDEN" ? "You cannot remove this member." : "Member not found."); }
}

export async function leaveTeam(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); const actorId = req.userId!;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const self = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: actorId } } });
    if (!self || self.status !== "ACTIVE") return "NOT_FOUND";
    if (self.role === "OWNER" && await tx.teamMember.count({ where: { teamId, role: "OWNER", status: "ACTIVE" } }) <= 1) return "LAST_OWNER";
    await tx.teamMember.update({ where: { id: self.id }, data: { status: "SUSPENDED" } });
    await tx.auditEvent.create({ data: { teamId, actorId, action: "team.member.left", entityType: "TeamMember", entityId: self.id } });
    return "OK";
  });
  if (result !== "OK") return fail(res, result === "LAST_OWNER" ? 409 : 404, result, result === "LAST_OWNER" ? "Transfer ownership before leaving this team." : "Active membership not found.");
  return res.json({ success: true, data: { left: true } });
}

export async function changeMemberRole(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); const targetId = typeof req.params.userId === "string" ? req.params.userId : "";
  const parsed = ChangeTeamMemberRoleRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const actor = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: req.userId! } } });
    const target = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: targetId } } });
    if (!actor || actor.status !== "ACTIVE" || !target || target.status !== "ACTIVE") return "NOT_FOUND";
    if (actor.role !== "OWNER" && (actor.role !== "ADMIN" || !["DEVELOPER", "REVIEWER"].includes(parsed.data.role) || ["OWNER", "ADMIN"].includes(target.role))) return "FORBIDDEN";
    if (target.role === "OWNER" && parsed.data.role !== "OWNER" && await tx.teamMember.count({ where: { teamId, role: "OWNER", status: "ACTIVE" } }) <= 1) return "LAST_OWNER";
    await tx.teamMember.update({ where: { id: target.id }, data: { role: parsed.data.role } });
    await tx.auditEvent.create({ data: { teamId, actorId: req.userId!, action: "team.member.role_changed", entityType: "TeamMember", entityId: target.id, metadata: { role: parsed.data.role } } });
    return "OK";
  });
  if (result !== "OK") return fail(res, result === "FORBIDDEN" ? 403 : result === "LAST_OWNER" ? 409 : 404, result, result === "LAST_OWNER" ? "Transfer ownership before demoting the last active owner." : "Member or permission not found.");
  return res.json({ success: true, data: { updated: true } });
}

export async function transferOwnership(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); const parsed = TransferTeamOwnershipRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const [actor, target] = await Promise.all([
      tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: req.userId! } } }),
      tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: parsed.data.userId } } }),
    ]);
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "OWNER") return "FORBIDDEN";
    if (!target || target.status !== "ACTIVE") return "TARGET_NOT_FOUND";
    if (actor.userId === target.userId) return "OK";
    await tx.teamMember.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.teamMember.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
    await tx.auditEvent.create({ data: { teamId, actorId: req.userId!, action: "team.ownership.transferred", entityType: "TeamMember", entityId: target.id } });
    return "OK";
  });
  if (result !== "OK") return fail(res, result === "FORBIDDEN" ? 403 : 404, result, "Only the active owner can transfer ownership to an active team member.");
  return res.json({ success: true, data: { transferred: true } });
}

export async function getTeamSettings(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); if (!req.userId || !await membership(teamId, req.userId)) return fail(res, 403, "FORBIDDEN", "Active team membership is required.");
  const row = await prisma.teamSettings.findUnique({ where: { teamId } });
  return res.json({ success: true, data: row?.config ?? DEFAULT_SETTINGS });
}

export async function updateTeamSettings(req: AuthenticatedRequest, res: Response) {
  const teamId = teamIdOf(req); if (!req.userId) return fail(res, 401, "UNAUTHORIZED", "Authentication required.");
  const parsed = UpdateTeamSettingsRequestSchema.safeParse(req.body); if (!parsed.success) return parseFail(res);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const actor = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: req.userId! } } });
    if (!actor || actor.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(actor.role)) return { kind: "FORBIDDEN" as const };
    const current = await tx.teamSettings.findUnique({ where: { teamId } });
    const value = { ...DEFAULT_SETTINGS, ...((current?.config as typeof DEFAULT_SETTINGS | undefined) ?? {}), ...parsed.data };
    const row = await tx.teamSettings.upsert({ where: { teamId }, create: { teamId, config: value }, update: { config: value } });
    await tx.auditEvent.create({ data: { teamId, actorId: req.userId!, action: "team.settings.updated", entityType: "TeamSettings", entityId: teamId } });
    return { kind: "OK" as const, config: row.config };
  });
  if (result.kind !== "OK") return fail(res, 403, "FORBIDDEN", "Owner or admin access is required.");
  return res.json({ success: true, data: result.config });
}
