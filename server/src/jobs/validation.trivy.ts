
import { execFile } from "node:child_process";
import path from "node:path";

const TRIVY_IMAGE = "aquasec/trivy:0.58.2";
const TRIVY_CACHE = path.resolve(
  process.cwd(),
  "../infrastructure/data/trivy-cache",
);

interface TrivyResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  report: string;
}

export async function runTrivy(workspacePath: string): Promise<TrivyResult> {
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

        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
        "-v",
        `${workspacePath}:/src:ro`,
        "-v",
        `${TRIVY_CACHE}:/cache:rw`,
        TRIVY_IMAGE,
        "--cache-dir=/cache",
        "fs",
        "--scanners=vuln",
        "--skip-db-update",
        "--timeout=90s",
        "--format=json",
        "--quiet",
        "/src",
      ],
      {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code === "number") {
          resolve({ exitCode: error.code, stdout, stderr });
          return;
        }
        if (error) reject(error);
        else resolve({ exitCode: 0, stdout, stderr });
      },
    );
  });

  return {
    ...result,
    report: result.stdout,
  };
}
