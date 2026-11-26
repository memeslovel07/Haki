
import { createHash } from "node:crypto";

interface GitleaksFinding {
  RuleID?: string;
  Description?: string;
  StartLine?: number;
  File?: string;
  Fingerprint?: string;
}

export interface ParsedValidationFinding {
  tool: string;
  ruleId: string;
  severity: "HIGH";
  title: string;
  description: string;
  filePath: string;
  line: number | null;
  fingerprint: string;
}

export function parseGitleaksReport(
  report: string,
): ParsedValidationFinding[] {
  const findings = JSON.parse(report) as GitleaksFinding[];

  if (!Array.isArray(findings)) {
    throw new Error("Invalid Gitleaks report.");
  }

  return findings.map((finding) => {
    const filePath = (finding.File ?? "")
      .replace(/^\/repo\//, "")
      .replace(/\\/g, "/");

    const ruleId = finding.RuleID ?? "unknown";

    const fingerprint = createHash("sha256")
      .update(
        `${ruleId}:${filePath}:${finding.StartLine ?? 0}`,
      )
      .digest("hex");

    return {
      tool: "gitleaks",
      ruleId,
      severity: "HIGH",
      title: ruleId,
      description: finding.Description ?? "Secret detected.",
      filePath,
      line: finding.StartLine ?? null,
      fingerprint,
    };
  });
}
