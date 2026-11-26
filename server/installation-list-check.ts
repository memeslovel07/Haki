import "dotenv/config";
import { createGitHubAppJwt } from "./src/lib/github/app-auth.ts";

const jwt = await createGitHubAppJwt();

const response = await fetch("https://api.github.com/app/installations", {
  headers: {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

if (!response.ok) {
  console.log("Failed:", response.status);
  process.exit(1);
}

const installations = await response.json();

for (const installation of installations) {
  console.log({
    id: installation.id,
    account: installation.account?.login,
    type: installation.account?.type,
  });
}
