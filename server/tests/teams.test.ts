import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";

const users = Array.from({ length: 3 }, (_, i) => ({ email: `teams-${i}-${randomUUID()}@example.test`, name: `Team Test ${i}` }));
const tokens: string[] = [];
const createdTeamIds = new Set<string>();
const createdUserIds = new Set<string>();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Teams: lifecycle, roles, and isolation", () => {
  beforeAll(async () => {
    for (const user of users) {
      const created = await prisma.user.create({ data: user });
      createdUserIds.add(created.id);
      tokens.push(await createAccessToken(created.id));
    }
  }, 120_000);

  afterAll(async () => {
    if (createdTeamIds.size) {
      await prisma.auditEvent.deleteMany({ where: { teamId: { in: [...createdTeamIds] } } });
      await prisma.team.deleteMany({ where: { id: { in: [...createdTeamIds] } } });
    }
    if (createdUserIds.size) await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    await prisma.$disconnect();
  }, 120_000);

  it("creates teams, enforces roles and isolation, handles invitations, and preserves an active owner", async () => {
    const created = await request(app).post("/api/v1/teams").set(auth(tokens[0])).send({ name: "First Team" }).expect(201);
    const teamId = created.body.data.id as string;
    createdTeamIds.add(teamId);
    expect(created.body.data.members[0].role).toBe("OWNER");
    expect(created.body.data.settings).toEqual({ defaultBranch: "main", requireReviews: true, requiredApprovals: 1 });

    const other = await request(app).post("/api/v1/teams").set(auth(tokens[2])).send({ name: "Other Team" }).expect(201);
    createdTeamIds.add(other.body.data.id);
    await request(app).get(`/api/v1/teams/${teamId}`).set(auth(tokens[2])).expect(403);
    await request(app).get(`/api/v1/teams/${teamId}/members`).set(auth(tokens[1])).expect(403);

    const invite = await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[0])).send({ email: users[1].email, role: "DEVELOPER" }).expect(201);
    await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[0])).send({ email: users[1].email, role: "DEVELOPER" }).expect(409);
    await request(app).get("/api/v1/teams/invitations").set(auth(tokens[1])).expect(200).expect((response) => expect(response.body.data).toHaveLength(1));
    await request(app).post(`/api/v1/teams/invitations/${invite.body.data.id}/respond`).set(auth(tokens[1])).send({ accept: true }).expect(200);

    await request(app).post(`/api/v1/teams/${teamId}/leave`).set(auth(tokens[0])).expect(409);
    await request(app).post(`/api/v1/teams/${teamId}/ownership`).set(auth(tokens[0])).send({ userId: "invalid" }).expect(400);
    await request(app).post(`/api/v1/teams/${teamId}/ownership`).set(auth(tokens[0])).send({ userId: (await prisma.user.findUniqueOrThrow({ where: { email: users[1].email } })).id }).expect(200);
    const members = await request(app).get(`/api/v1/teams/${teamId}/members`).set(auth(tokens[1])).expect(200);
    expect(members.body.data.find((member: { email: string }) => member.email === users[1].email).role).toBe("OWNER");
    await request(app).post(`/api/v1/teams/${teamId}/leave`).set(auth(tokens[0])).expect(200);

    const secondInvite = await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[1])).send({ email: users[2].email, role: "REVIEWER" }).expect(201);
    await request(app).post(`/api/v1/teams/invitations/${secondInvite.body.data.id}/respond`).set(auth(tokens[2])).send({ accept: false }).expect(200);
    const thirdInvite = await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[1])).send({ email: users[2].email, role: "DEVELOPER" }).expect(201);
    await request(app).post(`/api/v1/teams/invitations/${thirdInvite.body.data.id}/respond`).set(auth(tokens[2])).send({ accept: true }).expect(200);
    await request(app).delete(`/api/v1/teams/${teamId}/members/${(await prisma.user.findUniqueOrThrow({ where: { email: users[2].email } })).id}`).set(auth(tokens[1])).expect(200);

    const adminInvite = await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[1])).send({ email: users[2].email, role: "ADMIN" }).expect(201);
    await request(app).post(`/api/v1/teams/invitations/${adminInvite.body.data.id}/respond`).set(auth(tokens[2])).send({ accept: true }).expect(200);
    await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[2])).send({ email: users[0].email, role: "ADMIN" }).expect(403);
    const restoredInvite = await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[2])).send({ email: users[0].email, role: "DEVELOPER" }).expect(201);
    await request(app).post(`/api/v1/teams/invitations/${restoredInvite.body.data.id}/respond`).set(auth(tokens[0])).send({ accept: true }).expect(200);
    const firstUserId = (await prisma.user.findUniqueOrThrow({ where: { email: users[0].email } })).id;
    await request(app).post(`/api/v1/teams/${teamId}/invitations`).set(auth(tokens[0])).send({ email: users[2].email, role: "DEVELOPER" }).expect(403);
    await request(app).patch(`/api/v1/teams/${teamId}/members/${firstUserId}/role`).set(auth(tokens[2])).send({ role: "ADMIN" }).expect(403);
    await request(app).patch(`/api/v1/teams/${teamId}/members/${firstUserId}/role`).set(auth(tokens[2])).send({ role: "REVIEWER" }).expect(200);

    await request(app).put(`/api/v1/teams/${teamId}/settings`).set(auth(tokens[0])).send({ requireReviews: false }).expect(403);
    await request(app).put(`/api/v1/teams/${teamId}/settings`).set(auth(tokens[2])).send({ requireReviews: false }).expect(200);
    await request(app).put(`/api/v1/teams/${teamId}/settings`).set(auth(tokens[1])).send({ requireReviews: false, requiredApprovals: 2 }).expect(200).expect((response) => expect(response.body.data).toMatchObject({ requireReviews: false, requiredApprovals: 2, defaultBranch: "main" }));
  }, 120_000);
});
