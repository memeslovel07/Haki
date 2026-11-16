import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("GET /api/v1/health", () => {
  it("should return HTTP 200 with a healthy API response", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: "HAKI API",
        status: "healthy",
      },
    });

    expect(response.body.data.timestamp).toBeDefined();
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
  });
});