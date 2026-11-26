const secretRules = [
  { title: "AWS access key", severity: "critical" as const, pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { title: "GitHub token", severity: "critical" as const, pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { title: "Google/Gemini API key", severity: "critical" as const, pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { title: "Private key", severity: "critical" as const, pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { title: "Credentials in URL", severity: "high" as const, pattern: /https?:\/\/[^\s/:@]+:[^\s/@]+@/gi },
  { title: "Possible API key or secret", severity: "high" as const, pattern: /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})/gi },
];
const textExtensions = new Set(["js", "jsx", "ts", "tsx", "json", "html", "css", "md", "txt", "py", "java", "go", "rs", "cpp", "php", "xml", "yml", "yaml", "toml", "sql", "sh", "env", "gitignore", "dockerfile", "makefile"]);
export interface RepositoryScanFile { path: string; content: string; encoding?: string }
export interface RepositoryFinding { id: string; title: string; severity: "critical" | "high" | "low"; path: string; line: number | null; message: string; recommendation: string }
function getText(file: RepositoryScanFile) { return file.encoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content; }
export function scanRepositoryFiles(files: RepositoryScanFile[]) {
  const findings: RepositoryFinding[] = [];
  const included = files.filter((file) => file.path && !/(^|\/)(node_modules|\.git|dist|build|vendor)(\/|$)/i.test(file.path));
  const scanned = included.filter((file) => { const name = file.path.split("/").pop()?.toLowerCase() ?? ""; return textExtensions.has(name.split(".").pop() ?? "") || /^\.env(?:\..*)?$/.test(name); });
  for (const file of scanned) getText(file).split(/\r?\n/).forEach((line, index) => secretRules.forEach((rule) => {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(line)) findings.push({ id: rule.title + ":" + file.path + ":" + (index + 1), title: rule.title, severity: rule.severity, path: file.path, line: index + 1, message: "A credential pattern matched. Secret value has been redacted.", recommendation: "If real, revoke or rotate it, remove it from repository history, and use environment variables or a secret manager." });
  }));
  const paths = included.map((file) => file.path.toLowerCase());
  for (const name of ["README.md", "LICENSE", ".gitignore"]) if (!paths.some((path) => path === name.toLowerCase() || path.endsWith("/" + name.toLowerCase()))) findings.push({ id: "missing:" + name, title: "Missing " + name, severity: "low", path: name, line: null, message: "No " + name + " file was found.", recommendation: "Add " + name + " to improve repository governance." });
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach((finding) => { counts[finding.severity] += 1; });
  return { findings, counts, scannedFiles: scanned.length, scannedAt: new Date().toISOString() };
}
