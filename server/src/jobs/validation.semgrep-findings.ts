
import { createHash } from "node:crypto";

interface SemgrepFinding {
  check_id?: string;
  path?: string;
  start?: { line?: number };
  extra?: {
    message?: string;
    severity?: string;
  };
}

interface SemgrepReport {
  results?: SemgrepFinding[];
}

export interface ParsedSemgrepFinding {
  tool: string;
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  filePath: string;
  line: number | null;
  fingerprint: string;
}

function normalizeSeverity(severity?: string): ParsedSemgrepFinding["severity"] {
  switch (severity?.toUpperCase()) {
    case "ERROR":
      return "HIGH";
    case "WARNING":
      return "MEDIUM";
    case "INFO":
      return "LOW";
    default:
      return "LOW";
  }
}

export function parseSemgrepReport(report: string): ParsedSemgrepFinding[] {
  const parsed = JSON.parse(report) as SemgrepReport;

  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error("Invalid Semgrep report.");
  }

  return parsed.results.map((finding) => {
    const filePath = (finding.path ?? "")
      .replace(/^\/src\//, "")
      .replace(/^\/repo\//, "")
      .replace(/\\/g, "/");

    const ruleId = finding.check_id ?? "unknown";
    const line = finding.start?.line ?? null;

    const fingerprint = createHash("sha256")
      .update(`${ruleId}:${filePath}:${line ?? 0}`)
      .digest("hex");

    return {
      tool: "semgrep",
      ruleId,
      severity: normalizeSeverity(finding.extra?.severity),
      title: ruleId,
      description: finding.extra?.message ?? "Code issue detected.",
      filePath,
      line,
      fingerprint,
    };
  });
}
