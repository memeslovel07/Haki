import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicGitHubRepositories } from "../src/modules/auth/github-oauth.service.js";
import { verifyGitHubWebhook } from "../src/modules/github/github.service.js";

const originalWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWebhookSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
  else process.env.GITHUB_WEBHOOK_SECRET = originalWebhookSecret;
});

describe("GitHub repository and webhook workflows", () => {
  it("verifies webhook signatures against the raw request body", () => {
    const rawBody = Buffer.from('{"action":"suspend"}');
    process.env.GITHUB_WEBHOOK_SECRET = "test-webhook-secret";
    const signature = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest("hex")}`;

    expect(verifyGitHubWebhook(rawBody, signature)).toBe(true);
    expect(verifyGitHubWebhook(Buffer.from('{"action":"unsuspend"}'), signature)).toBe(false);
    expect(verifyGitHubWebhook(rawBody, "sha1=bad")).toBe(false);
  });

  it("lists public repositories only and maps the API response to the client contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 123,
          name: "public-project",
          full_name: "octo/public-project",
          private: false,
          html_url: "https://github.com/octo/public-project",
          description: "A public project",
          default_branch: "main",
          updated_at: "2026-11-26T10:00:00Z",
          owner: { login: "octo" },
        },
        {
          id: 456,
          name: "private-project",
          full_name: "octo/private-project",
          private: true,
          html_url: "https://github.com/octo/private-project",
          description: null,
          default_branch: "main",
          updated_at: "2026-11-26T10:00:00Z",
          owner: { login: "octo" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicGitHubRepositories("octo")).resolves.toEqual([
      {
        id: 123,
        name: "public-project",
        fullName: "octo/public-project",
        private: false,
        htmlUrl: "https://github.com/octo/public-project",
        description: "A public project",
        defaultBranch: "main",
        updatedAt: "2026-11-26T10:00:00Z",
        ownerLogin: "octo",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/users/octo/repos?");
  });
});
