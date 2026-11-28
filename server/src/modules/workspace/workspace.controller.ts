import type { Response } from "express";
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { extractValidationArchive } from "../../jobs/validation.archive.js";
import { workspaceRepositoryAccessWhere } from "./access-control.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function presentRepository(repository: any) {
  return {
    ...repository,
    description: repository.description ?? "",
    visibility: repository.visibility.toLowerCase(),
    ownerName: repository.owner?.name || repository.owner?.email || "HAKI member",
    owner: undefined,
  };
}

async function accessibleRepository(repoId: string, userId: string) {
  if (!uuidPattern.test(repoId)) return null;
  return prisma.workspaceRepository.findFirst({
    where: { id: repoId, ...workspaceRepositoryAccessWhere(userId) },
    include: { owner: { select: { name: true, email: true } } },
  });
}

export async function listRepositories(req: AuthenticatedRequest, res: Response) {
  try {
    const repositories = await prisma.workspaceRepository.findMany({
      where: workspaceRepositoryAccessWhere(req.userId!),
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ success: true, data: repositories.map(presentRepository) });
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load repositories.");
  }
}

export async function createRepository(req: AuthenticatedRequest, res: Response) {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name || name.length > 100 || description.length > 5000) {
    return fail(res, 400, "VALIDATION_ERROR", "Enter a repository name (up to 100 characters) and a description up to 5,000 characters.");
  }
  try {
    const repository = await prisma.workspaceRepository.create({
      data: {
        ownerId: req.userId!, name, description,
        visibility: body.visibility === "public" ? "PUBLIC" : "PRIVATE",
        defaultBranch: "main",
      },
      include: { owner: { select: { name: true, email: true } } },
    });
    return res.status(201).json({ success: true, data: presentRepository(repository) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return fail(res, 409, "REPOSITORY_EXISTS", "A repository with this name already exists.");
    }
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to create repository.");
  }
}

export async function importRepository(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const archive = Buffer.isBuffer(req.body) ? req.body : null;
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!archive?.length || archive.length > 20 * 1024 * 1024) return fail(res, 400, "INVALID_ARCHIVE", "Choose a ZIP file smaller than 20 MB.");
  if (!name || name.length > 100) return fail(res, 400, "VALIDATION_ERROR", "Repository name is required.");
  const temp = await mkdtemp(path.join(os.tmpdir(), "haki-import-"));
  let saving = false;
  try {
    const archivePath = path.join(temp, "repository.zip");
    const outputPath = path.join(temp, "files");
    await writeFile(archivePath, archive);
    try {
      await extractValidationArchive(archivePath, outputPath);
    } catch (error) {
      const isRootLayout = error instanceof Error && ["Unexpected archive structure.", "Archive contains files at root."].includes(error.message);
      if (!isRootLayout) throw error;
      await rm(outputPath, { recursive: true, force: true });
      await extractValidationArchive(archivePath, outputPath, { preserveRoot: true });
    }

    const files: Array<{ name: string; path: string; content: string; encoding: string; mimeType: string; size: number }> = [];
    let totalSize = 0;
    async function collect(directory: string, prefix = "") {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await collect(fullPath, relativePath);
          continue;
        }
        const bytes = await readFile(fullPath);
        totalSize += bytes.length;
        if (totalSize > 25 * 1024 * 1024) throw new Error("Imported files exceed the 25 MB storage limit.");
        const text = isUtf8(bytes);
        files.push({
          name: entry.name,
          path: relativePath,
          content: text ? bytes.toString("utf8") : bytes.toString("base64"),
          encoding: text ? "utf8" : "base64",
          mimeType: "application/octet-stream",
          size: bytes.length,
        });
      }
    }
    await collect(outputPath);
    if (!files.length) return fail(res, 400, "EMPTY_ARCHIVE", "The ZIP file does not contain any files.");

    saving = true;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const repository = await prisma.workspaceRepository.create({
      data: {
        ownerId: userId!, name,
        files: { create: files },
        commits: {
          create: {
            authorId: userId!, authorName: user?.name || user?.email || "HAKI member",
            message: "Import repository", files: files.length,
            snapshotFiles: { create: files },
          },
        },
      },
      include: { owner: { select: { name: true, email: true } } },
    });
    return res.status(201).json({ success: true, data: presentRepository(repository) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return fail(res, 409, "REPOSITORY_EXISTS", "A repository with this name already exists.");
    if (!saving) return fail(res, 400, "INVALID_ARCHIVE", error instanceof Error ? error.message : "The ZIP file is invalid or contains unsupported paths.");
    console.error("Repository ZIP import could not be saved:", error instanceof Error ? error.message : "unknown error");
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to import repository.");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function getRepository(req: AuthenticatedRequest, res: Response) {
  try {
    const repository = await accessibleRepository(req.params.repoId as string, req.userId!);
    if (!repository) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    return res.json({ success: true, data: presentRepository(repository) });
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load repository.");
  }
}

export async function updateRepository(req: AuthenticatedRequest, res: Response) {
  const repoId = req.params.repoId as string;
  if (!uuidPattern.test(repoId)) return fail(res, 404, "NOT_FOUND", "Repository not found.");
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  if (name !== undefined && (!name || name.length > 100)) return fail(res, 400, "VALIDATION_ERROR", "Repository name must be between 1 and 100 characters.");
  if (description !== undefined && description.length > 5000) return fail(res, 400, "VALIDATION_ERROR", "Description is too long.");
  try {
    const current = await prisma.workspaceRepository.findFirst({ where: { id: repoId, ownerId: req.userId } });
    if (!current) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    const repository = await prisma.workspaceRepository.update({
      where: { id: repoId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(body.visibility === "public" || body.visibility === "private" ? { visibility: body.visibility === "public" ? "PUBLIC" : "PRIVATE" } : {}),
      },
      include: { owner: { select: { name: true, email: true } } },
    });
    return res.json({ success: true, data: presentRepository(repository) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return fail(res, 409, "REPOSITORY_EXISTS", "A repository with this name already exists.");
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to update repository.");
  }
}

export async function deleteRepository(req: AuthenticatedRequest, res: Response) {
  const repoId = req.params.repoId as string;
  if (!uuidPattern.test(repoId)) return fail(res, 404, "NOT_FOUND", "Repository not found.");
  try {
    const result = await prisma.workspaceRepository.deleteMany({ where: { id: repoId, ownerId: req.userId } });
    if (!result.count) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    return res.status(204).send();
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to delete repository.");
  }
}

export async function listFiles(req: AuthenticatedRequest, res: Response) {
  try {
    const repository = await accessibleRepository(req.params.repoId as string, req.userId!);
    if (!repository) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    const files = await prisma.workspaceFile.findMany({ where: { repositoryId: repository.id }, orderBy: { path: "asc" } });
    return res.json({ success: true, data: files });
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load repository files.");
  }
}

export async function createFile(req: AuthenticatedRequest, res: Response) {
  const repoId = req.params.repoId as string;
  const body = req.body ?? {};
  const path = typeof body.path === "string" ? body.path.trim().replace(/\\/g, "/") : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!path || path.startsWith("/") || path.split("/").some((part: string) => !part || part === "." || part === "..") || path.length > 1000 || content.length > 2_000_000) {
    return fail(res, 400, "VALIDATION_ERROR", "File path or content is invalid.");
  }
  try {
    const repository = await prisma.workspaceRepository.findFirst({ where: { id: repoId, ownerId: req.userId } });
    if (!repository) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    const file = await prisma.workspaceFile.create({
      data: {
        repositoryId: repoId,
        name: typeof body.name === "string" ? body.name.slice(0, 255) : path.split("/").pop()!,
        path, content,
        encoding: body.encoding === "base64" ? "base64" : "utf8",
        mimeType: typeof body.mimeType === "string" ? body.mimeType.slice(0, 255) : "text/plain",
        size: Number.isSafeInteger(body.size) && body.size >= 0 ? body.size : Buffer.byteLength(content),
      },
    });
    await prisma.workspaceRepository.update({ where: { id: repoId }, data: { updatedAt: new Date() } });
    return res.status(201).json({ success: true, data: file });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return fail(res, 409, "FILE_EXISTS", "A file with this path already exists.");
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to create file.");
  }
}

export async function updateFile(req: AuthenticatedRequest, res: Response) {
  const { repoId, fileId } = req.params as { repoId: string; fileId: string };
  if (!uuidPattern.test(repoId) || !uuidPattern.test(fileId)) return fail(res, 404, "NOT_FOUND", "File not found.");
  const content = req.body?.content;
  if (typeof content !== "string" || content.length > 2_000_000) return fail(res, 400, "VALIDATION_ERROR", "File content is invalid or too large.");
  try {
    const file = await prisma.workspaceFile.findFirst({ where: { id: fileId, repositoryId: repoId, repository: { ownerId: req.userId } } });
    if (!file) return fail(res, 404, "NOT_FOUND", "File not found.");
    const updated = await prisma.workspaceFile.update({ where: { id: fileId }, data: { content, size: Buffer.byteLength(content) } });
    await prisma.workspaceRepository.update({ where: { id: repoId }, data: { updatedAt: new Date() } });
    return res.json({ success: true, data: updated });
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to update file.");
  }
}

export async function deleteFile(req: AuthenticatedRequest, res: Response) {
  const { repoId, fileId } = req.params as { repoId: string; fileId: string };
  if (!uuidPattern.test(repoId) || !uuidPattern.test(fileId)) return fail(res, 404, "NOT_FOUND", "File not found.");
  try {
    const result = await prisma.workspaceFile.deleteMany({ where: { id: fileId, repositoryId: repoId, repository: { ownerId: req.userId } } });
    if (!result.count) return fail(res, 404, "NOT_FOUND", "File not found.");
    await prisma.workspaceRepository.update({ where: { id: repoId }, data: { updatedAt: new Date() } });
    return res.status(204).send();
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to delete file.");
  }
}

export async function listCommits(req: AuthenticatedRequest, res: Response) {
  try {
    const repository = await accessibleRepository(req.params.repoId as string, req.userId!);
    if (!repository) return fail(res, 404, "NOT_FOUND", "Repository not found.");
    const commits = await prisma.workspaceCommit.findMany({ where: { repositoryId: repository.id }, orderBy: { createdAt: "desc" } });
    return res.json({ success: true, data: commits });
  } catch {
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load commit history.");
  }
}

export async function createCommit(req: AuthenticatedRequest, res: Response) {
  const repoId = req.params.repoId as string;
  const body = req.body ?? {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 500) return fail(res, 400, "VALIDATION_ERROR", "Commit message must be between 1 and 500 characters.");
  try {
    const commit = await prisma.$transaction(async (tx) => {
      const repository = await tx.workspaceRepository.findFirst({ where: { id: repoId, ownerId: req.userId }, include: { commits: { orderBy: { createdAt: "desc" }, take: 1 } } });
      if (!repository) throw new Error("NOT_FOUND");
      const [user, files] = await Promise.all([
        tx.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true } }),
        tx.workspaceFile.findMany({ where: { repositoryId: repoId }, orderBy: { path: "asc" } }),
      ]);
      const snapshot = files.map(({ name, path, content, encoding, mimeType, size }) => ({ name, path, content, encoding, mimeType, size }));
      // ponytail: each commit stores a full snapshot; use content-addressed blobs if storage growth becomes a problem.
      const created = await tx.workspaceCommit.create({ data: {
        repositoryId: repoId, authorId: req.userId!, authorName: user?.name || user?.email || "HAKI member",
        message, parentId: repository.commits[0]?.id ?? null, files: snapshot.length,
        snapshotFiles: { create: snapshot },
      } });
      await tx.workspaceRepository.update({ where: { id: repoId }, data: { updatedAt: created.createdAt } });
      return created;
    });
    return res.status(201).json({ success: true, data: commit });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return fail(res, 404, "NOT_FOUND", "Repository not found.");
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to create commit.");
  }
}

export async function pushRepository(req: AuthenticatedRequest, res: Response) {
  const repoId = req.params.repoId as string;
  if (!uuidPattern.test(repoId)) return fail(res, 404, "NOT_FOUND", "Repository not found.");

  const body = req.body ?? {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const expectedHeadId = body.expectedHeadId;
  const expectedFilesHash = body.expectedFilesHash;
  const sourceFiles = body.files;
  if (!message || message.length > 500 || (expectedHeadId !== null && (typeof expectedHeadId !== "string" || !uuidPattern.test(expectedHeadId))) || typeof expectedFilesHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedFilesHash) || !Array.isArray(sourceFiles) || sourceFiles.length > 5000) {
    return fail(res, 400, "VALIDATION_ERROR", "Push requires a commit message, expected remote head, and a valid file list.");
  }

  const seenPaths = new Set<string>();
  const files: Array<{ name: string; path: string; content: string; encoding: string; mimeType: string; size: number }> = [];
  let totalSize = 0;
  for (const item of sourceFiles) {
    const filePath = typeof item?.path === "string" ? item.path.replace(/\\/g, "/") : "";
    const parts = filePath.split("/");
    const unsafePart = (part: string) => !part || part === "." || part === ".." || part.includes(":") || /[ .]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part);
    const encoding = item?.encoding === "base64" ? "base64" : item?.encoding === "utf8" ? "utf8" : "";
    const content = item?.content;
    if (!filePath || filePath.length > 1000 || filePath.startsWith("/") || filePath.includes("\0") || unsafePart(parts[0]) || [".git", ".haki"].includes(parts[0]?.toLowerCase()) || parts.some(unsafePart) || !encoding || typeof content !== "string" || content.length > 2_000_000 || seenPaths.has(filePath)) {
      return fail(res, 400, "VALIDATION_ERROR", "Push contains an invalid or duplicate file path or file content.");
    }

    const bytes = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
    if (encoding === "base64" && bytes.toString("base64") !== content) {
      return fail(res, 400, "VALIDATION_ERROR", "Push contains invalid base64 file content.");
    }
    totalSize += bytes.length;
    if (bytes.length > 2_000_000 || totalSize > 25 * 1024 * 1024) {
      return fail(res, 413, "PUSH_TOO_LARGE", "Push exceeds the 25 MB total storage limit or the per-file limit.");
    }

    seenPaths.add(filePath);
    files.push({
      name: parts.at(-1)!,
      path: filePath,
      content,
      encoding,
      mimeType: typeof item.mimeType === "string" ? item.mimeType.slice(0, 255) : "application/octet-stream",
      size: bytes.length,
    });
  }

  try {
    const commit = await prisma.$transaction(async (tx) => {
      const locked = await tx.workspaceRepository.updateMany({
        where: { id: repoId, ownerId: req.userId },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new Error("NOT_FOUND");

      const repository = await tx.workspaceRepository.findUnique({
        where: { id: repoId },
        select: { commits: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
      });
      const currentHeadId = repository?.commits[0]?.id ?? null;
      if (currentHeadId !== expectedHeadId) throw new Error("REMOTE_CHANGED");

      const currentFiles = await tx.workspaceFile.findMany({ where: { repositoryId: repoId }, orderBy: { path: "asc" }, select: { path: true, content: true, encoding: true } });
      const currentFilesHash = createHash("sha256");
      for (const file of currentFiles) {
        const bytes = file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
        currentFilesHash.update(file.path).update("\0").update(bytes).update("\0");
      }
      if (currentFilesHash.digest("hex") !== expectedFilesHash) throw new Error("WORKSPACE_CHANGED");

      const user = await tx.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true } });
      await tx.workspaceFile.deleteMany({ where: { repositoryId: repoId } });
      if (files.length) {
        await tx.workspaceFile.createMany({ data: files.map((file) => ({ repositoryId: repoId, ...file })) });
      }

      return tx.workspaceCommit.create({
        data: {
          repositoryId: repoId,
          authorId: req.userId!,
          authorName: user?.name || user?.email || "HAKI member",
          message,
          parentId: currentHeadId,
          files: files.length,
          snapshotFiles: { create: files },
        },
      });
    }, { timeout: 30_000 });

    return res.status(201).json({ success: true, data: commit });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return fail(res, 404, "NOT_FOUND", "Repository not found.");
    if (error instanceof Error && error.message === "REMOTE_CHANGED") return fail(res, 409, "REMOTE_CHANGED", "The HAKI repository changed. Fetch and pull before pushing again.");
    if (error instanceof Error && error.message === "WORKSPACE_CHANGED") return fail(res, 409, "WORKSPACE_CHANGED", "The HAKI workspace has uncommitted file changes. Fetch and pull before pushing again.");
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to push repository snapshot.");
  }
}
