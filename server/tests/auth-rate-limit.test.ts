
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const frontendOrigin = process.env.FRONTEND_ORIGIN!;

describe("Authentication: rate limiting", () => {
  it("limits registration to 5 requests per hour", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", frontendOrigin)
        .send({})
        .expect(400);
    }

    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", frontendOrigin)
      .send({})
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("limits login to 10 requests per 15 minutes", async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", frontendOrigin)
        .send({})
        .expect(400);
    }

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", frontendOrigin)
      .send({})
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("limits refresh to 30 requests per 15 minutes", async () => {
    for (let i = 0; i < 30; i++) {
      await request(app)
        .post("/api/v1/auth/refresh")
        .set("Origin", frontendOrigin)
        .expect(401);
    }

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", frontendOrigin)
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
