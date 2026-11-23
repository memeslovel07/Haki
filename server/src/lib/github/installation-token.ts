import { createGitHubAppJwt } from "./app-auth.js";

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

export async function createInstallationAccessToken(
  installationId: string,
): Promise<InstallationTokenResponse> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid GitHub installation ID.");
  }

  const jwt = await createGitHubAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create GitHub installation access token.");
  }

  const data = (await response.json()) as InstallationTokenResponse;

  if (!data.token || !data.expires_at) {
    throw new Error("Invalid GitHub installation token response.");
  }

  return data;
}