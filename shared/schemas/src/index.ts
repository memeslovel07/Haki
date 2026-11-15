import { z } from "zod";

export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    service: z.string(),
    status: z.literal("healthy"),
    timestamp: z.iso.datetime(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
