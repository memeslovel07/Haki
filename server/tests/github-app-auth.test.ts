import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jwtVerify } from "jose";
import { createGitHubAppJwt } from "../src/lib/github/app-auth.js";

describe("GitHub App authentication", () => {
  it("creates a valid short-lived GitHub App JWT", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "haki-github-test-"),
    );

    const keyPath = path.join(tempDir, "private.pem");

    await writeFile(keyPath, privateKey.export({
      type: "pkcs8",
      format: "pem",
    }));

    const previousAppId = process.env.GITHUB_APP_ID;
    const previousKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_PRIVATE_KEY_PATH = keyPath;

    try {
      const token = await createGitHubAppJwt();

      const { payload, protectedHeader } = await jwtVerify(
        token,
        publicKey,
      );

      expect(protectedHeader.alg).toBe("RS256");
      expect(payload.iss).toBe("123456");
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp! - payload.iat!).toBe(9 * 60);
    } finally {
      if (previousAppId === undefined) {
        delete process.env.GITHUB_APP_ID;
      } else {
        process.env.GITHUB_APP_ID = previousAppId;
      }

      if (previousKeyPath === undefined) {
        delete process.env.GITHUB_APP_PRIVATE_KEY_PATH;
      } else {
        process.env.GITHUB_APP_PRIVATE_KEY_PATH = previousKeyPath;
      }

      await rm(tempDir, { recursive: true, force: true });
    }
  });
});