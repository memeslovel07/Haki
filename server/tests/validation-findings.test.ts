
import { describe, expect, it } from "vitest";
import { parseGitleaksReport } from "../src/jobs/validation.findings.js";

describe("Gitleaks findings parser", () => {
  it("normalizes findings and never includes secret values", () => {
    const report = JSON.stringify([
      {
        RuleID: "haki-test-secret",
        Description: "Detects a test-only marker",
        StartLine: 1,
        File: "/repo/secret-test.txt",
        Secret: "ACTUAL_SECRET_VALUE",
        Match: "ACTUAL_SECRET_VALUE",
      },
    ]);

    const findings = parseGitleaksReport(report);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tool: "gitleaks",
      ruleId: "haki-test-secret",
      severity: "HIGH",
      title: "haki-test-secret",
      filePath: "secret-test.txt",
      line: 1,
    });

    expect(findings[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(findings)).not.toContain("ACTUAL_SECRET_VALUE");
  });

  it("generates the same fingerprint for the same finding", () => {
    const report = JSON.stringify([
      {
        RuleID: "test-rule",
        File: "/repo/file.txt",
        StartLine: 5,
      },
    ]);

    const first = parseGitleaksReport(report);
    const second = parseGitleaksReport(report);

    expect(first[0].fingerprint).toBe(second[0].fingerprint);
  });

  it("returns an empty array for a clean report", () => {
    expect(parseGitleaksReport("[]")).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseGitleaksReport("invalid")).toThrow();
  });

  it("rejects non-array reports", () => {
    expect(() => parseGitleaksReport("{}")).toThrow(
      "Invalid Gitleaks report.",
    );
  });
});
