
import { mkdir, rm, realpath } from "node:fs/promises";
import path from "node:path";

const WORKSPACE_ROOT = path.resolve(
  process.cwd(),
  "../infrastructure/data/validation-workspaces",
);

function getWorkspacePath(validationRunId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(validationRunId)) {
    throw new Error("Invalid validation run ID.");
  }

  return path.resolve(WORKSPACE_ROOT, validationRunId);
}

function isWithinRoot(root: string, target: string): boolean {
  return target.startsWith(`${root}${path.sep}`);
}

export async function createValidationWorkspace(
  validationRunId: string,
): Promise<string> {
  const workspacePath = getWorkspacePath(validationRunId);

  await mkdir(WORKSPACE_ROOT, { recursive: true });

  const realRoot = await realpath(WORKSPACE_ROOT);

  if (!isWithinRoot(realRoot, workspacePath)) {
    throw new Error("Workspace path is outside the workspace root.");
  }

  await mkdir(workspacePath, { recursive: true });

  const realWorkspacePath = await realpath(workspacePath);

  if (!isWithinRoot(realRoot, realWorkspacePath)) {
    throw new Error("Workspace path is outside the workspace root.");
  }

  return realWorkspacePath;
}

export async function cleanupValidationWorkspace(
  workspacePath: string,
): Promise<void> {
  const realRoot = await realpath(WORKSPACE_ROOT);
  const resolvedPath = path.resolve(workspacePath);

  if (!isWithinRoot(realRoot, resolvedPath)) {
    throw new Error("Refusing to remove a path outside the workspace root.");
  }

  await rm(resolvedPath, { recursive: true, force: true });
}
