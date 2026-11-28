import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

export const defaultApiUrl = process.env.HAKI_API_URL || "http://localhost:5000/api/v1";
const configDirectory = process.env.APPDATA
  ? path.join(process.env.APPDATA, "Haki")
  : path.join(homedir(), ".config", "haki");
const configPath = path.join(configDirectory, "config.json");

export interface CliConfig {
  apiUrl: string;
  refreshToken: string;
  user: { id: string; name: string | null; email: string };
}

export interface HakiClient {
  config: CliConfig;
  request<T = any>(route: string, options?: { method?: string; body?: unknown }): Promise<T>;
}

export function normalizeApiUrl(value: string): string {
  const url = new URL(value);
  url.pathname = `${url.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1`;
  return url.toString().replace(/\/$/, "");
}

async function saveConfig(config: CliConfig) {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  await rename(temporaryPath, configPath);
}

export async function loadConfig(): Promise<CliConfig> {
  try {
    return JSON.parse(await readFile(configPath, "utf8")) as CliConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Run `haki login` first.");
    }
    throw new Error("HAKI CLI config is invalid. Run `haki login` again.");
  }
}

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `HAKI API request failed (${response.status}).`);
  }
  return { response, body: body?.data ?? body };
}

function refreshTokenFrom(response: Response): string | undefined {
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|;\s*)haki_refresh=([^;]+)/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export async function login(apiUrl: string) {
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = (await terminal.question("Email: ")).trim().toLowerCase();
  terminal.close();
  if (!email) throw new Error("Email is required.");

  const password = await readPassword("Password: ");
  const { response, body } = await requestJson(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const refreshToken = refreshTokenFrom(response);
  if (!refreshToken || !body?.user?.id || !body?.accessToken) {
    throw new Error("HAKI login did not return a session cookie. Check the API proxy and server.");
  }

  const config: CliConfig = {
    apiUrl,
    refreshToken,
    user: { id: body.user.id, name: body.user.name ?? null, email: body.user.email },
  };
  await saveConfig(config);
  console.log(`Signed in as ${config.user.email}.`);
}

async function readPassword(label: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    const terminal = createInterface({ input: stdin, output: stdout });
    const answer = await terminal.question(`${label} (input hidden only in an interactive terminal): `);
    terminal.close();
    return answer;
  }

  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          reject(new Error("Login cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    stdin.on("data", onData);
  });
}

export async function authenticatedClient(): Promise<HakiClient> {
  const config = await loadConfig();
  const { response, body } = await requestJson(`${config.apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `haki_refresh=${config.refreshToken}` },
  });
  const nextRefreshToken = refreshTokenFrom(response);
  if (nextRefreshToken) config.refreshToken = nextRefreshToken;
  if (!body?.accessToken) throw new Error("Your HAKI session expired. Run `haki login` again.");
  await saveConfig(config);
  let accessToken: string = body.accessToken;

  return {
    config,
    async request<T>(route: string, options: { method?: string; body?: unknown } = {}) {
      const send = () => fetch(`${config.apiUrl}${route}`, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(30_000),
      });

      let response = await send();
      if (response.status === 401) {
        const refreshed = await requestJson(`${config.apiUrl}/auth/refresh`, {
          method: "POST",
          headers: { Cookie: `haki_refresh=${config.refreshToken}` },
        });
        accessToken = refreshed.body?.accessToken;
        const rotatedToken = refreshTokenFrom(refreshed.response);
        if (rotatedToken) config.refreshToken = rotatedToken;
        if (!accessToken) throw new Error("Your HAKI session expired. Run `haki login` again.");
        await saveConfig(config);
        response = await send();
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || body?.message || `HAKI API request failed (${response.status}).`);
      return (body?.data ?? body) as T;
    },
  };
}

export async function logout() {
  const config = await loadConfig();
  await fetch(`${config.apiUrl}/auth/logout`, {
    method: "POST",
    headers: { Cookie: `haki_refresh=${config.refreshToken}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
  await rm(configPath, { force: true });
  console.log("Signed out from HAKI CLI.");
}
