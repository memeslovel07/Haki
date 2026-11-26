import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createInstallState, readInstallState, syncInstallation, syncWebhookRepositories, ensureUserTeam } from "./github-installation.service.js";

export async function getInstallUrl(req: AuthenticatedRequest, res: Response) {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return res.status(503).json({ success: false, error: { code: "GITHUB_APP_NOT_CONFIGURED", message: "GitHub App is not configured on this server." } });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await ensureUserTeam(req.userId!, user?.name);
    const url = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
    url.searchParams.set("state", createInstallState(req.userId!));
    return res.status(200).json({ success: true, data: { url: url.toString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start GitHub setup.";
    return res.status(503).json({ success: false, error: { code: "GITHUB_APP_NOT_CONFIGURED", message } });
  }
}

export async function completeGitHubSetup(req: Request, res: Response) {
  const installationId = typeof req.query.installation_id === "string" ? req.query.installation_id : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const action = typeof req.query.setup_action === "string" ? req.query.setup_action : "install";
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (!frontendOrigin) return res.status(500).send("Frontend is not configured.");
  try {
    const userId = readInstallState(state);
    const result = await syncInstallation(userId, installationId);
    return res.redirect(`${frontendOrigin}/?github=connected&account=${encodeURIComponent(result.accountLogin)}&repositories=${result.repositoryCount}`);
  } catch (error) {
    const code = action === "update" ? "github_update_failed" : "github_install_failed";
    console.error("GitHub App setup failed:", error instanceof Error ? error.name : typeof error);
    return res.redirect(`${frontendOrigin}/?github_error=${code}`);
  }
}

export async function githubWebhook(req: Request, res: Response) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  const signature = req.get("X-Hub-Signature-256");
  if (!secret || !signature || !Buffer.isBuffer(req.body)) return res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK_SIGNATURE" } });
  const expected = createHmac("sha256", secret).update(req.body).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature.replace(/^sha256=/, ""), "hex"); } catch { return res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK_SIGNATURE" } }); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK_SIGNATURE" } });
  const event = req.get("X-GitHub-Event");
  let payload: any;
  try { payload = JSON.parse(req.body.toString("utf8")); } catch { return res.status(400).json({ success: false, error: { code: "INVALID_WEBHOOK_PAYLOAD" } }); }
  try {
    const installationId = payload.installation?.id;
    if (event === "installation" && installationId) {
      const suspendedAt = payload.action === "suspend" || payload.action === "deleted" ? new Date() : payload.action === "unsuspend" || payload.action === "created" ? null : undefined;
      if (suspendedAt !== undefined) await prisma.githubInstallation.updateMany({ where: { installationId: BigInt(installationId) }, data: { suspendedAt } });
    }
    if (event === "installation_repositories") await syncWebhookRepositories(payload);
    return res.status(202).json({ success: true, data: { received: true } });
  } catch {
    console.error("GitHub webhook processing failed.");
    return res.status(500).json({ success: false, error: { code: "WEBHOOK_PROCESSING_FAILED" } });
  }
}
