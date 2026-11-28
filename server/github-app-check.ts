import "dotenv/config";
import { createGitHubAppJwt } from "./src/lib/github/app-auth.ts";

const jwt = await createGitHubAppJwt();

const response = await fetch("https://api.github.com/app", {
  headers: {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

console.log("GitHub App authentication:", response.status === 200 ? "SUCCESS" : "FAILED");
console.log("HTTP status:", response.status);
