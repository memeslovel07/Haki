import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleGitHubAuth } from "./githubOAuth.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
if (typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(path.join(rootDir, ".env")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function proxyMainApi(req, res, routePath = req.url) {
  const target = new URL(process.env.HAKI_API_TARGET || "http://127.0.0.1:5000");
  const upstreamUrl = new URL(routePath, target);
  const transport = upstreamUrl.protocol === "https:" ? https : http;
  const upstream = transport.request(upstreamUrl, { method: req.method, headers: { ...req.headers, host: upstreamUrl.host } }, (response) => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => json(res, 502, { error: "The HAKI backend is unavailable." }));
  req.pipe(upstream);
}
export async function handleApi(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname.startsWith("/api/v1/")) return proxyMainApi(req, res);
  const legacyRoutes = {
    "/api/chat": "/api/v1/security/chat",
    "/api/repository/scan": "/api/v1/security/scan",
    "/api/security/scan": "/api/v1/security/scan",
    "/api/repository/review": "/api/v1/security/review",
    "/api/import/zip": "/api/v1/security/import/zip",
  };
  if (legacyRoutes[pathname]) return proxyMainApi(req, res, legacyRoutes[pathname] + new URL(req.url, "http://localhost").search);
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
      let filePath = path.resolve(distDir, "." + requestedPath);
      if (!filePath.startsWith(distDir + path.sep) && filePath !== path.join(distDir, "index.html")) return json(res, 403, { error: "Forbidden." });
      try { if (!(await fs.promises.stat(filePath)).isFile()) throw new Error("Not a file"); }
      catch { filePath = path.join(distDir, "index.html"); }
      res.writeHead(200, { "Content-Type": contentType(filePath), "X-Content-Type-Options": "nosniff" });
      fs.createReadStream(filePath).pipe(res);
    } catch { json(res, 404, { error: "Not found. Build the frontend first with npm run build." }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createHakiServer().listen(port, () => console.log("HAKI server listening on http://localhost:" + port));
}
