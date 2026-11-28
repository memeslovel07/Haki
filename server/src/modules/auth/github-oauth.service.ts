import { randomBytes } from "node:crypto";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
const callbackUrl = process.env.GITHUB_OAUTH_REDIRECT_URI || new URL(
  "/api/v1/auth/github/callback",
  process.env.FRONTEND_ORIGIN || "http://localhost:5173",
).toString();

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(clientId && clientSecret);
}

export function createOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function getGitHubAuthorizationUrl(state: string): string {
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured.");
  }

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeGitHubCode(code: string) {
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured.");
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new Error("GitHub token exchange failed.");
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!data.access_token || data.error) {
    throw new Error("GitHub token exchange failed.");
  }

  return data.access_token;
}

export async function getGitHubUser(accessToken: string) {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub user.");
  }

  return (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
  };
}

export async function getVerifiedGitHubEmail(accessToken: string) {
  const response = await fetch(`${GITHUB_API_URL}/user/emails`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub email.");
  }

  const emails = (await response.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  return emails.find((email) => email.primary && email.verified)?.email.trim().toLowerCase() ?? null;
}

export async function getPublicGitHubRepositories(username: string) {
  const repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    description: string | null;
    default_branch: string;
    updated_at: string;
    owner: { login: string };
  }> = [];

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`${GITHUB_API_URL}/users/${encodeURIComponent(username)}/repos`);
    url.searchParams.set("type", "owner");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GitHub repository listing failed (${response.status}).`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("GitHub returned an invalid repository list.");
    repositories.push(...data);
    if (data.length < 100) break;
  }

  return repositories
    .filter((repository) => !repository.private)
    .map(({ id, name, full_name, private: isPrivate, html_url, description, default_branch, updated_at, owner }) => ({
      id,
      name,
      fullName: full_name,
      private: isPrivate,
      htmlUrl: html_url,
      description,
      defaultBranch: default_branch,
      updatedAt: updated_at,
      ownerLogin: owner.login,
    }));
}
