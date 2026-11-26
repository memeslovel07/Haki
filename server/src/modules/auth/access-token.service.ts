

import { SignJWT, jwtVerify } from "jose";

const secretValue = process.env.JWT_ACCESS_SECRET;

if (!secretValue) {
  throw new Error("JWT_ACCESS_SECRET is not configured.");
}

const secret = Buffer.from(secretValue, "base64url");

if (secret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must contain at least 32 bytes.");
}

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyAccessToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    return typeof payload.sub === "string"
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}