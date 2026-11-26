
import { describe, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
  mkdir,
  readdir,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractValidationArchive } from "../src/jobs/validation.archive.js";

describe("Validation archive extraction", () => {
  it("extracts files from a GitHub-style ZIP archive", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-test-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/sample.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");

      await extractValidationArchive(archivePath, workspacePath);

      const readme = await readFile(
        path.join(workspacePath, "README.md"),
        "utf8",
      );

      const testFile = await readFile(
        path.join(workspacePath, "test.txt"),
        "utf8",
      );

      const nestedFile = await readFile(
  path.join(workspacePath, "nested", "inside.txt"),
  "utf8",
);

      expect(readme.trim()).toBe("# Archive test");
      expect(testFile.trim()).toBe("HAKI archive extraction test");
      expect(nestedFile.trim()).toBe("Nested archive test");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not write through a pre-existing workspace symlink", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-symlink-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/sample.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");
      const outsidePath = path.join(tempDir, "outside");

      await mkdir(workspacePath, { recursive: true });
      await mkdir(outsidePath, { recursive: true });

      try {
        await symlink(outsidePath, path.join(workspacePath, "nested"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") {
          return;
        }

        throw error;
      }

      await expect(
        extractValidationArchive(archivePath, workspacePath),
      ).rejects.toThrow();

      const outsideFiles = await readdir(outsidePath);

      expect(outsideFiles).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

    it("rejects ZIP entries containing path traversal", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-traversal-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/traversal.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");

      await expect(
        extractValidationArchive(archivePath, workspacePath),
      ).rejects.toThrow("");

      const outsideFile = path.join(tempDir, "outside.txt");

      await expect(readFile(outsideFile)).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

    it("rejects ZIP entries containing Windows alternate data stream paths", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-ads-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/windows-ads.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");

      await expect(
        extractValidationArchive(archivePath, workspacePath),
      ).rejects.toThrow();

      await expect(
        readdir(workspacePath),
      ).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
  it("rejects Windows reserved device filenames", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-reserved-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/windows-reserved.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");

      await expect(
        extractValidationArchive(archivePath, workspacePath),
      ).rejects.toThrow();

      await expect(
        readdir(workspacePath),
      ).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
    it("rejects archives exceeding the entry-count limit", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-archive-entry-limit-"),
    );

    try {
      const archivePath = path.resolve(
        process.cwd(),
        "tests/fixtures/archive-test/too-many-entries.zip",
      );

      const workspacePath = path.join(tempDir, "workspace");

      await expect(
        extractValidationArchive(archivePath, workspacePath),
      ).rejects.toThrow("Archive contains too many entries.");
     } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}, 15000);
it("rejects files exceeding the per-file size limit", async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "haki-archive-file-limit-"),
  );

  try {
    const archivePath = path.resolve(
      process.cwd(),
      "tests/fixtures/archive-test/oversized-file.zip",
    );

    const workspacePath = path.join(tempDir, "workspace");

    await expect(
      extractValidationArchive(archivePath, workspacePath),
    ).rejects.toThrow();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
it("rejects archives exceeding the total extracted size limit", async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "haki-archive-total-limit-"),
  );

  try {
    const archivePath = path.resolve(
      process.cwd(),
      "tests/fixtures/archive-test/oversized-total.zip",
    );

    const workspacePath = path.join(tempDir, "workspace");

    await expect(
      extractValidationArchive(archivePath, workspacePath),
    ).rejects.toThrow();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
});
