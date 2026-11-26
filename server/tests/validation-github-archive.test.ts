import { describe, expect, it, vi, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { downloadValidationArchive } from "../src/jobs/validation.github-archive.js";

describe("GitHub validation archive download", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads an archive and writes it to disk", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-github-archive-"),
    );

    try {
      const destinationPath = path.join(tempDir, "archive.zip");
      const archiveData = new Uint8Array([1, 2, 3, 4]);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(archiveData, {
            status: 200,
            headers: { "content-length": "4" },
          }),
        ),
      );

      await downloadValidationArchive(
        "owner",
        "repo",
        "a".repeat(40),
        "test-token",
        destinationPath,
      );

      const downloaded = await readFile(destinationPath);

      expect(downloaded).toEqual(Buffer.from(archiveData));
    } finally {
      vi.unstubAllGlobals();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects an invalid commit SHA", async () => {
    await expect(
      downloadValidationArchive(
        "owner",
        "repo",
        "invalid-sha",
        "test-token",
        "archive.zip",
      ),
    ).rejects.toThrow("Invalid commit SHA.");
  });

  it("rejects a failed GitHub response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, { status: 404 }),
      ),
    );

    await expect(
      downloadValidationArchive(
        "owner",
        "repo",
        "a".repeat(40),
        "test-token",
        "archive.zip",
      ),
    ).rejects.toThrow("Failed to download repository archive.");
  });

  it("rejects archives exceeding the declared size limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-length": String(100 * 1024 * 1024 + 1) },
        }),
      ),
    );

    await expect(
      downloadValidationArchive(
        "owner",
        "repo",
        "a".repeat(40),
        "test-token",
        "archive.zip",
      ),
    ).rejects.toThrow("Repository archive exceeds size limit.");
  });
});