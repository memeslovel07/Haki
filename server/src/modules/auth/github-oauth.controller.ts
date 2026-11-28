import type { Request, Response } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createRefreshToken } from "./refresh-token.service.js";
import {
  createOAuthState,
  exchangeGitHubCode,
  getGitHubAuthorizationUrl,
  getGitHubUser,
  getVerifiedGitHubEmail,
  isGitHubOAuthConfigured,
} from "./github-oauth.service.js";

const STATE_COOKIE = "haki_github_state";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

function clearStateCookie(res: Response) {
  res.clearCookie(STATE_COOKIE, {
    ...cookieOptions,
    path: "/api/v1/auth/github",
  });
}

function statesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function parseStateCookie(value: string): { state: string; flow: "login" | "signup" | "link" } | null {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const state = value.slice(0, separator);
  const flow = value.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/i.test(state) || !["login", "signup", "link"].includes(flow)) return null;
  return { state, flow: flow as "login" | "signup" | "link" };
}

function redirectWithError(res: Response, error: string) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN;

  if (!frontendOrigin) {
    return res.status(500).send("Frontend is not configured.");
  }

  return res.redirect(
    `${frontendOrigin}/?auth_error=${encodeURIComponent(error)}`
  );
}

function redirectLinkResult(res: Response, result: string) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (!frontendOrigin) return res.status(500).send("Frontend is not configured.");
  return res.redirect(`${frontendOrigin}/setting?github_link=${encodeURIComponent(result)}`);
}

export function startGitHubOAuth(req: Request, res: Response) {
  if (!isGitHubOAuthConfigured()) {
    return redirectWithError(res, "github_not_configured");
  }

  try {
    const state = createOAuthState();
    const flow = req.query.flow === "signup" ? "signup" : "login";

    res.cookie(STATE_COOKIE, `${state}.${flow}`, {
      ...cookieOptions,
      path: "/api/v1/auth/github",
      maxAge: 10 * 60 * 1000,
    });

    return res.redirect(getGitHubAuthorizationUrl(state));
  } catch {
    console.error("GitHub OAuth initiation failed.");

    return redirectWithError(res, "github_oauth_failed");
  }
}

export async function startGitHubLink(req: AuthenticatedRequest, res: Response) {
  if (!isGitHubOAuthConfigured()) {
    return res.status(503).json({ success: false, error: { code: "GITHUB_NOT_CONFIGURED", message: "GitHub sign-in is not configured." } });
  }
  const state = randomBytes(32).toString("hex");
  try {
    await prisma.oAuthLinkState.create({
      data: { tokenHash: createHash("sha256").update(state).digest("hex"), userId: req.userId!, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    res.cookie(STATE_COOKIE, `${state}.link`, { ...cookieOptions, path: "/api/v1/auth/github", maxAge: 10 * 60_000 });
    return res.json({ success: true, data: { authorizationUrl: getGitHubAuthorizationUrl(state) } });
  } catch {
    return res.status(500).json({ success: false, error: { code: "GITHUB_LINK_FAILED", message: "Unable to start GitHub account linking." } });
  }
}

export async function handleGitHubCallback(
  req: Request,
  res: Response
) {
  const { code, state } = req.query;
  const storedState = req.cookies?.[STATE_COOKIE];
  const stateContext = typeof storedState === "string" ? parseStateCookie(storedState) : null;

  clearStateCookie(res);

  if (req.query.error === "access_denied") {
    if (typeof state === "string") {
      const linkedState = await prisma.oAuthLinkState.findUnique({ where: { tokenHash: createHash("sha256").update(state).digest("hex") } }).catch(() => null);
      if (linkedState) return redirectLinkResult(res, "cancelled");
    }
    return redirectWithError(res, "github_cancelled");
  }

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !stateContext ||
    !statesMatch(stateContext.state, state)
  ) {
    return redirectWithError(res, "invalid_oauth_state");
  }

  let isLinkFlow = false;
  try {
    const stateHash = createHash("sha256").update(state).digest("hex");
    const pendingLink = await prisma.oAuthLinkState.findUnique({ where: { tokenHash: stateHash } });
    isLinkFlow = stateContext.flow === "link";
    if (isLinkFlow !== Boolean(pendingLink)) return isLinkFlow ? redirectLinkResult(res, "expired") : redirectWithError(res, "invalid_oauth_state");
    const githubAccessToken = await exchangeGitHubCode(code);
    const githubUser = await getGitHubUser(githubAccessToken);

    const providerAccountId = String(githubUser.id);

    if (pendingLink && stateContext.flow === "link") {
      if (pendingLink.usedAt || pendingLink.expiresAt <= new Date()) return redirectLinkResult(res, "expired");
      const linked = await prisma.$transaction(async (tx) => {
        const claimed = await tx.oAuthLinkState.updateMany({ where: { tokenHash: stateHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (claimed.count !== 1) return "expired" as const;
        const current = await tx.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: "GITHUB", providerAccountId } }, select: { userId: true } });
        if (current && current.userId !== pendingLink.userId) return "already_linked" as const;
        if (!current) await tx.oAuthAccount.create({ data: { userId: pendingLink.userId, provider: "GITHUB", providerAccountId, username: githubUser.login } });
        return "success" as const;
      });
      return redirectLinkResult(res, linked);
    }

    const existingAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GITHUB",
          providerAccountId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            deletedAt: true,
          },
        },
      },
    });

    let user;

    if (existingAccount) {
      if (existingAccount.user.deletedAt) {
        return redirectWithError(res, "account_unavailable");
      }

      user = existingAccount.user;
    } else {
      const email = await getVerifiedGitHubEmail(githubAccessToken);
      if (!email) return redirectWithError(res, "github_email_unavailable");

      const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailOwner) return redirectWithError(res, "account_link_required");
      if (stateContext.flow === "login") return redirectWithError(res, "account_not_found");

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name: githubUser.name || githubUser.login,
            emailVerifiedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            deletedAt: true,
          },
        });

        await tx.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider: "GITHUB",
            providerAccountId,
            username: githubUser.login,
          },
        });

        return newUser;
      });
    }

    const refreshToken = await createRefreshToken(user.id);

    res.cookie("haki_refresh", refreshToken.token, {
      ...cookieOptions,
      path: "/api/v1/auth",
      maxAge: refreshToken.expiresAt.getTime() - Date.now(),
    });

    const frontendOrigin = process.env.FRONTEND_ORIGIN;

    if (!frontendOrigin) {
      return res.status(500).send("Frontend is not configured.");
    }

    return res.redirect(`${frontendOrigin}/?auth=github`);
  } catch (error) {
    console.error(
      "GitHub OAuth callback failed:",
      error instanceof Error ? error.name : typeof error
    );

    return isLinkFlow ? redirectLinkResult(res, "failed") : redirectWithError(res, "github_oauth_failed");
  }
}
