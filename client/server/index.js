import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleGitHubAuth } from "./githubOAuth.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.join(rootDir, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const requestCounts = new Map();
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BODY_BYTES = 20_000;
const WINDOW_MS = 60_000;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestCounts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    requestCounts.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestCounts.set(ip, recent);
  return false;
}

function textFromInteraction(data) {
  return (data.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function handleChat(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST for chat messages." });
  if (isRateLimited(req.socket.remoteAddress || "unknown")) {
    return json(res, 429, { error: "Too many messages. Please wait a minute and try again." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return json(res, 503, { error: "Gemini is not configured yet. Add GEMINI_API_KEY to the server .env file." });
  }

  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(res, 413, { error: "This chat message is too large." });
    }

    const body = JSON.parse(raw || "{}");
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    const history = Array.isArray(body.history)
      ? body.history.slice(-12).filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string").map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }))
      : [];

    if (!message) return json(res, 400, { error: "Enter a message first." });

    const conversation = [
      ...history.map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`),
      `User: ${message}`,
    ].join("\n\n");

    const requestBase = {
      input: conversation,
      system_instruction: `You are HAKI Assistant, a helpful guide for the HAKI repository workspace. Always answer in English only, even when a user writes in Hindi, Hinglish, or another language. Never include Hindi/Hinglish. Never repeat or mention the user's language preference or instructions; simply follow them. Do not append phrases such as “Please reply in English as per my instructions.” Answer the actual question directly. Explain repositories, privacy settings, files, commits, account setup, profile/settings, and ZIP import. This project is a browser-based preview: repository and account data are stored locally in the browser; ZIP selection does not currently extract files; OTP is shown on screen rather than emailed. Do not claim actions are completed for the user. For questions outside HAKI, answer briefly and safely.`,
      store: false,
      generation_config: { temperature: 0.2, max_output_tokens: 900, thinking_level: "low" },
    };
    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const models = configuredModel === "gemini-3.5-flash-lite"
      ? [configuredModel]
      : ["gemini-3.5-flash-lite", configuredModel];
    let upstream;
    for (const [index, model] of models.entries()) {
      try {
        upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
            "Api-Revision": "2026-05-20",
          },
          body: JSON.stringify({ ...requestBase, model }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (networkError) {
        if (index === models.length - 1) throw networkError;
        console.warn(`Gemini model ${model} did not respond; trying fallback model.`);
        continue;
      }
      if (upstream.status !== 503 || index === models.length - 1) break;
      console.warn(`Gemini model ${model} returned 503; trying fallback model.`);
    }

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Gemini API returned", upstream.status, data?.error?.status || data?.error?.code || "an error");
      if (upstream.status === 401 || upstream.status === 403) {
        return json(res, 502, { error: "Gemini rejected the API key. Create or verify a Gemini API key in Google AI Studio, update the server .env file, and restart the app." });
      }
      if (upstream.status === 400 || upstream.status === 404) {
        return json(res, 502, { error: "Gemini rejected the model or request settings. Check GEMINI_MODEL in the server .env file." });
      }
      if (upstream.status === 503) {
        return json(res, 503, { error: "Gemini is temporarily unavailable on the main and fallback models. Please try again later." });
      }
      return json(res, 502, { error: upstream.status === 429 ? "Gemini is busy or its quota is exhausted. Please try again shortly." : `Gemini request failed (HTTP ${upstream.status}). Check the server terminal for details.` });
    }

    const reply = textFromInteraction(data)
      .replace(/\(?\s*please reply in english as per my instructions\.?\s*\)?/gi, "")
      .trim();
    if (!reply) return json(res, 502, { error: "Gemini returned an empty reply. Please try again." });
    return json(res, 200, { reply });
  } catch (error) {
    if (error instanceof SyntaxError) return json(res, 400, { error: "The chat request was not valid JSON." });
    console.error("Chat request failed:", error.message, error.cause?.code || "");
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return json(res, 504, { error: "Gemini models took too long to respond. Please try again shortly." });
    }
    const networkCode = error.cause?.code;
    return json(res, 502, { error: networkCode ? `The server cannot connect to Gemini (${networkCode}). Check the internet connection or firewall.` : "The server cannot connect to Gemini. Check the internet connection and try again." });
  }
}


export async function handleApi(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/chat") return handleChat(req, res);
  if (pathname.startsWith("/api/auth/github")) return handleGitHubAuth(req, res, pathname);
  return json(res, 404, { error: "API route not found." });
}


function contentType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".json": "application/json; charset=utf-8" })[path.extname(filePath)] || "application/octet-stream";
}

export function createHakiServer() {
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) return handleApi(req, res);

    try {
      const requestedPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
      let filePath = path.resolve(distDir, `.${requestedPath}`);
      if (!filePath.startsWith(`${distDir}${path.sep}`) && filePath !== path.join(distDir, "index.html")) {
        return json(res, 403, { error: "Forbidden." });
      }
      try {
        if (!(await fs.promises.stat(filePath)).isFile()) throw new Error("Not a file");
      } catch {
        filePath = path.join(distDir, "index.html");
      }
      res.writeHead(200, { "Content-Type": contentType(filePath), "X-Content-Type-Options": "nosniff" });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      json(res, 404, { error: "Not found. Build the frontend first with npm run build." });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createHakiServer().listen(port, () => console.log(`HAKI server listening on http://localhost:${port}`));
}
