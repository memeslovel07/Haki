import { randomBytes } from "node:crypto";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

export function createOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function getGitHubAuthorizationUrl(state: string): string {
  if (!clientId) {
    throw new Error("GitHub OAuth is not configured.");
  }

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  return url.toString();
}

function getCallbackUrl(): string {
  return "http://localhost:5001/api/v1/auth/github/callback";
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
      redirect_uri: getCallbackUrl(),
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

  return emails.find((email) => email.primary && email.verified)?.email ?? null;
}
