import yauzl from "yauzl";

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 1_500_000;
const MAX_FILE_BYTES = 250_000;
const MAX_FILES = 1_500;
const extensions = new Set(["js", "jsx", "ts", "tsx", "json", "html", "css", "scss", "md", "txt", "py", "java", "go", "rs", "c", "cpp", "h", "php", "xml", "yml", "yaml", "toml", "sql", "sh", "env", "gitignore"]);
function isTextFile(path: string) {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  return extensions.has(name.split(".").pop() ?? "") || /^\.env(?:\..*)?$/.test(name) || name === "makefile" || name === "dockerfile";
}
function readEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => {
    if (error || !stream) return reject(error ?? new Error("Unable to read ZIP entry."));
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  }));
}
export function extractTextFilesFromZip(buffer: Buffer): Promise<Array<{ path: string; name: string; content: string; size: number }>> {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_ARCHIVE_BYTES) return Promise.reject(new Error("ZIP must be smaller than 10 MB."));
  return new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
    if (error || !zip) return reject(new Error("This ZIP file could not be opened."));
    const files: Array<{ path: string; name: string; content: string; size: number }> = [];
    const seen = new Set<string>();
    let totalBytes = 0; let count = 0; let settled = false;
    const fail = (message: string) => { if (settled) return; settled = true; zip.close(); reject(new Error(message)); };
    zip.on("error", () => fail("This ZIP file is invalid."));
    zip.on("end", () => { if (!settled) { settled = true; resolve(files); } });
    zip.on("entry", (entry) => {
      const filePath: string = String(entry.fileName).replace(/\\/g, "/");
      const parts: string[] = filePath.split("/");
      const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (filePath.endsWith("/") || mode === 0o120000) return zip.readEntry();
      if (filePath.startsWith("/") || parts.some((part) => part === ".." || part === "")) return fail("ZIP contains an unsafe file path.");
      if (/(^|\/)(node_modules|\.git|dist|build|vendor|\.next)(\/|$)/i.test(filePath) || !isTextFile(filePath)) return zip.readEntry();
      if (seen.has(filePath)) return fail("ZIP contains duplicate file paths.");
      if (++count > MAX_FILES) return fail("ZIP contains too many files.");
      if (entry.uncompressedSize > MAX_FILE_BYTES || totalBytes + entry.uncompressedSize > MAX_TEXT_BYTES) return fail("Text files in ZIP exceed HAKI's 1.5 MB import limit.");
      readEntry(zip, entry).then((content) => { totalBytes += content.length; seen.add(filePath); files.push({ path: filePath, name: parts[parts.length - 1], content: content.toString("utf8"), size: content.length }); zip.readEntry(); }).catch(() => fail("HAKI could not read a file inside this ZIP."));
    });
    zip.readEntry();
  }));
}
