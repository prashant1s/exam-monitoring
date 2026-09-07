import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),

  LIVEKIT_URL: z.string().optional().default(""),
  LIVEKIT_API_KEY: z.string().optional().default(""),
  LIVEKIT_API_SECRET: z.string().optional().default(""),

  NEXT_PUBLIC_SOCKET_URL: z.string().optional().default("http://localhost:4000"),
  SOCKET_JWT_SECRET: z.string().optional().default(""),

  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default(""),
  R2_PUBLIC_URL: z.string().optional().default(""),

  REDIS_URL: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);
