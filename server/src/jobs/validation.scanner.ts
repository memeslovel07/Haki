
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const GITLEAKS_IMAGE = "zricethezav/gitleaks:v8.24.2";

interface ScannerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  report: string;
}

export async function runGitleaks(
  workspacePath: string,
): Promise<ScannerResult> {
  const reportDirectory = await mkdtemp(
    path.join(os.tmpdir(), "haki-gitleaks-"),
  );

  const reportPath = path.join(reportDirectory, "report.json");

  try {
    const result = await new Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      execFile(
        "docker",
        [
          "run",
          "--rm",
          "--network=none",
          "--memory=512m",
"--memory-swap=512m",
"--pids-limit=128",
"--cpus=1",
          "--read-only",
          "--user=1000:1000",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
          "-v",
          `${workspacePath}:/repo:ro`,
          "-v",
          `${reportDirectory}:/report:rw`,
          GITLEAKS_IMAGE,
          "dir",
          "--no-banner",
          "--timeout=110",
          "--redact",
          "--timeout=90",
          "--report-format=json",
          "--report-path=/report/report.json",
          "/repo",

        ],
        {
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error && typeof error.code === "number") {
            resolve({
              exitCode: error.code,
              stdout,
              stderr,
            });
            return;
          }

          if (error) {
            reject(error);
            return;
          }

          resolve({
            exitCode: 0,
            stdout,
            stderr,
          });
        },
      );
    });

    const report = await readFile(reportPath, "utf8");

    return {
      ...result,
      report,
    };
  } finally {
    await rm(reportDirectory, { recursive: true, force: true });
  }
}
