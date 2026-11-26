
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const frontendOrigin = process.env.FRONTEND_ORIGIN!;

describe("CSRF: request origin validation", () => {
  it("rejects requests from an unauthorized origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", "https://evil.example")
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("rejects requests without an Origin header", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("allows the configured frontend origin to reach the refresh handler", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", frontendOrigin)
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});
