
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

const MAX_ENTRIES = 2000;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

function isUnsafeWindowsPathComponent(part: string): boolean {
  return (
    part.includes(":") ||
    /[ .]$/.test(part) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part)
  );
}

export async function extractValidationArchive(
  archivePath: string,
  workspacePath: string,
): Promise<void> {
  const root = path.resolve(workspacePath);
  let totalSize = 0;
let actualTotalSize = 0;
  let entryCount = 0;
  let archiveRoot: string | undefined;

  const zip = await yauzl.openPromise(archivePath);

  try {
    for await (const entry of zip.eachEntry()) {
      entryCount++;

      if (entryCount > MAX_ENTRIES) {
        throw new Error("Archive contains too many entries.");
      }

      const name = entry.fileName.replace(/\\/g, "/");

      if (
        name.startsWith("/") ||
        name.includes("\0") ||
        /^[a-zA-Z]:/.test(name)
      ) {
        throw new Error("Unsafe archive entry path.");
      }

      const parts = name.split("/").filter(Boolean);
if (
  parts.length === 0 ||
  parts.some(
    (part) =>
      part === "." ||
      part === ".." ||
      isUnsafeWindowsPathComponent(part),
  )
) {
  throw new Error("Unsafe archive entry path.");
}

      if (!archiveRoot) {
        archiveRoot = parts[0];
      }

      if (parts[0] !== archiveRoot) {
        throw new Error("Unexpected archive structure.");
      }

      const relativePath = parts.slice(1).join("/");

      if (!relativePath) {
        continue;
      }

      const destination = path.resolve(root, relativePath);

      if (!destination.startsWith(`${root}${path.sep}`)) {
        throw new Error("Archive entry escapes workspace.");
      }

      const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
      const fileType = mode & 0o170000;

      if (fileType === 0o120000) {
        throw new Error("Archive symlinks are not allowed.");
      }

      if (name.endsWith("/")) {
        await mkdir(destination, { recursive: true });
        continue;
      }

      if (entry.uncompressedSize > MAX_FILE_SIZE) {
        throw new Error("Archive file exceeds size limit.");
      }

      totalSize += entry.uncompressedSize;

      if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error("Archive exceeds total extraction limit.");
      }

      await mkdir(path.dirname(destination), { recursive: true });

      const stream = await zip.openReadStreamPromise(entry);
      let actualSize = 0;

    const sizeLimit = new Transform({
  transform(chunk, _encoding, callback) {
    actualSize += chunk.length;
    actualTotalSize += chunk.length;

    if (actualSize > MAX_FILE_SIZE) {
      callback(new Error("Archive file exceeds size limit."));
      return;
    }

    if (actualTotalSize > MAX_TOTAL_SIZE) {
      callback(new Error("Archive exceeds total extraction limit."));
      return;
    }

    callback(null, chunk);
  },
});

      await pipeline(
        stream,
        sizeLimit,
        createWriteStream(destination, { flags: "wx" }),
      );
    }
  } finally {
    zip.close();
  }
}
