import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock, mkdtempMock, readFileMock, rmMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  mkdtempMock: vi.fn(),
  readFileMock: vi.fn(),
  rmMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: mkdtempMock,
  readFile: readFileMock,
  rm: rmMock,
}));

import { runGitleaks } from "../src/jobs/validation.scanner.js";

describe("runGitleaks", () => {
  beforeEachSetup();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns exit code 0 for a clean scan", async () => {
    readFileMock.mockResolvedValue("[]");

    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, "clean", "");
    });

    const result = await runGitleaks("D:/haki-test-workspace");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("clean");
    expect(result.report).toBe("[]");
  });

  it("returns exit code 1 when leaks are detected", async () => {
    readFileMock.mockResolvedValue('[{"RuleID":"test-rule"}]');

    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(Object.assign(new Error("leaks found"), { code: 1 }), "", "");
    });

    const result = await runGitleaks("D:/haki-test-workspace");

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
      runGitleaks("D:/haki-test-workspace"),
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
      runGitleaks("D:/haki-test-workspace"),
    ).rejects.toThrow();
  });
});

function beforeEachSetup() {
  mkdtempMock.mockResolvedValue("D:/haki-scanner-temp");
  readFileMock.mockResolvedValue("[]");
  rmMock.mockResolvedValue(undefined);
}