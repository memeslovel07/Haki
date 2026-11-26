#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_API_URL = "http://localhost:5000";
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";
const CONFIG_DIR = path.join(homedir(), ".config", "haki");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

type Config = { apiUrl: string; accessToken?: string; refreshCookie?: string };
type ApiResult = { status: number; body: any; headers: Headers };

function apiUrl(value?: string) {
  const url = (value ?? process.env.HAKI_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) throw new Error("API URL must start with http:// or https://.");
  return url;
}

async function loadConfig(): Promise<Config> {
  try {
    const config = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Config;
    return { ...config, apiUrl: apiUrl(process.env.HAKI_API_URL ?? config.apiUrl) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`Could not read ${CONFIG_PATH}. Run "haki login" to configure the CLI.`);
    return { apiUrl: apiUrl() };
  }
}

async function saveConfig(config: Config) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const tempPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(tempPath, 0o600);
  await rename(tempPath, CONFIG_PATH);
  await chmod(CONFIG_DIR, 0o700);
}

async function request(config: Config, endpoint: string, options: RequestInit = {}): Promise<ApiResult> {
  const headers = new Headers(options.headers);
  if (endpoint.startsWith("/api/v1/auth/")) headers.set("Origin", process.env.HAKI_FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN);
  if (config.accessToken) headers.set("Authorization", `Bearer ${config.accessToken}`);
  if (config.refreshCookie) headers.set("Cookie", config.refreshCookie);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error(`Could not connect to ${config.apiUrl}. Check the API URL and make sure the HAKI server is running.`);
  }
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

function refreshCookieFrom(result: ApiResult): string | undefined {
  const setCookie = result.headers.get("set-cookie");
  const match = setCookie?.match(/(?:^|,\s*)haki_refresh=([^;,]+)/);
  return match ? `haki_refresh=${match[1]}` : undefined;
}

async function authenticatedRequest(config: Config, endpoint: string, options: RequestInit = {}) {
  let result = await request(config, endpoint, options);
  if (result.status === 401 && config.refreshCookie) {
    const refreshed = await request(config, "/api/v1/auth/refresh", { method: "POST" });
    if (refreshed.status === 200 && refreshed.body?.data?.accessToken) {
      config.accessToken = refreshed.body.data.accessToken;
      config.refreshCookie = refreshCookieFrom(refreshed) ?? config.refreshCookie;
      await saveConfig(config);
      result = await request(config, endpoint, options);
    }
  }
  return result;
}

function showResult(result: ApiResult) {
  if (result.body?.success === false || result.status >= 400) {
    const message = result.body?.error?.message ?? result.body?.error?.code ?? `Request failed (${result.status}).`;
    throw new Error(message);
  }
  console.log(JSON.stringify(result.body?.data ?? result.body, null, 2));
}

function usage() {
  console.log(`HAKI CLI — version control and code governance\n\nUsage:\n  haki [--api <url>] <command> [arguments]\n\nCommands:\n  login [--api <url>]                         Sign in to HAKI\n  logout                                      Sign out and clear saved credentials\n  whoami                                      Show the signed-in account\n  connect                                     Print the GitHub App installation URL\n  repositories                                List connected GitHub repositories\n  branches <repository-id>                   List branches and current commit SHAs\n  submissions [repository-id]                List submissions\n  submission <submission-id>                 Show submission checks and reviews\n  submit <repository-id> --title <text> --source <branch> --target <branch> --base-sha <sha> --head-sha <sha>\n                                              Create a governance submission\n  validate <submission-id>                   Run governance checks for a submission\n  validation <submission-id>                 Show the latest validation result\n  request-review <submission-id>              Request a review after validation passes\n  reviews <submission-id>                     Show review history\n  review <submission-id> <decision> [message] Submit APPROVED, CHANGES_REQUESTED, REJECTED, or COMMENTED\n  comment <submission-id> <review-id> <file> <line> <message>\n                                              Add an inline review comment\n  help                                        Show this help\n\nConfiguration:\n  HAKI_API_URL sets the API base URL (default: ${DEFAULT_API_URL}).`);
  console.log("Additional command: haki register");
  console.log(`HAKI_FRONTEND_ORIGIN sets the allowed auth origin (default: ${DEFAULT_FRONTEND_ORIGIN}).`);
  console.log("Git commands: haki init | clone | status | add | commit | push | pull | branch | log | diff | git <arguments>");
}

function runGit(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: "inherit", shell: false });
    child.once("error", () => reject(new Error("Git was not found. Install Git and make sure it is available on PATH.")));
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        process.exitCode = code ?? 1;
        if (signal) reject(new Error(`Git stopped (${signal}).`));
        else resolve();
      }
    });
  });
}

async function askHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    const rl = createInterface({ input: stdin, output: stdout });
    try { return await rl.question(prompt); } finally { rl.close(); }
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const key of chunk.toString("utf8")) {
        if (key === "\u0003") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); reject(new Error("Cancelled.")); return;
        }
        if (key === "\r" || key === "\n") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); resolve(value); return;
        }
        if (key === "\u007f" || key === "\b") value = value.slice(0, -1);
        else if (key >= " ") value += key;
      }
    };
    stdin.on("data", onData);
  });
}

async function askCredentials() {
  const rl = createInterface({ input: stdin, output: stdout });
  const email = (await rl.question("Email: ")).trim();
  rl.close();
  const password = await askHidden("Password: ");
  if (!email || !password) throw new Error("Email and password are required.");
  return { email, password };
}

function requireArgs(args: string[], count: number, usageText: string) {
  if (args.length < count) throw new Error(`Usage: ${usageText}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === "help" || args[0] === "--help" || args[0] === "-h") return usage();

  let requestedApi: string | undefined;
  const apiIndex = args.indexOf("--api");
  if (apiIndex !== -1) {
    requestedApi = args[apiIndex + 1];
    if (!requestedApi) throw new Error("--api requires a URL.");
    args.splice(apiIndex, 2);
  }
  const command = args.shift();
  const gitCommands = new Set(["init", "clone", "status", "add", "restore", "commit", "branch", "checkout", "switch", "log", "diff", "fetch", "pull", "push", "remote", "reset", "merge", "rebase", "tag", "stash", "show", "rev-parse"]);
  if (command === "git") return runGit(args);
  if (command && gitCommands.has(command)) return runGit([command, ...args]);
  if (command === "--version" || command === "version") {
    console.log("haki 0.1.0");
    return;
  }
  const config = await loadConfig();
  if (requestedApi) config.apiUrl = apiUrl(requestedApi);

  if (command === "register") {
    const { email, password } = await askCredentials();
    const registered = await request(config, "/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
    if (registered.status >= 400) return showResult(registered);
    const result = await request(config, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (result.status >= 400 || !result.body?.data?.accessToken) return showResult(result);
    config.accessToken = result.body.data.accessToken;
    config.refreshCookie = refreshCookieFrom(result);
    await saveConfig(config);
    console.log(`Account created. Signed in as ${result.body.data.user.email}.`);
    return;
  }

  if (command === "login") {
    const { email, password } = await askCredentials();
    const result = await request(config, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (result.status >= 400 || !result.body?.data?.accessToken) return showResult(result);
    config.accessToken = result.body.data.accessToken;
    config.refreshCookie = refreshCookieFrom(result);
    await saveConfig(config);
    console.log(`Signed in as ${result.body.data.user.email}. Credentials saved to ${CONFIG_PATH}.`);
    return;
  }

  if (command === "logout") {
    try {
      if (config.accessToken) await authenticatedRequest(config, "/api/v1/auth/logout", { method: "POST" });
    } catch {
      console.warn("The server could not revoke the session; local credentials will still be removed.");
    }
    await rm(CONFIG_PATH, { force: true });
    console.log("Signed out. Saved credentials removed.");
    return;
  }

  if (command === "whoami") {
    if (!config.accessToken) throw new Error("You are not signed in. Run `haki login` first.");
    const result = await authenticatedRequest(config, "/api/v1/users/me");
    if (result.status >= 400) throw new Error(result.body?.error?.message ?? "Session expired. Run `haki login` again.");
    showResult(result);
    return;
  }

  if (command === "connect") {
    if (!config.accessToken) throw new Error("You are not signed in. Run `haki login` first.");
    const result = await authenticatedRequest(config, "/api/v1/github/install-url");
    if (result.status >= 400) throw new Error(result.body?.error?.message ?? "Could not start GitHub setup.");
    console.log(`Install the HAKI GitHub App: ${result.body.data.url}`);
    return;
  }

  if (!config.accessToken) throw new Error("You are not signed in. Run `haki login` first.");
  const id = args[0];
  if (command === "repositories" || command === "repos") {
    showResult(await authenticatedRequest(config, "/api/v1/repositories"));
  } else if (command === "branches") {
    requireArgs(args, 1, "haki branches <repository-id>");
    showResult(await authenticatedRequest(config, `/api/v1/repositories/${encodeURIComponent(id)}/branches`));
  } else if (command === "submissions") {
    showResult(await authenticatedRequest(config, `/api/v1/submissions${id ? `?repositoryId=${encodeURIComponent(id)}` : ""}`));
  } else if (command === "submission") {
    requireArgs(args, 1, "haki submission <submission-id>");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}`));
  } else if (command === "submit") {
    requireArgs(args, 1, "haki submit <repository-id> --title <text> --source <branch> --target <branch> --base-sha <sha> --head-sha <sha>");
    const options: Record<string, string> = {};
    for (let index = 1; index < args.length; index += 2) {
      const flag = args[index];
      const value = args[index + 1];
      if (!flag?.startsWith("--") || !value) throw new Error("Submit options require a flag and a value.");
      options[flag.slice(2)] = value;
    }
    for (const key of ["title", "source", "target", "base-sha", "head-sha"]) if (!options[key]) throw new Error(`Missing --${key}.`);
    showResult(await authenticatedRequest(config, "/api/v1/submissions", { method: "POST", body: JSON.stringify({ repositoryId: id, title: options.title, description: options.description, sourceBranch: options.source, targetBranch: options.target, baseCommitSha: options["base-sha"], headCommitSha: options["head-sha"] }) }));
  } else if (command === "validate") {
    requireArgs(args, 1, "haki validate <submission-id>");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/validate`, { method: "POST" }));
  } else if (command === "validation") {
    requireArgs(args, 1, "haki validation <submission-id>");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/validation`));
  } else if (command === "request-review") {
    requireArgs(args, 1, "haki request-review <submission-id>");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/request-review`, { method: "POST" }));
  } else if (command === "reviews") {
    requireArgs(args, 1, "haki reviews <submission-id>");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/reviews`));
  } else if (command === "review") {
    requireArgs(args, 2, "haki review <submission-id> <decision> [message]");
    const decision = args[1].toUpperCase();
    if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED", "COMMENTED"].includes(decision)) throw new Error("Decision must be APPROVED, CHANGES_REQUESTED, REJECTED, or COMMENTED.");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/reviews`, { method: "POST", body: JSON.stringify({ decision, ...(args[2] ? { body: args.slice(2).join(" ") } : {}) }) }));
  } else if (command === "comment") {
    requireArgs(args, 5, "haki comment <submission-id> <review-id> <file> <line> <message>");
    const line = Number(args[3]);
    if (!Number.isInteger(line) || line < 1) throw new Error("Line must be a positive whole number.");
    showResult(await authenticatedRequest(config, `/api/v1/submissions/${encodeURIComponent(id)}/reviews/${encodeURIComponent(args[1])}/comments`, { method: "POST", body: JSON.stringify({ filePath: args[2], line, body: args.slice(4).join(" ") }) }));
  } else {
    usage();
    throw new Error(`Unknown command: ${command ?? ""}`);
  }
}

main().catch((error: unknown) => {
  console.error(`haki: ${error instanceof Error ? error.message : "Unexpected error."}`);
  process.exitCode = 1;
});
