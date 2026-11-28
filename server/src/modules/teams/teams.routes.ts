import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { TeamIdParamSchema, TeamMemberIdParamSchema, TeamInvitationIdParamSchema } from "@haki/schemas";
import { changeMemberRole, createTeam, getTeam, getTeamSettings, inviteMember, leaveTeam, listMembers, listMyInvitations, listMyTeams, removeTeamMember, respondToInvitation, transferOwnership, updateTeamSettings } from "./teams.controller.js";
const router = Router();
router.use(authenticateAccessToken);
function validateParam(schema: { safeParse(value: unknown): { success: boolean } }, name: string) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (!schema.safeParse(req.params[name]).success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid ${name}.` } });
    next();
  };
}
router.param("teamId", validateParam(TeamIdParamSchema, "teamId"));
router.param("userId", validateParam(TeamMemberIdParamSchema, "userId"));
router.param("invitationId", validateParam(TeamInvitationIdParamSchema, "invitationId"));
router.post("/", createTeam);
router.get("/", listMyTeams);
router.get("/invitations", listMyInvitations);
router.post("/invitations/:invitationId/respond", respondToInvitation);
router.get("/:teamId", getTeam);
router.get("/:teamId/members", listMembers);
router.post("/:teamId/invitations", inviteMember);
router.delete("/:teamId/members/:userId", removeTeamMember);
router.post("/:teamId/leave", leaveTeam);
router.patch("/:teamId/members/:userId/role", changeMemberRole);
router.post("/:teamId/ownership", transferOwnership);
router.get("/:teamId/settings", getTeamSettings);
router.put("/:teamId/settings", updateTeamSettings);
export default router;
