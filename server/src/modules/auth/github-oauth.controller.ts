import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
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

function redirectWithError(res: Response, error: string) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN;

  if (!frontendOrigin) {
    return res.status(500).send("Frontend is not configured.");
  }

  return res.redirect(
    `${frontendOrigin}/?auth_error=${encodeURIComponent(error)}`
  );
}

export function startGitHubOAuth(_req: Request, res: Response) {
  try {
    const state = createOAuthState();

    res.cookie(STATE_COOKIE, state, {
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

export async function handleGitHubCallback(
  req: Request,
  res: Response
) {
  const { code, state } = req.query;
  const storedState = req.cookies?.[STATE_COOKIE];

  clearStateCookie(res);

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    typeof storedState !== "string" ||
    !statesMatch(storedState, state)
  ) {
    return redirectWithError(res, "invalid_oauth_state");
  }

  try {
    const githubAccessToken = await exchangeGitHubCode(code);
    const githubUser = await getGitHubUser(githubAccessToken);
    const email = await getVerifiedGitHubEmail(githubAccessToken);

    if (!email) {
      return redirectWithError(res, "github_email_unavailable");
    }

    const providerAccountId = String(githubUser.id);

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