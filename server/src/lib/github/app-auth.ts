import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

export async function createGitHubAppJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

  if (!appId || !keyPath) {
    throw new Error("GitHub App credentials are not configured.");
  }

  const resolvedKeyPath = path.resolve(process.cwd(), keyPath);
  const privateKeyPem = await readFile(resolvedKeyPath, "utf8");
  const privateKey = createPrivateKey(privateKeyPem);

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 8 * 60)
    .sign(privateKey);
}