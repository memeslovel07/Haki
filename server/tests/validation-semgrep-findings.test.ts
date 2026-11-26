
import { describe, expect, it } from "vitest";
import { parseSemgrepReport } from "../src/jobs/validation.semgrep-findings.js";

describe("parseSemgrepReport", () => {
  it("normalizes Semgrep findings", () => {
    const report = JSON.stringify({
      results: [
        {
          check_id: "haki-eval-usage",
          path: "/src/app.js",
          start: { line: 12 },
          extra: {
            message: "Avoid eval() because it can execute untrusted code.",
            severity: "ERROR",
          },
        },
      ],
      errors: [],
    });

    const findings = parseSemgrepReport(report);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tool: "semgrep",
      ruleId: "haki-eval-usage",
      severity: "HIGH",
      title: "haki-eval-usage",
      description: "Avoid eval() because it can execute untrusted code.",
      filePath: "app.js",
      line: 12,
    });
    expect(findings[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps WARNING and INFO severities", () => {
    const report = JSON.stringify({
      results: [
        {
          check_id: "warning-rule",
          path: "/src/a.js",
          start: { line: 1 },
          extra: { message: "Warning", severity: "WARNING" },
        },
        {
          check_id: "info-rule",
          path: "/src/b.js",
          start: { line: 2 },
          extra: { message: "Info", severity: "INFO" },
        },
      ],
      errors: [],
    });

    const findings = parseSemgrepReport(report);

    expect(findings.map((f) => f.severity)).toEqual(["MEDIUM", "LOW"]);
  });

  it("returns an empty array for clean reports", () => {
    expect(
      parseSemgrepReport(JSON.stringify({ results: [], errors: [] })),
    ).toEqual([]);
  });

  it("generates deterministic fingerprints", () => {
    const report = JSON.stringify({
      results: [
        {
          check_id: "rule-a",
          path: "/src/app.js",
          start: { line: 5 },
          extra: { message: "Test", severity: "ERROR" },
        },
      ],
      errors: [],
    });

    expect(parseSemgrepReport(report)[0].fingerprint).toBe(
      parseSemgrepReport(report)[0].fingerprint,
    );
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSemgrepReport("invalid")).toThrow();
  });

  it("rejects invalid report structures", () => {
    expect(() => parseSemgrepReport(JSON.stringify({ results: "invalid" })))
      .toThrow();
  });
});
