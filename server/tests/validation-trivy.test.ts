
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { runTrivy } from "../src/jobs/validation.trivy.js";

describe("runTrivy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns exit code 0 for a clean scan", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, "{}", "");
    });

    const result = await runTrivy("/workspace");

    expect(result.exitCode).toBe(0);
    expect(result.report).toBe("{}");
  });

  it("returns exit code 1 when findings are detected", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      const error = Object.assign(new Error("exit code 1"), { code: 1 });
      callback(error, "report", "");
    });

    const result = await runTrivy("/workspace");

    expect(result.exitCode).toBe(1);
    expect(result.report).toBe("report");
  });

  it("rejects Docker execution failures", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(Object.assign(new Error("Docker unavailable"), { code: "ENOENT" }));
    });

    await expect(runTrivy("/workspace")).rejects.toThrow("Docker unavailable");
  });

  it("rejects execution timeouts", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    });

    await expect(runTrivy("/workspace")).rejects.toThrow("timeout");
  });
});
