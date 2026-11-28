import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.join(rootDir, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const MAX_API_BODY_BYTES = 35 * 1024 * 1024;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function handleApi(req, res) {
  return json(res, 404, { error: `API route not found: ${new URL(req.url, "http://localhost").pathname}` });
}


function contentType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".json": "application/json; charset=utf-8" })[path.extname(filePath)] || "application/octet-stream";
}

async function proxyBackendApi(req, res) {
  try {
    const target = new URL(req.url, process.env.HAKI_API_TARGET || "http://localhost:5000");
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (["host", "connection", "content-length"].includes(name) || value === undefined) continue;
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }

    let body;
    if (!(req.method === "GET" || req.method === "HEAD")) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_API_BODY_BYTES) {
          json(res, 413, { error: "API request is too large." });
          return;
        }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    const responseHeaders = {};
    for (const name of ["content-type", "cache-control", "location", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders[name] = value;
    }
    const cookies = upstream.headers.getSetCookie?.() || [upstream.headers.get("set-cookie")].filter(Boolean);
    if (cookies.length) responseHeaders["set-cookie"] = cookies;
    if (responseBody.length) responseHeaders["content-length"] = responseBody.length;
    res.writeHead(upstream.status, responseHeaders);
    res.end(responseBody);
  } catch (error) {
    console.error("Backend API proxy failed:", error.message);
    json(res, 502, { error: "The HAKI API is unavailable." });
  }
}

export function createHakiServer() {
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/v1/")) return proxyBackendApi(req, res);
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
