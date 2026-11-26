import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { createAccessToken } from "./access-token.service.js";
import { createRefreshToken } from "./refresh-token.service.js";
import {
  createOAuthState,
  exchangeGitHubCode,
  getGitHubAuthorizationUrl,
  getGitHubUser,
  getVerifiedGitHubEmail,
} from "./github-oauth.service.js";

const STATE_COOKIE = "haki_github_state";
const PURPOSE_COOKIE = "haki_github_purpose";

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
  res.clearCookie(PURPOSE_COOKIE, {
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

function redirectWithError(res: Response, error: string) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN;

  if (!frontendOrigin) {
    return res.status(500).send("Frontend is not configured.");
  }

  return res.redirect(
    `${frontendOrigin}/?auth_error=${encodeURIComponent(error)}`
  );
}

async function startOAuth(req: Request, res: Response, purpose: "SIGN_IN" | "LINK_ACCOUNT", userId?: string) {
  try {
    const state = createOAuthState();
    // Sign-in uses the existing one-time, HTTP-only state cookie and must not
    // depend on optional account-link storage being migrated first.
    if (purpose === "LINK_ACCOUNT" && userId) {
      await prisma.oAuthFlowState.create({ data: { state, purpose, userId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    }

    res.cookie(STATE_COOKIE, state, {
      ...cookieOptions,
      path: "/api/v1/auth/github",
      maxAge: 10 * 60 * 1000,
    });
    res.cookie(PURPOSE_COOKIE, purpose, {
      ...cookieOptions,
      path: "/api/v1/auth/github",
      maxAge: 10 * 60 * 1000,
    });

    return res.redirect(getGitHubAuthorizationUrl(state));
  } catch (error) {
    console.error(
      "GitHub OAuth initiation failed:",
      error instanceof Error ? error.message : typeof error
    );

    return redirectWithError(res, "github_oauth_failed");
  }
}

export function startGitHubOAuth(req: Request, res: Response) {
  return startOAuth(req, res, "SIGN_IN");
}

export function startGitHubAccountLink(req: AuthenticatedRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  return startOAuth(req, res, "LINK_ACCOUNT", req.userId);
}

export async function handleGitHubCallback(
  req: Request,
  res: Response
) {
  const { code, state } = req.query;
  const storedState = req.cookies?.[STATE_COOKIE];
  const purpose = req.cookies?.[PURPOSE_COOKIE];

  clearStateCookie(res);

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    typeof storedState !== "string" ||
    (purpose !== "SIGN_IN" && purpose !== "LINK_ACCOUNT") ||
    !statesMatch(storedState, state)
  ) {
    return redirectWithError(res, "invalid_oauth_state");
  }

  let flow: { userId: string | null; expiresAt: Date } | null = null;
  if (purpose === "LINK_ACCOUNT") {
    flow = await prisma.oAuthFlowState.findUnique({ where: { state } });
    if (!flow || flow.expiresAt <= new Date()) return redirectWithError(res, "invalid_oauth_state");
    const consumed = await prisma.oAuthFlowState.deleteMany({ where: { state, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) return redirectWithError(res, "invalid_oauth_state");
  }

  try {
    const { accessToken: githubAccessToken } = await exchangeGitHubCode(code);
    const githubUser = await getGitHubUser(githubAccessToken);
    const providerAccountId = String(githubUser.id);

    if (purpose === "LINK_ACCOUNT") {
      if (!flow?.userId) return redirectWithError(res, "invalid_oauth_state");
      const targetUser = await prisma.user.findUnique({ where: { id: flow.userId }, select: { id: true, deletedAt: true } });
      if (!targetUser || targetUser.deletedAt) return redirectWithError(res, "account_unavailable");
      const linked = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: "GITHUB", providerAccountId } }, select: { userId: true } });
      if (linked && linked.userId !== targetUser.id) return redirectWithError(res, "github_account_already_linked");
      const current = await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: targetUser.id, provider: "GITHUB" } }, select: { providerAccountId: true } });
      if (current && current.providerAccountId !== providerAccountId) return redirectWithError(res, "github_account_already_linked");
      await prisma.oAuthAccount.upsert({
        where: { userId_provider: { userId: targetUser.id, provider: "GITHUB" } },
        create: { userId: targetUser.id, provider: "GITHUB", providerAccountId, username: githubUser.login },
        update: { providerAccountId, username: githubUser.login },
      });
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/?auth=github_linked`);
    }

    const email = await getVerifiedGitHubEmail(githubAccessToken);
    if (!email) return redirectWithError(res, "github_email_unavailable");

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
      const emailOwner = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (emailOwner) {
        return redirectWithError(res, "account_link_required");
      }

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

    const accessToken = await createAccessToken(user.id);
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

    return redirectWithError(res, "github_oauth_failed");
  }
}
