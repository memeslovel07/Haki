import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HakiClient } from "./config.js";

const execFile = promisify(execFileCallback);
const metadataDirectory = ".haki";
const metadataFile = path.join(metadataDirectory, "config.json");
const repositoryUrlPrefix = "haki://";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RemoteState {
  apiUrl: string;
  remoteName: string;
  repositoryId: string;
  repositoryName: string;
  remoteHeadId: string | null;
  fetchedHeadId?: string | null;
  remoteFilesHash: string;
  fetchedFilesHash?: string;
}

interface HakiFile {
  id?: string;
  path: string;
  content: string;
  encoding: "utf8" | "base64";
  mimeType?: string;
  size?: number;
}

interface HakiCommit {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
}

async function git(args: string[], cwd = process.cwd()) {
  try {
    const { stdout, stderr } = await execFile("git", args, { cwd, maxBuffer: 50 * 1024 * 1024, encoding: "utf8" });
    return { stdout, stderr };
  } catch (error) {
    const childError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    if (childError.code === "ENOENT") throw new Error("Git was not found. Install Git and make sure it is available on PATH.");
    throw new Error((childError.stderr || childError.message || "Git command failed.").trim());
  }
}

export async function forwardToGit(args: string[], cwd = process.cwd()): Promise<number> {
  return new Promise((resolve) => {
    const child = import("node:child_process").then(({ spawn }) => spawn("git", args, { cwd, stdio: "inherit", shell: false }));
    child.then((process) => {
      process.once("error", (error: NodeJS.ErrnoException) => {
        console.error(error.code === "ENOENT" ? "Git was not found. Install Git and make sure it is available on PATH." : `Unable to start Git: ${error.message}`);
        resolve(1);
      });
      process.once("close", (code) => resolve(code ?? 1));
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : "Unable to start Git.");
      resolve(1);
    });
  });
}

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function decode(file: HakiFile): Buffer {
  return file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
}

function encode(bytes: Buffer): Pick<HakiFile, "content" | "encoding"> {
  return isUtf8(bytes)
    ? { content: bytes.toString("utf8"), encoding: "utf8" }
    : { content: bytes.toString("base64"), encoding: "base64" };
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const unsafePart = (part: string) => !part || part === "." || part === ".." || part.includes(":") || /[ .]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part);
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") || normalized.length > 1000 || unsafePart(parts[0]) || [".git", ".haki"].includes(parts[0].toLowerCase()) || parts.some(unsafePart)) {
    throw new Error(`Unsafe repository file path: ${value}`);
  }
  return normalized;
}

function withinRoot(root: string, relativePath: string): string {
  const target = path.resolve(root, ...safeRelativePath(relativePath).split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe repository file path: ${relativePath}`);
  return target;
}

async function ensureSafeParent(root: string, target: string) {
  const relative = path.relative(root, path.dirname(target));
  let current = root;
  for (const part of relative ? relative.split(path.sep) : []) {
    current = path.join(current, part);
    try {
      const details = await lstat(current);
      if (!details.isDirectory() || details.isSymbolicLink()) throw new Error(`Refusing to write through a link: ${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current);
    }
  }
}

async function readState(root: string): Promise<RemoteState | null> {
  try {
    return JSON.parse(await readFile(path.join(root, metadataFile), "utf8")) as RemoteState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("Invalid HAKI remote config. Remove or repair .haki/config.json.");
  }
}

async function writeState(root: string, state: RemoteState) {
  const directory = path.join(root, metadataDirectory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, "config.json"), JSON.stringify(state, null, 2), { mode: 0o600 });
  const excludePath = path.join(root, ".git", "info", "exclude");
  const excludes = await readFile(excludePath, "utf8").catch(() => "");
  if (!excludes.split(/\r?\n/).includes("/.haki/")) {
    await writeFile(excludePath, `${excludes}${excludes.endsWith("\n") || !excludes ? "" : "\n"}/.haki/\n`);
  }
}

async function findRoot(start = process.cwd()): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    if (await readState(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("This directory is not connected to HAKI. Clone with `haki clone haki://<repo-id>` or add a HAKI remote.");
    current = parent;
  }
}

async function getRepositories(client: HakiClient) {
  return client.request<any[]>("/repositories");
}

async function resolveRepository(client: HakiClient, identifier: string) {
  const repositories = await getRepositories(client);
  const matches = repositories.filter((repository) => repository.id === identifier || repository.name.toLowerCase() === identifier.toLowerCase());
  if (!matches.length) throw new Error(`HAKI repository '${identifier}' was not found. Run 'haki repos' to list available repositories.`);
  if (matches.length > 1) throw new Error(`More than one repository is named '${identifier}'. Use its repository ID.`);
  return matches[0];
}

function currentHead(commits: HakiCommit[]): string | null {
  return commits[0]?.id ?? null;
}

function filesHash(files: HakiFile[]): string {
  const digest = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)) {
    digest.update(file.path).update("\0").update(decode(file)).update("\0");
  }
  return digest.digest("hex");
}

export async function listRepositories(client: HakiClient) {
  const repositories = await getRepositories(client);
  if (!repositories.length) return console.log("No HAKI repositories available.");
  for (const repo of repositories) {
    console.log(`${repo.id}  ${repo.name}  ${repo.visibility}  ${repo.ownerName}`);
  }
}

export async function createRepository(client: HakiClient, name: string, description = "") {
  if (!name) throw new Error("Usage: haki repo create <name> [description]");
  const repo = await client.request<any>("/repositories", { method: "POST", body: { name, description } });
  console.log(`Created ${repo.name}. Clone it with: haki clone ${repositoryUrlPrefix}${repo.id}`);
}

export async function cloneRepository(client: HakiClient, uri: string, target = "") {
  const identifier = uri.slice(repositoryUrlPrefix.length);
  if (!identifier || identifier.includes("/")) throw new Error("Use a HAKI repository ID or name: haki clone haki://<repo-id> [directory]");
  const repository = await resolveRepository(client, identifier);
  const root = path.resolve(target || repository.name);
  try {
    const details = await lstat(root);
    if (!details.isDirectory() || details.isSymbolicLink()) throw new Error(`Destination must be a real directory, not a file or link: ${root}`);
    const entries = await readdir(root);
    if (entries.length) throw new Error(`Destination is not empty: ${root}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(root, { recursive: true });
  }

  const [files, commits] = await Promise.all([
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(repository.id)}/files`),
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(repository.id)}/commits`),
  ]);
  for (const file of files) {
    const targetPath = withinRoot(root, file.path);
    await ensureSafeParent(root, targetPath);
    await writeFile(targetPath, decode(file));
  }

  await git(["init", "--quiet"], root);
  await git(["branch", "-M", repository.defaultBranch || "main"], root);
  await git(["config", "user.name", client.config.user.name || client.config.user.email], root);
  await git(["config", "user.email", client.config.user.email], root);
  const state: RemoteState = {
    apiUrl: client.config.apiUrl,
    remoteName: "origin",
    repositoryId: repository.id,
    repositoryName: repository.name,
    remoteHeadId: currentHead(commits),
    fetchedHeadId: currentHead(commits),
    remoteFilesHash: filesHash(files),
    fetchedFilesHash: filesHash(files),
  };
  await writeState(root, state);
  await git(["add", "-A"], root);
  await git(["commit", "--quiet", "--allow-empty", "-m", "Clone from HAKI"], root);
  console.log(`Cloned ${repository.name} into ${root}.`);
}

export async function addRemote(client: HakiClient, name: string, uri: string) {
  if (!name || !uri.startsWith(repositoryUrlPrefix)) throw new Error("Usage: haki remote add <name> haki://<repo-id>");
  const root = await findGitRoot();
  const repository = await resolveRepository(client, uri.slice(repositoryUrlPrefix.length));
  const [commits, files] = await Promise.all([
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(repository.id)}/commits`),
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(repository.id)}/files`),
  ]);
  const existing = await readState(root);
  if (existing) {
    if (existing.remoteName !== name) throw new Error(`This checkout already uses HAKI remote '${existing.remoteName}'.`);
    if (existing.repositoryId !== repository.id || existing.apiUrl !== client.config.apiUrl) {
      throw new Error(`HAKI remote '${name}' is already connected to ${existing.repositoryName}. Run 'haki remote remove ${name}' before connecting a different repository.`);
    }
    throw new Error(`HAKI remote '${name}' is already connected to ${repository.name}.`);
  }
  await writeState(root, {
    apiUrl: client.config.apiUrl,
    remoteName: name,
    repositoryId: repository.id,
    repositoryName: repository.name,
    remoteHeadId: currentHead(commits),
    fetchedHeadId: currentHead(commits),
    remoteFilesHash: filesHash(files),
    fetchedFilesHash: filesHash(files),
  });
  console.log(`Added HAKI remote ${name} (${repository.name}).`);
}

export async function showRemote() {
  const root = await findRoot();
  const state = (await readState(root))!;
  console.log(`${state.remoteName}\thaki://${state.repositoryId} (${state.repositoryName})`);
}

export async function removeHakiRemote(name: string) {
  const root = await findGitRoot();
  const state = await readState(root);
  if (!state) throw new Error("This checkout has no HAKI remote.");
  if (state.remoteName !== name) throw new Error(`HAKI remote '${name}' was not found. Configured remote: '${state.remoteName}'.`);
  await rm(path.join(root, metadataFile), { force: true });
  console.log(`Removed local HAKI remote '${name}'. The remote repository was not changed.`);
}

export async function hasHakiRemote(): Promise<boolean> {
  try {
    return Boolean(await readState(await findRoot()));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This directory is not connected to HAKI.")) return false;
    throw error;
  }
}

export async function matchesHakiRemote(name: string): Promise<boolean> {
  try {
    const state = await readState(await findRoot());
    return state?.remoteName === name;
  } catch {
    return false;
  }
}

async function committedFiles(root: string): Promise<HakiFile[]> {
  await git(["rev-parse", "--verify", "HEAD"], root);
  const { stdout } = await execFile("git", ["ls-tree", "-rz", "--name-only", "HEAD"], { cwd: root, encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
  const paths = stdout.toString("utf8").split("\0").filter((filePath) => filePath && ![".git", ".haki"].includes(filePath.split("/")[0].toLowerCase()));
  const files: HakiFile[] = [];
  let totalSize = 0;
  for (const filePath of paths) {
    const relative = safeRelativePath(filePath);
    const target = withinRoot(root, relative);
    const details = await lstat(target);
    if (!details.isFile() || details.isSymbolicLink()) throw new Error(`HAKI snapshots cannot contain symlinks or submodules: ${relative}`);
    const bytes = await readFile(target);
    totalSize += bytes.length;
    if (bytes.length > 2_000_000 || totalSize > 25 * 1024 * 1024) throw new Error("HAKI pushes support files up to 2 MB and 25 MB per snapshot.");
    const encoded = encode(bytes);
    if (encoded.content.length > 2_000_000) throw new Error(`File exceeds the HAKI API limit after encoding: ${relative}`);
    files.push({ path: relative, ...encoded, mimeType: mimeType(relative), size: bytes.length });
  }
  return files;
}

function mimeType(filePath: string): string {
  return ({ ".txt": "text/plain", ".md": "text/markdown", ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jsx": "text/javascript", ".ts": "text/typescript", ".tsx": "text/typescript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".pdf": "application/pdf" } as Record<string, string>)[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function requireClean(root: string, action: "push" | "pull") {
  const { stdout } = await git(["status", "--porcelain", "--untracked-files=all"], root);
  if (stdout.trim()) throw new Error(`Cannot ${action}: local Git changes would make the HAKI snapshot ambiguous. Commit or stash them, then retry.`);
}

export async function push(client: HakiClient, message?: string) {
  const root = await findRoot();
  const state = (await readState(root))!;
  if (state.apiUrl !== client.config.apiUrl) throw new Error("This HAKI remote belongs to a different API. Run `haki remote add` to reconnect it.");
  await requireClean(root, "push");
  const [commits, remoteFiles, files, log] = await Promise.all([
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/commits`),
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/files`),
    committedFiles(root),
    git(["log", "-1", "--format=%s"], root),
  ]);
  const headId = currentHead(commits);
  if (headId !== state.remoteHeadId) throw new Error("HAKI remote changed. Run `haki fetch`, inspect with `haki status`, then `haki pull` before pushing.");
  if (filesHash(remoteFiles) !== state.remoteFilesHash) throw new Error("HAKI workspace files changed. Run `haki fetch` and `haki pull` before pushing.");
  const commitMessage = (message || log.stdout.trim() || "CLI push").slice(0, 500);
  const commit = await client.request<HakiCommit>(`/repositories/${encodeURIComponent(state.repositoryId)}/push`, {
    method: "POST",
    body: { expectedHeadId: headId, expectedFilesHash: state.remoteFilesHash, message: commitMessage, files },
  });
  state.remoteFilesHash = filesHash(files);
  state.fetchedFilesHash = state.remoteFilesHash;
  state.remoteHeadId = commit.id;
  state.fetchedHeadId = commit.id;
  await writeState(root, state);
  console.log(`Pushed snapshot ${commit.id.slice(0, 8)} to HAKI/${state.repositoryName}.`);
}

export async function fetchRemote(client: HakiClient) {
  const root = await findRoot();
  const state = (await readState(root))!;
  const [commits, files] = await Promise.all([
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/commits`),
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/files`),
  ]);
  const latestId = currentHead(commits);
  const latestFilesHash = filesHash(files);
  state.fetchedHeadId = latestId;
  state.fetchedFilesHash = latestFilesHash;
  await writeState(root, state);
  const baseIndex = state.remoteHeadId ? commits.findIndex((commit) => commit.id === state.remoteHeadId) : commits.length;
  const newCount = baseIndex < 0 ? commits.length : baseIndex;
  console.log(newCount || latestFilesHash !== state.remoteFilesHash ? `${newCount} new HAKI commit(s) fetched. Run 'haki pull' to update this checkout.` : "HAKI remote is up to date.");
  for (const commit of commits.slice(0, Math.min(newCount, 5))) console.log(`${commit.id.slice(0, 8)}  ${commit.message}`);
}

export async function pull(client: HakiClient) {
  const root = await findRoot();
  const state = (await readState(root))!;
  await requireClean(root, "pull");
  const [files, commits] = await Promise.all([
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/files`),
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/commits`),
  ]);
  const latestId = currentHead(commits);
  const latestFilesHash = filesHash(files);
  if (latestId === state.remoteHeadId && latestFilesHash === state.remoteFilesHash) return console.log("Already up to date with HAKI.");

  const localTree = await execFile("git", ["ls-tree", "-rz", "--name-only", "HEAD"], { cwd: root, encoding: "buffer", maxBuffer: 50 * 1024 * 1024 }).catch(() => ({ stdout: Buffer.alloc(0), stderr: "" }));
  const localPaths = localTree.stdout.toString("utf8").split("\0").filter(Boolean);
  const remotePaths = new Set(files.map((file) => safeRelativePath(file.path)));
  for (const filePath of localPaths) {
    const relative = safeRelativePath(filePath);
    if (!remotePaths.has(relative)) await rm(withinRoot(root, relative), { force: true, recursive: true });
  }
  for (const file of files) {
    const relative = safeRelativePath(file.path);
    const target = withinRoot(root, relative);
    await ensureSafeParent(root, target);
    await rm(target, { force: true });
    await writeFile(target, decode(file));
  }

  await git(["add", "-A"], root);
  const changed = (await git(["status", "--porcelain"], root)).stdout.trim();
  if (changed) {
    await git(["-c", `user.name=${client.config.user.name || client.config.user.email}`, "-c", `user.email=${client.config.user.email}`, "commit", "--quiet", "-m", `Pull from HAKI ${latestId?.slice(0, 8) || "empty"}`], root);
  }
  state.remoteHeadId = latestId;
  state.fetchedHeadId = latestId;
  state.remoteFilesHash = latestFilesHash;
  state.fetchedFilesHash = latestFilesHash;
  await writeState(root, state);
  console.log(`Pulled ${files.length} file(s) from HAKI/${state.repositoryName}.`);
}

export async function status(client: HakiClient) {
  const root = await findRoot();
  const state = (await readState(root))!;
  const { stdout } = await git(["status", "--short", "--branch", "--untracked-files=all"], root);
  const lines = stdout.trimEnd().split(/\r?\n/);
  process.stdout.write(`${lines[0] || "## HEAD"}\n`);
  const changes = lines.slice(1);
  if (changes.length) {
    console.log("Local changes:");
    for (const change of changes.slice(0, 20)) console.log(`  ${change}`);
    if (changes.length > 20) console.log(`  ... ${changes.length - 20} more file(s)`);
  } else console.log("Local Git working tree clean.");
  const [commits, files] = await Promise.all([
    client.request<HakiCommit[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/commits`),
    client.request<HakiFile[]>(`/repositories/${encodeURIComponent(state.repositoryId)}/files`),
  ]);
  const latestId = currentHead(commits);
  const remoteChanged = latestId !== state.remoteHeadId || filesHash(files) !== state.remoteFilesHash;
  const fetchedIndex = state.fetchedHeadId ? commits.findIndex((commit) => commit.id === state.fetchedHeadId) : -1;
  const remoteIndex = state.remoteHeadId ? commits.findIndex((commit) => commit.id === state.remoteHeadId) : -1;
  const commitsSinceFetch = fetchedIndex < 0 ? 0 : fetchedIndex;
  const commitsSincePull = remoteIndex < 0 ? 0 : remoteIndex;
  const filesDifferFromFetched = Boolean(state.fetchedFilesHash && filesHash(files) !== state.fetchedFilesHash);
  console.log(`HAKI remote: ${state.remoteName} (${state.repositoryName})`);
  if (remoteChanged) {
    console.log(`Remote has changed${commitsSincePull ? ` (${commitsSincePull} commit(s) ahead of this checkout)` : " (file snapshot differs)"}.`);
    console.log("Run `haki fetch` to inspect updates, then `haki pull` to apply them.");
  } else console.log("Remote matches the last pulled snapshot.");
  if (commitsSinceFetch || filesDifferFromFetched) {
    const lag = commitsSinceFetch ? `by ${commitsSinceFetch} commit(s)` : "because files changed";
    console.log(`Fetched view is stale ${lag}; run ` + "`haki fetch`" + " to refresh it.");
  }
  if (changes.length) console.log("Commit or stash local Git changes before `haki pull` or `haki push`.");
}

async function findGitRoot(start = process.cwd()): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    try {
      const details = await lstat(path.join(current, ".git"));
      if (details.isDirectory() || details.isFile()) return current;
    } catch { /* keep walking toward the filesystem root */ }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Run this command inside a Git repository.");
    current = parent;
  }
}

export function isHakiUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith(repositoryUrlPrefix));
}

export { repositoryUrlPrefix };
