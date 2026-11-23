
import { execFile } from "node:child_process";
import path from "node:path";

const SEMGREP_IMAGE = "semgrep/semgrep:1.186.0";

interface SemgrepResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  report: string;
}

export async function runSemgrep(
  workspacePath: string,
): Promise<SemgrepResult> {
  const rulesPath = path.resolve(process.cwd(), "src/jobs/semgrep-rules");

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
        "--tmpfs=/home/semgrep:rw,noexec,nosuid,size=64m,uid=1000,gid=1000,mode=700",
        "-v",
        `${workspacePath}:/src:ro`,
        "-v",
        `${rulesPath}:/rules:ro`,
        SEMGREP_IMAGE,
        "semgrep",
        "scan",
        "--config=/rules/haki.yml",
        "--json",
        "--quiet",
        "--metrics=off",
        "--error",
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
