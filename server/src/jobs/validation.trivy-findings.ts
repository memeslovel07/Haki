
import { createHash } from "node:crypto";

interface TrivyVulnerability {
  VulnerabilityID?: string;
  PkgName?: string;
  Severity?: string;
  Title?: string;
  Description?: string;
}

interface TrivyResult {
  Target?: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyReport {
  Results?: TrivyResult[];
}

export interface ParsedTrivyFinding {
  tool: string;
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  filePath: string;
  line: number | null;
  fingerprint: string;
}

function normalizeSeverity(
  severity?: string,
): ParsedTrivyFinding["severity"] {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    case "LOW":
      return "LOW";
    default:
      return "LOW";
  }
}

export function parseTrivyReport(report: string): ParsedTrivyFinding[] {
  const parsed = JSON.parse(report) as TrivyReport;

  if (!parsed || !Array.isArray(parsed.Results)) {
    throw new Error("Invalid Trivy report.");
  }

  return parsed.Results.flatMap((result) =>
    (result.Vulnerabilities ?? []).map((vulnerability) => {
      const filePath = (result.Target ?? "")
        .replace(/^\/src\//, "")
        .replace(/^\/repo\//, "")
        .replace(/\\/g, "/");

      const ruleId = vulnerability.VulnerabilityID ?? "unknown";
      const title =
        vulnerability.Title ??
        `${ruleId} in ${vulnerability.PkgName ?? "unknown package"}`;

      const fingerprint = createHash("sha256")
        .update(`${ruleId}:${filePath}:0`)
        .digest("hex");

      return {
        tool: "trivy",
        ruleId,
        severity: normalizeSeverity(vulnerability.Severity),
        title,
        description: vulnerability.Description ?? title,
        filePath,
        line: null,
        fingerprint,
      };
    }),
  );
}
