
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createValidationWorkspace,
  cleanupValidationWorkspace,
} from "../src/jobs/validation.workspace.js";

const WORKSPACE_ROOT = path.resolve(
  process.cwd(),
  "../infrastructure/data/validation-workspaces",
);

describe("Validation workspace", () => {
  it("creates and cleans up a workspace", async () => {
    const validationRunId = randomUUID();
    const workspacePath = await createValidationWorkspace(validationRunId);

    try {
      expect(existsSync(workspacePath)).toBe(true);

      expect(workspacePath).toBe(
        path.resolve(
          process.cwd(),
          "../infrastructure/data/validation-workspaces",
          validationRunId,
        ),
      );
    } finally {
      await cleanupValidationWorkspace(workspacePath);
    }

    expect(existsSync(workspacePath)).toBe(false);
  });

  it("rejects an invalid validation run ID", async () => {
    await expect(
      createValidationWorkspace("../outside"),
    ).rejects.toThrow("Invalid validation run ID.");
  });

  it("refuses to clean up a path outside the workspace root", async () => {
    const outsidePath = path.resolve(
      process.cwd(),
      "outside-workspace-test",
    );

    await mkdir(outsidePath, { recursive: true });

    try {
      await expect(
        cleanupValidationWorkspace(outsidePath),
      ).rejects.toThrow("Refusing to remove a path outside the workspace root.");

      expect(existsSync(outsidePath)).toBe(true);
    } finally {
      await rm(outsidePath, { recursive: true, force: true });
    }
  });

  it("rejects a workspace symlink pointing outside the workspace root", async () => {
    const validationRunId = randomUUID();
    const workspacePath = path.join(WORKSPACE_ROOT, validationRunId);
    const outsidePath = path.resolve(
      process.cwd(),
      "outside-workspace-symlink-test",
    );

    await mkdir(WORKSPACE_ROOT, { recursive: true });
    await mkdir(outsidePath, { recursive: true });
    await symlink(outsidePath, workspacePath, "junction");

    try {
      await expect(
        createValidationWorkspace(validationRunId),
      ).rejects.toThrow("Workspace path is outside the workspace root.");

      expect(existsSync(outsidePath)).toBe(true);
    } finally {
      await rm(workspacePath, { force: true });
      await rm(outsidePath, { recursive: true, force: true });
    }
  });

  it("removes a workspace symlink without deleting its target", async () => {
    const validationRunId = randomUUID();
    const workspacePath = path.join(WORKSPACE_ROOT, validationRunId);
    const outsidePath = path.resolve(
      process.cwd(),
      "outside-workspace-cleanup-test",
    );

    await mkdir(WORKSPACE_ROOT, { recursive: true });
    await mkdir(outsidePath, { recursive: true });
    await symlink(outsidePath, workspacePath, "junction");

    try {
      await cleanupValidationWorkspace(workspacePath);

      expect(existsSync(workspacePath)).toBe(false);
      expect(existsSync(outsidePath)).toBe(true);
    } finally {
      await rm(workspacePath, { force: true });
      await rm(outsidePath, { recursive: true, force: true });
    }
  });
});
