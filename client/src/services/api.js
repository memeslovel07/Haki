const API_BASE = "/api/v1";
let accessToken = "";

function localUserFromBackend(backendUser) {
  const email = String(backendUser.email || "").trim().toLowerCase();
  const profile = backendUser.profile && typeof backendUser.profile === "object" ? backendUser.profile : {};
  return {
    ...backendUser,
    fullName: backendUser.name || email.split("@")[0],
    username: profile.username || email.split("@")[0],
    bio: profile.bio || "",
    location: profile.location || "",
    avatarDataUrl: profile.avatarDataUrl || "",
    linkedProviders: backendUser.oauthAccounts?.map((account) => account.provider) || backendUser.linkedProviders || [],
  };
}

async function authRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}/auth${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || body?.message || "Authentication failed.");
  }
  const result = body?.data ?? body;
  if (result?.accessToken) accessToken = result.accessToken;
  return result;
}

async function apiRequest(path, options = {}, retry = true) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    await refreshBackendSession();
    return apiRequest(path, options, false);
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || body?.error || body?.message || "The request could not be completed.");
  return body && Object.hasOwn(body, "data") ? body.data : body;
}

async function establishLocalSession(backendUser) {
  const current = await apiRequest("/users/me", {}, false);
  return { user: localUserFromBackend({ ...backendUser, ...(current.user ?? current) }) };
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

  return establishLocalSession(result.user);
}

let refreshPromise = null;

export function refreshBackendSession() {
  if (!refreshPromise) {
    refreshPromise = authRequest("/refresh", { method: "POST" })
      .then((result) => establishLocalSession(result.user))
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function loginWithGitHubProfile() {
  return refreshBackendSession();
}

export async function createGitHubLink() {
  return apiRequest("/auth/github/link", { method: "POST" });
}

export async function getCurrentUser() {
  const result = await apiRequest("/users/me");
  return { user: localUserFromBackend(result.user ?? result) };
}

export async function logoutAccount() {
  try {
    await apiRequest("/auth/logout", { method: "POST" }, false);
  } finally {
    accessToken = "";
  }
}

export async function sendChatMessage({ message, history, context }) {
  return apiRequest("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history, ...(context ? { context } : {}) }),
  });
}

export async function getMyTeams() { return apiRequest("/teams"); }
export const getTeams = getMyTeams;
export async function createTeam(name) { return apiRequest("/teams", { method: "POST", body: JSON.stringify({ name }) }); }
export async function getMyTeamInvitations() { return apiRequest("/teams/invitations"); }
export async function respondToTeamInvitation(invitationId, accept) { return apiRequest(`/teams/invitations/${encodeURIComponent(invitationId)}/respond`, { method: "POST", body: JSON.stringify({ accept }) }); }
export async function getTeamMembers(teamId) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/members`); }
export async function inviteTeamMember(teamId, email, role) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/invitations`, { method: "POST", body: JSON.stringify({ email, role }) }); }
export async function changeTeamMemberRole(teamId, userId, role) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: JSON.stringify({ role }) }); }
export async function leaveTeam(teamId) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/leave`, { method: "POST" }); }
export async function removeTeamMember(teamId, userId) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }); }
export async function transferTeamOwnership(teamId, userId) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/ownership`, { method: "POST", body: JSON.stringify({ userId }) }); }
export async function getTeamSettings(teamId) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/settings`); }
export async function updateTeamSettings(teamId, settings) { return apiRequest(`/teams/${encodeURIComponent(teamId)}/settings`, { method: "PUT", body: JSON.stringify(settings) }); }
export async function getGitHubRepositories() { return { data: await apiRequest("/github/me/repositories") }; }
export async function startGitHubInstallation(teamId) { return apiRequest(`/github/teams/${encodeURIComponent(teamId)}/installations/start`, { method: "POST" }); }
export async function getTeamGitHubRepositories(teamId) { return apiRequest(`/github/teams/${encodeURIComponent(teamId)}/repositories`); }
export async function connectTeamGitHubRepository(teamId, installationId, repositoryId) { return apiRequest(`/github/teams/${encodeURIComponent(teamId)}/repositories`, { method: "POST", body: JSON.stringify({ installationId, repositoryId }) }); }
export async function getGitHubRepositorySettings(repositoryId) { return apiRequest(`/github/repositories/${encodeURIComponent(repositoryId)}/settings`); }
export async function updateGitHubRepositorySettings(repositoryId, settings) { return apiRequest(`/github/repositories/${encodeURIComponent(repositoryId)}/settings`, { method: "PUT", body: JSON.stringify(settings) }); }
export async function addTeamMember(teamId, member) { return inviteTeamMember(teamId, member.email, member.role); }
export async function updateTeamMemberRole(teamId, memberId, role) { return changeTeamMemberRole(teamId, memberId, role); }

export async function validateSubmission(submissionId) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/validate`, { method: "POST" });
}

export async function getSubmissionValidation(submissionId) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/validation`);
}

export async function getSubmissionDiff(submissionId) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/diff`);
}

export async function requestSubmissionReview(submissionId) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/request-review`, { method: "POST" });
}

export async function getSubmissionReviews(submissionId) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/reviews`);
}

export async function submitSubmissionReview(submissionId, { decision, body }) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ decision, body }),
  });
}

export async function addSubmissionReviewComment(submissionId, reviewId, comment) {
  return apiRequest(`/submissions/${encodeURIComponent(submissionId)}/reviews/${encodeURIComponent(reviewId)}/comments`, {
    method: "POST",
    body: JSON.stringify(comment),
  });
}

export async function getGovernanceRepositories() {
  return apiRequest("/submissions/repositories");
}

export async function getRepositoryBranches(repoId) {
  return apiRequest(`/submissions/repositories/${encodeURIComponent(repoId)}/branches`);
}

export async function getBranchCommits(repoId, branch) {
  return apiRequest(`/submissions/repositories/${encodeURIComponent(repoId)}/commits?branch=${encodeURIComponent(branch)}`);
}

export async function getSubmissions() {
  return apiRequest("/submissions");
}

export async function createSubmission(details) {
  return apiRequest("/submissions", { method: "POST", body: JSON.stringify(details) });
}

export async function createGitHubInstallState() {
  return apiRequest("/github/install-state", { method: "POST" });
}

export async function requestPasswordReset(email) {
  if (!email) throw new Error("An email address is required.");
  return authRequest("/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(token, password) {
  return authRequest("/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
}

export async function changeAccountPassword({ currentPassword, newPassword }) {
  return apiRequest("/users/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function getAccountSettings() {
  return apiRequest("/users/settings");
}

export async function updateAccountSettings(settings) {
  return apiRequest("/users/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export async function updateProfileAvatar(avatarDataUrl) {
  const result = await apiRequest("/users/me", { method: "PATCH", body: JSON.stringify({ avatarDataUrl }) });
  return { user: localUserFromBackend(result.user ?? result) };
}

export async function updateAccountProfile(profile) {
  const result = await apiRequest("/users/me", { method: "PATCH", body: JSON.stringify(profile) });
  return { user: localUserFromBackend(result.user ?? result) };
}

export async function getRepositories() {
  return { data: await apiRequest("/repositories") };
}
export async function getRepository(repoId) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}`) };
}
export async function createRepository(details) {
  return { data: await apiRequest("/repositories", { method: "POST", body: JSON.stringify(details) }) };
}
export async function importZipRepository(file, name) {
  return apiRequest(`/repositories/import?name=${encodeURIComponent(name)}`, {
    method: "POST",
    body: await file.arrayBuffer(),
    headers: { "Content-Type": "application/zip" },
  });
}
export async function updateRepository(repoId, changes) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}`, { method: "PATCH", body: JSON.stringify(changes) }) };
}
export async function deleteRepository(repoId) {
  return apiRequest(`/repositories/${encodeURIComponent(repoId)}`, { method: "DELETE" });
}
export async function getFiles(repoId) { return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}/files`) }; }
export async function getFile(repoId, fileId) { return { data: (await getFiles(repoId)).data.find((file) => file.id === fileId) }; }
export async function createFile(repoId, details) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}/files`, { method: "POST", body: JSON.stringify(details) }) };
}
export async function updateFile(repoId, fileId, changes) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}/files/${encodeURIComponent(fileId)}`, { method: "PATCH", body: JSON.stringify(changes) }) };
}
export async function deleteFile(repoId, fileId) {
  return apiRequest(`/repositories/${encodeURIComponent(repoId)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}
export async function getCommits(repoId) { return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}/commits`) }; }
export async function getCommit(repoId, commitId) { const result = await getCommits(repoId); const commit = result.data.find((entry) => entry.id === commitId); if (!commit) throw new Error("Commit was not found."); return { data: commit }; }
export async function createCommit(repoId, message) {
  return { data: await apiRequest(`/repositories/${encodeURIComponent(repoId)}/commits`, { method: "POST", body: JSON.stringify({ message }) }) };
}
