import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to start the HAKI API.");

// pg-connection-string is warning that implicit SSL aliases will change in
// a future major version. Pin the current, certificate-verifying behavior.
const connectionUrl = new URL(databaseUrl);
if (!connectionUrl.searchParams.has("sslmode")) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
} else if (["prefer", "require", "verify-ca"].includes(connectionUrl.searchParams.get("sslmode") || "")) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}

const adapter = new PrismaPg({ connectionString: connectionUrl.toString() });

export const prisma = new PrismaClient({ adapter });
