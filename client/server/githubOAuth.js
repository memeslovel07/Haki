import { randomBytes, timingSafeEqual } from "node:crypto";

const oauthTickets = new Map();
const TICKET_LIFETIME_MS = 3 * 60 * 1000;
const CALLBACK_FALLBACK = "http://localhost:5173/api/auth/github/callback";

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function redirect(res, location, cookie = "") {
  const headers = { Location: location, "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  res.writeHead(302, headers);
  res.end();
}

function callbackUrl() {
  return process.env.GITHUB_REDIRECT_URI || CALLBACK_FALLBACK;
}

function appUrl(params = {}) {
  const url = new URL("/", callbackUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function stateCookie(value, maxAge) {
  const secure = new URL(callbackUrl()).protocol === "https:" ? "; Secure" : "";
  return `haki_github_state=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/github; Max-Age=${maxAge}${secure}`;
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const pair = cookies.map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : "";
}

async function readJson(req, maxBytes = 4096) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) throw new Error("Request too large.");
  }
  return JSON.parse(raw || "{}");
}

function sameState(expected, received) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function startOAuth(res) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirect(res, appUrl({ auth_error: "github_not_configured" }));
  }

  const state = randomBytes(32).toString("hex");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callbackUrl());
  authorize.searchParams.set("scope", "read:user user:email");
  authorize.searchParams.set("state", state);
  return redirect(res, authorize.toString(), stateCookie(state, 600));
}

async function finishOAuth(req, res) {
  const clearCookie = stateCookie("", 0);
  const params = new URL(req.url, "http://localhost").searchParams;
  if (params.get("error")) return redirect(res, appUrl({ auth_error: "github_cancelled" }), clearCookie);

  const state = params.get("state") || "";
  const savedState = cookieValue(req, "haki_github_state");
  const code = params.get("code") || "";
  if (!sameState(savedState, state) || !code || !process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirect(res, appUrl({ auth_error: "github_failed" }), clearCookie);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("GitHub token exchange failed:", tokenResponse.status);
      return redirect(res, appUrl({ auth_error: "github_failed" }), clearCookie);
    }

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "haki-ff",
    };
    const userResponse = await fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15_000) });
    if (!userResponse.ok) {
      console.error("GitHub profile request failed:", userResponse.status);
      return redirect(res, appUrl({ auth_error: "github_failed" }), clearCookie);
    }
    const githubUser = await userResponse.json();

    let email = githubUser.email || "";
    const emailsResponse = await fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (emailsResponse?.ok) {
      const emails = await emailsResponse.json().catch(() => []);
      email = emails.find((entry) => entry.primary && entry.verified)?.email || emails.find((entry) => entry.verified)?.email || email;
    }

    for (const [ticket, entry] of oauthTickets) {
      if (entry.expiresAt < Date.now()) oauthTickets.delete(ticket);
    }
    const ticket = randomBytes(32).toString("hex");
    oauthTickets.set(ticket, {
      expiresAt: Date.now() + TICKET_LIFETIME_MS,
      profile: {
        id: String(githubUser.id),
        login: githubUser.login,
        name: githubUser.name || githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url || "",
      },
    });
    return redirect(res, appUrl({ github_ticket: ticket }), clearCookie);
  } catch (error) {
    console.error("GitHub OAuth callback failed:", error.message);
    return redirect(res, appUrl({ auth_error: "github_failed" }), clearCookie);
  }
}

async function exchangeTicket(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST to complete GitHub sign-in." });
  try {
    const { ticket } = await readJson(req);
    const entry = typeof ticket === "string" ? oauthTickets.get(ticket) : null;
    if (!entry || entry.expiresAt < Date.now()) {
      if (ticket) oauthTickets.delete(ticket);
      return json(res, 401, { error: "GitHub sign-in expired. Please try again." });
    }
    oauthTickets.delete(ticket);
    return json(res, 200, { profile: entry.profile });
  } catch (error) {
    return json(res, 400, { error: error.message || "Invalid GitHub sign-in request." });
  }
}

export async function handleGitHubAuth(req, res, pathname) {
  if (pathname === "/api/auth/github" && req.method === "GET") return startOAuth(res);
  if (pathname === "/api/auth/github/callback" && req.method === "GET") return finishOAuth(req, res);
  if (pathname === "/api/auth/github/session") return exchangeTicket(req, res);
  return json(res, 404, { error: "GitHub sign-in route not found." });
}
