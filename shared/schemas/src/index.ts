
import { z } from "zod";

// Health
export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    service: z.string(),
    status: z.literal("healthy"),
    timestamp: z.iso.datetime(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Authentication
export const RegisterRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),

  email: z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(320)),

  password: z
    .string()
    .min(12)
    .max(128),
}).strict();

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;


export const LoginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(320)),
  password: z.string().min(1).max(128),
}).strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const TeamRoleSchema = z.enum(["OWNER", "ADMIN", "DEVELOPER", "REVIEWER"]);
export const TeamIdParamSchema = z.uuid();
export const TeamMemberIdParamSchema = z.uuid();
export const TeamInvitationIdParamSchema = z.uuid();
export const TeamSettingsSchema = z.object({
  defaultBranch: z.string().trim().min(1).max(255).default("main"),
  requireReviews: z.boolean().default(true),
  requiredApprovals: z.number().int().min(0).max(10).default(1),
}).strict();
export const CreateTeamRequestSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const InviteTeamMemberRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  role: z.enum(["ADMIN", "DEVELOPER", "REVIEWER"]).default("DEVELOPER"),
}).strict();
export const RespondTeamInvitationRequestSchema = z.object({ accept: z.boolean() }).strict();
export const ChangeTeamMemberRoleRequestSchema = z.object({ role: TeamRoleSchema }).strict();
export const TransferTeamOwnershipRequestSchema = z.object({ userId: z.uuid() }).strict();
export const UpdateTeamSettingsRequestSchema = z.object({
  defaultBranch: z.string().trim().min(1).max(255).optional(),
  requireReviews: z.boolean().optional(),
  requiredApprovals: z.number().int().min(0).max(10).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one setting is required.");
export const GitHubRepositoryResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  htmlUrl: z.url(),
  description: z.string().nullable(),
  defaultBranch: z.string(),
  updatedAt: z.iso.datetime(),
  ownerLogin: z.string(),
  teamName: z.string().optional(),
});
export const GitHubRepositoryListEnvelopeSchema = z.object({ success: z.literal(true), data: z.array(GitHubRepositoryResponseSchema) });




