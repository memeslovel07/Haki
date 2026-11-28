const transientDatabaseCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "P1001",
  "P1002",
  "P1017",
]);

export function isTransientDatabaseError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof value.code === "string" && transientDatabaseCodes.has(value.code)) return true;
    if (typeof value.message === "string" && /unable to start a transaction in the given time/i.test(value.message)) return true;
    current = value.cause;
  }

  return false;
}
