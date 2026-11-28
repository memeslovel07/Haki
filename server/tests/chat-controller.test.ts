import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findRepository, findFile } = vi.hoisted(() => ({ findRepository: vi.fn(), findFile: vi.fn() }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: { workspaceRepository: { findFirst: findRepository }, workspaceFile: { findFirst: findFile } } }));

import { chatWithGemini } from "../src/modules/chat/chat.controller.js";

function response() {
  const result: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
  return { res, result };
}

describe("HAKI Assistant controller", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    findRepository.mockReset();
    findFile.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("loads authorized file context and redacts secrets before sending it to Gemini", async () => {
    findRepository.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", name: "sample" });
    findFile.mockResolvedValue({ path: "src/config.ts", encoding: "utf8", content: "API_KEY=supersecret-value-123\nconst safe = true;" });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "The file configures the app." }] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { res, result } = response();

    await chatWithGemini({ userId: "user-1", body: { message: "Explain this file", context: { repositoryId: "11111111-1111-4111-8111-111111111111", fileId: "22222222-2222-4222-8222-222222222222" } } } as never, res as never);

    expect(result.statusCode).toBeUndefined();
    expect(result.body).toEqual({ success: true, data: { reply: "The file configures the app." } });
    const request = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(request.input).toContain("Repository: sample");
    expect(request.input).toContain("src/config.ts");
    expect(request.input).toContain("API_KEY=[REDACTED]");
    expect(request.input).not.toContain("supersecret-value-123");
  });

  it("does not send a file context when the repository is inaccessible", async () => {
    findRepository.mockResolvedValue(null);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { res, result } = response();

    await chatWithGemini({ userId: "user-1", body: { message: "Explain this", context: { repositoryId: "11111111-1111-4111-8111-111111111111", fileId: "22222222-2222-4222-8222-222222222222" } } } as never, res as never);

    expect(result.statusCode).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects binary file context instead of sending encoded bytes", async () => {
    findRepository.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", name: "sample" });
    findFile.mockResolvedValue({ path: "image.png", encoding: "base64", content: "AA==" });
    const { res, result } = response();

    await chatWithGemini({ userId: "user-1", body: { message: "Explain this", context: { repositoryId: "11111111-1111-4111-8111-111111111111", fileId: "22222222-2222-4222-8222-222222222222" } } } as never, res as never);

    expect(result.statusCode).toBe(400);
  });
});
