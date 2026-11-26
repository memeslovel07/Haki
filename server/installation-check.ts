import "dotenv/config";
import { createInstallationAccessToken } from "./src/lib/github/installation-token.ts";

const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

if (!installationId) {
  console.log("GITHUB_APP_INSTALLATION_ID: NOT CONFIGURED");
  process.exit(1);
}

const result = await createInstallationAccessToken(installationId);
console.log("Installation token generation: SUCCESS");
console.log("Token expiry:", result.expires_at);
