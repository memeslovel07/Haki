
import { describe, expect, it } from "vitest";
import { parseTrivyReport } from "../src/jobs/validation.trivy-findings.js";

describe("parseTrivyReport", () => {
  it("parses vulnerability findings and normalizes paths and severity", () => {
    const report = JSON.stringify({
      Results: [
        {
          Target: "/src/package-lock.json",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2026-1234",
              PkgName: "test-package",
              Severity: "CRITICAL",
              Title: "Test vulnerability",
              Description: "Test description",
            },
          ],
        },
      ],
    });

    const findings = parseTrivyReport(report);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tool: "trivy",
      ruleId: "CVE-2026-1234",
      severity: "CRITICAL",
      title: "Test vulnerability",
      description: "Test description",
      filePath: "package-lock.json",
      line: null,
    });
    expect(findings[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps all supported severities", () => {
    const report = JSON.stringify({
      Results: [
        {
          Target: "package.json",
          Vulnerabilities: [
            { VulnerabilityID: "1", Severity: "LOW" },
            { VulnerabilityID: "2", Severity: "MEDIUM" },
            { VulnerabilityID: "3", Severity: "HIGH" },
            { VulnerabilityID: "4", Severity: "CRITICAL" },
            { VulnerabilityID: "5", Severity: "UNKNOWN" },
          ],
        },
      ],
    });

    expect(parseTrivyReport(report).map((finding) => finding.severity)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
      "LOW",
    ]);
  });

  it("returns an empty array when no vulnerabilities are found", () => {
    expect(
      parseTrivyReport(JSON.stringify({ Results: [{ Target: "package.json" }] })),
    ).toEqual([]);
  });

  it("returns an empty array for empty results", () => {
    expect(parseTrivyReport(JSON.stringify({ Results: [] }))).toEqual([]);
  });

  it("rejects invalid report structures", () => {
    expect(() => parseTrivyReport(JSON.stringify({}))).toThrow(
      "Invalid Trivy report.",
    );
    expect(() => parseTrivyReport(JSON.stringify({ Results: "invalid" }))).toThrow(
      "Invalid Trivy report.",
    );
  });

  it("rejects malformed JSON", () => {
    expect(() => parseTrivyReport("invalid-json")).toThrow();
  });
});
