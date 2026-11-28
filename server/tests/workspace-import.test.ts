import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRepository, findUser, extractArchive } = vi.hoisted(() => ({ createRepository: vi.fn(), findUser: vi.fn(), extractArchive: vi.fn() }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: { workspaceRepository: { create: createRepository }, user: { findUnique: findUser } } }));
vi.mock("../src/jobs/validation.archive.js", () => ({ extractValidationArchive: extractArchive }));

import { importRepository } from "../src/modules/workspace/workspace.controller.js";

function response() {
  const result: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
  return { res, result };
}

describe("ZIP repository import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue({ name: "Importer", email: "importer@example.com" });
    createRepository.mockImplementation(async ({ data }) => ({ id: "repository-id", name: data.name, description: null, visibility: "PRIVATE", owner: { name: "Importer", email: "importer@example.com" } }));
    extractArchive.mockImplementation(async (_archivePath: string, outputPath: string, options?: { preserveRoot?: boolean }) => {
      if (!options?.preserveRoot) throw new Error("Unexpected archive structure.");
      const folder = path.join(outputPath, "project");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "README.md"), "Imported project contents");
    });
  });
  it("retries root-level ZIP layouts and stores imported files plus the initial commit", async () => {
    const { res, result } = response();
    await importRepository({
      userId: "owner-id",
      query: { name: "Imported project" },
      body: Buffer.from("zip bytes"),
    } as never, res as never);

    expect(extractArchive).toHaveBeenCalledTimes(2);
    expect(extractArchive.mock.calls[1][2]).toEqual({ preserveRoot: true });
    const createArgs = createRepository.mock.calls[0][0];
    expect(createArgs.data.files.create).toEqual([expect.objectContaining({ path: "project/README.md", encoding: "utf8" })]);
    expect(createArgs.data.commits.create).toEqual(expect.objectContaining({ message: "Import repository", files: 1, snapshotFiles: { create: createArgs.data.files.create } }));
    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual({ success: true, data: expect.objectContaining({ id: "repository-id", name: "Imported project" }) });
    const persistedFile = createArgs.data.files.create[0];
    expect(persistedFile.content).toBe("Imported project contents");
  });
});
