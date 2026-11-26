
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { runSemgrep } from "../src/jobs/validation.semgrep.js";

describe("runSemgrep", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns exit code 0 for a clean scan", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, '{"results":[]}', "");
    });

    const result = await runSemgrep("D:/haki-test-workspace");

    expect(result.exitCode).toBe(0);
    expect(result.report).toBe('{"results":[]}');
  });

  it("returns exit code 1 when findings are detected", async () => {
    const report = '{"results":[{"check_id":"test-rule"}]}';

    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(Object.assign(new Error("findings detected"), { code: 1 }), report, "");
    });

    const result = await runSemgrep("D:/haki-test-workspace");

    expect(result.exitCode).toBe(1);
    expect(result.report).toContain("test-rule");
  });

  it("rejects when Docker execution fails", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(
        Object.assign(new Error("Docker unavailable"), { code: "ENOENT" }),
        "",
        "",
      );
    });

    await expect(
      runSemgrep("D:/haki-test-workspace"),
    ).rejects.toThrow();
  });

  it("rejects when execution times out", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(
        Object.assign(new Error("Timed out"), { code: "ETIMEDOUT" }),
        "",
        "",
      );
    });

    await expect(
      runSemgrep("D:/haki-test-workspace"),
    ).rejects.toThrow();
  });
});
