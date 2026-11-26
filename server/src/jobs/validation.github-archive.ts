import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";

const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

export async function downloadValidationArchive(
  owner: string,
  repo: string,
  commitSha: string,
  accessToken: string,
  destinationPath: string,
): Promise<void> {
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error("Invalid commit SHA.");
  }

  if (!owner || !repo || !accessToken) {
    throw new Error("Missing GitHub archive download parameters.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${commitSha}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok || !response.body) {
    throw new Error("Failed to download repository archive.");
  }

  const contentLength = response.headers.get("content-length");

  if (contentLength && Number(contentLength) > MAX_ARCHIVE_SIZE) {
    throw new Error("Repository archive exceeds size limit.");
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });

  let actualSize = 0;

  const sizeLimit = new Transform({
    transform(chunk, _encoding, callback) {
      actualSize += chunk.length;

      if (actualSize > MAX_ARCHIVE_SIZE) {
        callback(new Error("Repository archive exceeds size limit."));
        return;
      }

      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as any),
    sizeLimit,
    createWriteStream(destinationPath, { flags: "wx" }),
  );
}