
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




