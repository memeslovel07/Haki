// Local-only demo store. Use a secure backend for real accounts and shared data.
const DB_KEY = "haki_frontend_demo_v1";
const TOKEN_KEY = "haki_token";
const ACCESS_TOKEN_KEY = "haki_access_token";
const avatars = ["member-1", "member-2", "member-3", "member-4", "member-5", "member-6"];

function dbRead() {
  try {
    const value = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    return { users: value.users || [], pending: value.pending || {}, sessions: value.sessions || {}, repositories: value.repositories || [], files: value.files || [], commits: value.commits || [] };
  } catch {
    return { users: [], pending: {}, sessions: {}, repositories: [], files: [], commits: [] };
  }
}
function dbWrite(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch { throw new Error("Browser storage is full. Remove a large file or image and try again."); }
}
function id(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function code() { return String(Math.floor(100000 + Math.random() * 900000)); }
async function hash(password) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeUser(user) { if (!user) return null; const { passwordHash, ...safe } = user; return safe; }
function activeUser(db) {
  const token = localStorage.getItem(TOKEN_KEY);
  const userId = token ? db.sessions[token] : null;
  return db.users.find((user) => user.id === userId) || null;
}
function requireUser(db) { const user = activeUser(db); if (!user) throw new Error("Please sign in to continue."); return user; }
function startSession(db, user) {
  const token = id("local");
  db.sessions[token] = user.id;
  dbWrite(db);
  return { token, user: safeUser(user) };
}

const API_BASE = (import.meta.env?.VITE_HAKI_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const AUTH_BASE = `${API_BASE}/api/v1/auth`;

function localUserFromBackend(backendUser) {
  const db = dbRead();
  const email = String(backendUser.email || "").trim().toLowerCase();
  let user = db.users.find((entry) => entry.email?.toLowerCase() === email);

  if (!user) {
    user = {
      id: id("user"),
      fullName: backendUser.name || email.split("@")[0],
      username: email.split("@")[0],
      email,
      role: "member",
      avatarId: avatars[db.users.length % avatars.length],
      avatarDataUrl: "",
      createdAt: backendUser.createdAt || new Date().toISOString(),
      passwordHash: "",
    };
    db.users.push(user);
  } else {
    user.fullName = backendUser.name || user.fullName;
    user.email = email;
  }

  dbWrite(db);
  return user;
}

async function authRequest(endpoint, options = {}) {
  const response = await fetch(`${AUTH_BASE}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      Origin: import.meta.env?.VITE_HAKI_FRONTEND_ORIGIN || window.location.origin,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || body?.message || "Authentication failed.");
  }
  return body?.data ?? body;
}

function establishLocalSession(backendUser) {
  const db = dbRead();
  const user = localUserFromBackend(backendUser);
  return startSession(dbRead(), user);
}

function storeAccessToken(token) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function registerAccount({ fullName, email, password }) {
  const address = String(email || "").trim().toLowerCase();

  await authRequest("/register", {
    method: "POST",
    body: JSON.stringify({ name: fullName.trim(), email: address, password }),
  });

  return loginAccount({ email: address, password });
}

export async function loginAccount({ email, password }) {
  const address = String(email || "").trim().toLowerCase();
  const result = await authRequest("/login", {
    method: "POST",
    body: JSON.stringify({ email: address, password }),
  });

  storeAccessToken(result.accessToken);

  return establishLocalSession(result.user);
}

let refreshPromise = null;

export function refreshBackendSession() {
  if (!refreshPromise) {
    refreshPromise = authRequest("/refresh", { method: "POST" })
      .then((result) => {
        storeAccessToken(result.accessToken);
        return establishLocalSession(result.user);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function loginWithGitHubProfile() {
  return refreshBackendSession();
}

export async function getCurrentUser() {
  const user = requireUser(dbRead());
  return { user: safeUser(user) };
}

export async function logoutAccount() {
  try {
    await authRequest("/logout", { method: "POST" });
  } finally {
    const db = dbRead();
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) delete db.sessions[token];
    dbWrite(db);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export async function requestPasswordReset() {
  throw new Error("Password reset is not yet supported by the server.");
}

export async function resetPassword() {
  throw new Error("Password reset is not yet supported by the server.");
}

export async function changeAccountPassword() {
  throw new Error("Changing passwords is not yet supported by the server.");
}

export async function updateProfileAvatar(avatarDataUrl) {
  const db = dbRead();
  const user = requireUser(db);
  user.avatarDataUrl = avatarDataUrl;
  dbWrite(db);
  return { user: safeUser(user) };
}

export async function updateAccountProfile(profile) {
  const db = dbRead();
  const user = requireUser(db);
  const email = String(profile.email || user.email).trim().toLowerCase();

  if (db.users.some((entry) => entry.id !== user.id && entry.email === email)) {
    throw new Error("That email is already used by another local account.");
  }

  user.fullName = String(profile.name || user.fullName).trim();
  user.username = String(profile.username || user.username).trim();
  user.email = email;
  user.bio = String(profile.bio || "").trim();
  user.location = String(profile.location || "").trim();
  dbWrite(db);
  return { user: safeUser(user) };
}

async function apiRequest(endpoint, options = {}, retry = true) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && retry) {
    try { await refreshBackendSession(); return apiRequest(endpoint, options, false); } catch { /* report the API response below */ }
  }
  if (!response.ok || body.success === false) throw new Error(body?.error?.message || body?.error?.code || `Request failed (${response.status}).`);
  return body?.data ?? body;
}

export async function getRepositories() {
  return { data: await apiRequest("/repositories") };
}
export async function getRepositoryBranches(repositoryId) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repositoryId)}/branches`) };
}
export async function getGitHubInstallUrl() {
  return { data: await apiRequest("/github/install-url") };
}
/* Legacy local-preview methods remain available to old screens that are no longer routed. */
export async function getRepositoriesLocalPreview() {
  const db = dbRead(); const user = requireUser(db);
  return { data: db.repositories.filter((repo) => repo.ownerId === user.id || repo.visibility === "public") };
}
export async function getRepository(repoId) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}`) };
}
export async function getRepositoryLocalPreview(repoId) {
  const db = dbRead(); const user = requireUser(db);
  const repo = db.repositories.find((entry) => entry.id === repoId && (entry.ownerId === user.id || entry.visibility === "public"));
  if (!repo) throw new Error("Repository was not found or is private."); return { data: repo };
}
export async function createRepository(details) {
  const db = dbRead(); const user = requireUser(db); const name = String(details.name || "").trim();
  if (!name) throw new Error("Repository name is required.");
  if (db.repositories.some((repo) => repo.ownerId === user.id && repo.name.toLowerCase() === name.toLowerCase())) throw new Error("A repository with this name already exists.");
  const repo = { id: id("repo"), name, description: String(details.description || "").trim(), visibility: details.visibility === "public" ? "public" : "private", ownerId: user.id, ownerName: user.fullName, defaultBranch: "main", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.repositories.unshift(repo); dbWrite(db); return { data: repo };
}
export async function updateRepository(repoId, changes) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId);
  if (!repo || (repo.ownerId !== user.id && user.role !== "admin")) throw new Error("You do not have permission to change this repository.");
  Object.assign(repo, { name: String(changes.name ?? repo.name).trim(), description: String(changes.description ?? repo.description).trim(), visibility: changes.visibility === "public" ? "public" : "private", updatedAt: new Date().toISOString() });
  dbWrite(db); return { data: repo };
}
export async function deleteRepository(repoId) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId);
  if (!repo || (repo.ownerId !== user.id && user.role !== "admin")) throw new Error("You do not have permission to delete this repository.");
  db.repositories = db.repositories.filter((entry) => entry.id !== repoId); db.files = db.files.filter((entry) => entry.repositoryId !== repoId); db.commits = db.commits.filter((entry) => entry.repositoryId !== repoId);
  dbWrite(db); return { message: "Repository deleted." };
}
export async function getFiles(repoId) { await getRepository(repoId); return { data: dbRead().files.filter((file) => file.repositoryId === repoId).sort((a, b) => a.path.localeCompare(b.path)) }; }
export async function getFile(repoId, fileId) { const result = await getFiles(repoId); const file = result.data.find((entry) => entry.id === fileId); if (!file) throw new Error("File was not found."); return { data: file }; }
export async function createFile(repoId, details) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId && (entry.ownerId === user.id || entry.visibility === "public"));
  if (!repo) throw new Error("Repository was not found."); if (repo.ownerId !== user.id && user.role !== "admin") throw new Error("Only the owner can add files.");
  const path = String(details.path || details.name || "").trim(); if (!path) throw new Error("File path is required.");
  if (db.files.some((file) => file.repositoryId === repoId && file.path === path)) throw new Error("A file with this path already exists.");
  const file = { id: id("file"), repositoryId: repoId, name: String(details.name || path.split("/").pop()), path, content: String(details.content || ""), encoding: details.encoding || "utf8", mimeType: details.mimeType || "text/plain", size: Number(details.size || 0), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.files.push(file); repo.updatedAt = new Date().toISOString(); dbWrite(db); return { data: file };
}
export async function updateFile(repoId, fileId, changes) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId);
  if (!repo || (repo.ownerId !== user.id && user.role !== "admin")) throw new Error("You do not have permission to edit files here.");
  const file = db.files.find((entry) => entry.repositoryId === repoId && entry.id === fileId); if (!file) throw new Error("File was not found.");
  if (changes.content !== undefined) file.content = String(changes.content); file.updatedAt = new Date().toISOString(); repo.updatedAt = file.updatedAt; dbWrite(db); return { data: file };
}
export async function deleteFile(repoId, fileId) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId);
  if (!repo || (repo.ownerId !== user.id && user.role !== "admin")) throw new Error("You do not have permission to delete files here.");
  db.files = db.files.filter((entry) => !(entry.repositoryId === repoId && entry.id === fileId)); repo.updatedAt = new Date().toISOString(); dbWrite(db); return { message: "File deleted." };
}
export async function getCommits(repoId) { await getRepository(repoId); return { data: dbRead().commits.filter((entry) => entry.repositoryId === repoId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }; }
export async function getCommit(repoId, commitId) { const result = await getCommits(repoId); const commit = result.data.find((entry) => entry.id === commitId); if (!commit) throw new Error("Commit was not found."); return { data: commit }; }
export async function createCommit(repoId, message) {
  const db = dbRead(); const user = requireUser(db); const repo = db.repositories.find((entry) => entry.id === repoId && entry.ownerId === user.id);
  if (!repo) throw new Error("Only the repository owner can create a commit."); if (!String(message || "").trim()) throw new Error("Commit message is required.");
  const previous = db.commits.find((entry) => entry.repositoryId === repoId);
  const commit = { id: id("commit"), repositoryId: repoId, message: String(message).trim(), authorId: user.id, authorName: user.fullName, parentId: previous?.id || null, createdAt: new Date().toISOString(), files: db.files.filter((entry) => entry.repositoryId === repoId).length };
  db.commits.unshift(commit); repo.updatedAt = commit.createdAt; dbWrite(db); return { data: commit };
}

export async function getSubmissions(repositoryId) {
  const query = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
  return { data: await apiRequest(`/submissions${query}`) };
}

export async function createSubmission(details) {
  return { data: await apiRequest("/submissions", { method: "POST", body: JSON.stringify(details) }) };
}

export async function getSubmission(submissionId) {
  return { data: await apiRequest(`/submissions/${encodeURIComponent(submissionId)}`) };
}

export async function triggerValidation(submissionId) {
  return { data: await apiRequest(`/submissions/${encodeURIComponent(submissionId)}/validate`, { method: "POST" }) };
}

export async function requestSubmissionReview(submissionId) {
  return { data: await apiRequest(`/submissions/${encodeURIComponent(submissionId)}/request-review`, { method: "POST" }) };
}

export async function submitSubmissionReview(submissionId, decision, body = "") {
  return { data: await apiRequest(`/submissions/${encodeURIComponent(submissionId)}/reviews`, { method: "POST", body: JSON.stringify({ decision, ...(body ? { body } : {}) }) }) };
}

export async function addSubmissionReviewComment(submissionId, reviewId, comment) {
  return { data: await apiRequest(`/submissions/${encodeURIComponent(submissionId)}/reviews/${encodeURIComponent(reviewId)}/comments`, { method: "POST", body: JSON.stringify(comment) }) };
}
