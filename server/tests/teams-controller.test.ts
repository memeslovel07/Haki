import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMembership, findMany, findUnique, upsert, update, remove, findUser } = vi.hoisted(() => ({
  findMembership: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), remove: vi.fn(), findUser: vi.fn(),
}));
vi.mock("../src/lib/prisma.js", () => ({ prisma: {
  teamMember: { findFirst: findMembership, findMany, findUnique, upsert, update, delete: remove },
  user: { findFirst: findUser },
} }));

import { addTeamMember, listMyTeams, removeTeamMember, updateTeamMemberRole } from "../src/modules/teams/teams.controller.js";

function response() {
  const result: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
    send() { return this; },
  };
  return { res, result };
}

const teamId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";

describe("team member management", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("lists only the signed-in user's active team memberships", async () => {
    findMany.mockResolvedValue([{ role: "OWNER", team: { id: teamId, name: "Core", slug: "core", _count: { members: 3 } } }]);
    const { res, result } = response();

    await listMyTeams({ userId: "owner-id" } as never, res as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner-id", status: "ACTIVE" } }));
    expect(result.body).toEqual({ success: true, data: [{ id: teamId, name: "Core", slug: "core", _count: { members: 3 }, role: "OWNER", memberCount: 3 }] });
  });

  it("lets an owner add an existing HAKI user with a supported role", async () => {
    findMembership.mockResolvedValue({ role: "OWNER" });
    findUser.mockResolvedValue({ id: "member-user" });
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({ id: memberId });
    const { res, result } = response();

    await addTeamMember({ userId: "owner-id", params: { teamId }, body: { email: "new.member@example.com", role: "REVIEWER" } } as never, res as never);

    expect(findUser).toHaveBeenCalledWith({ where: { email: "new.member@example.com", deletedAt: null }, select: { id: true } });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { teamId, userId: "member-user", role: "REVIEWER", status: "ACTIVE" } }));
    expect(result.statusCode).toBe(201);
  });

  it("prevents an admin from granting the admin role", async () => {
    findMembership.mockResolvedValue({ role: "ADMIN" });
    const { res, result } = response();

    await addTeamMember({ userId: "admin-id", params: { teamId }, body: { email: "member@example.com", role: "ADMIN" } } as never, res as never);

    expect(result.statusCode).toBe(403);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("protects the owner from role changes and removal", async () => {
    findMembership.mockResolvedValue({ role: "OWNER" });
    findUnique.mockResolvedValue({ id: memberId, role: "OWNER" });
    const roleResponse = response();
    await updateTeamMemberRole({ userId: "owner-id", params: { teamId, memberId }, body: { role: "REVIEWER" } } as never, roleResponse.res as never);
    expect(roleResponse.result.statusCode).toBe(404);
    expect(update).not.toHaveBeenCalled();

    const removeResponse = response();
    await removeTeamMember({ userId: "owner-id", params: { teamId, memberId } } as never, removeResponse.res as never);
    expect(removeResponse.result.statusCode).toBe(404);
    expect(remove).not.toHaveBeenCalled();
  });
});
