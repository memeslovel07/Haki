import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/github/app-auth.js", () => ({
  createGitHubAppJwt: vi.fn().mockResolvedValue("test-app-jwt"),
}));

import { createInstallationAccessToken } from "../src/lib/github/installation-token.js";

describe("GitHub installation token", () => {
  it("requests an installation token using the App JWT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "test-installation-token",
          expires_at: "2026-11-20T19:00:00Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await createInstallationAccessToken("12345");

      expect(result.token).toBe("test-installation-token");
      expect(result.expires_at).toBe("2026-11-20T19:00:00Z");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/app/installations/12345/access_tokens",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-app-jwt",
            Accept: "application/vnd.github+json",
          }),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an invalid installation ID", async () => {
    await expect(
      createInstallationAccessToken("invalid-id"),
    ).rejects.toThrow("Invalid GitHub installation ID.");
  });

  it("rejects a failed GitHub API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 401 }),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        createInstallationAccessToken("12345"),
      ).rejects.toThrow(
        "Failed to create GitHub installation access token.",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});