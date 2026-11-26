import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const environmentKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_ACCESS_SECRET",
  "FRONTEND_ORIGIN",
  "NODE_ENV",
];

for (const key of environmentKeys) {
  delete process.env[key];
}

const envPath = fileURLToPath(
  new URL("../.env.test", import.meta.url)
);

const result = dotenv.config({
  path: envPath,
  override: true,
});

if (result.error) {
  throw new Error("Unable to load server/.env.test.");
}

if (process.env.HAKI_TEST_DATABASE !== "true") {
  throw new Error("Refusing to run tests without the test database marker.");
}

for (const key of environmentKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in server/.env.test.`);
  }
}

if (process.env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be test.");
}