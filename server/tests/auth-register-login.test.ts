
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const frontendOrigin = process.env.FRONTEND_ORIGIN!;
const emailsToDelete = new Set<string>();

const registrationPassword = "RegistrationTest123!";
const loginPassword = "LoginTestPassword123!";

const registrationEmail = `register-${randomUUID()}@example.com`;
const duplicateEmail = `duplicate-${randomUUID()}@example.com`;
const loginEmail = `login-${randomUUID()}@example.com`;

emailsToDelete.add(registrationEmail);
emailsToDelete.add(duplicateEmail);
emailsToDelete.add(loginEmail);

describe("Authentication: registration and login", () => {
  beforeAll(async () => {
    const passwordHash = await argon2.hash(loginPassword, {
      type: argon2.argon2id,
    });

    await prisma.user.create({
      data: {
        email: loginEmail,
        name: "Test Login User",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [...emailsToDelete],
        },
      },
    });

    await prisma.$disconnect();
  });

  describe("POST /api/v1/auth/register", () => {
    it("registers a new user and stores an Argon2id password hash", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", frontendOrigin)
        .send({
          name: "Registration Test",
          email: registrationEmail,
          password: registrationPassword,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(registrationEmail);
      expect(response.body.data.user.id).toBeDefined();

      expect(response.body.data.user).not.toHaveProperty("passwordHash");
      expect(response.body.data.user).not.toHaveProperty("password");

      const storedUser = await prisma.user.findUnique({
        where: { email: registrationEmail },
        select: { passwordHash: true },
      });

      expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);

      const passwordMatches = await argon2.verify(
        storedUser!.passwordHash!,
        registrationPassword
      );

      expect(passwordMatches).toBe(true);
    });

    it("rejects duplicate email registration", async () => {
      const payload = {
        email: duplicateEmail,
        password: registrationPassword,
      };

      await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", frontendOrigin)
        .send(payload)
        .expect(201);

      const response = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", frontendOrigin)
        .send(payload)
        .expect(409);

      expect(response.body.error.code).toBe("REGISTRATION_CONFLICT");
    });

    it("rejects invalid email and short password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", frontendOrigin)
        .send({
          email: "invalid-email",
          password: "short",
        })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.issues.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("authenticates a user and issues access and refresh tokens", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", frontendOrigin)
        .send({
          email: loginEmail,
          password: loginPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.tokenType).toBe("Bearer");
      expect(response.body.data.expiresIn).toBe(900);

      expect(response.headers["set-cookie"]).toBeDefined();

      const cookies = response.headers["set-cookie"];

      expect(cookies[0]).toContain("haki_refresh=");
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it("rejects an incorrect password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", frontendOrigin)
        .send({
          email: loginEmail,
          password: "WrongPassword123!",
        })
        .expect(401);

      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects an unknown email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", frontendOrigin)
        .send({
          email: `unknown-${randomUUID()}@example.com`,
          password: loginPassword,
        })
        .expect(401);

      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });
});
