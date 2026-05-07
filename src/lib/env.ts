// src/lib/env.ts
// Zod-validated process.env reader. Parsed at module load — throws with the
// field list if a required var is missing. Phase 4 promotes RESEND_API_KEY
// and ADMIN_GITHUB_LOGINS (renamed from the prior admin-allowlist var) to
// required and adds 6 more vars for admin dashboard, cron auth, email, archive.
import { z } from 'zod';

const EnvSchema = z.object({
  // Supabase (Phase 1 — required)
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Phase 2 required
  ANTHROPIC_API_KEY: z.string().min(20),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10),

  // Phase 3 required (Plan 03-00 Task 1 — research_company tool depends on it)
  EXA_API_KEY: z.string().min(20),

  // Phase 4 required (D-H-01)
  RESEND_API_KEY: z.string().startsWith('re_'),
  RESEND_FROM_EMAIL: z.email(),
  JOE_NOTIFICATION_EMAIL: z.email(),
  ADMIN_GITHUB_LOGINS: z.string().min(1), // comma-separated GitHub usernames
  CRON_SECRET: z.string().min(32),
  SUPABASE_STORAGE_ARCHIVE_BUCKET: z.string().default('transcripts-archive'),

  // Phase 4 optional (D-H-01)
  BETTERSTACK_DASHBOARD_URL: z.url().optional(),
  HEARTBEAT_LLM_PREWARM: z.string().optional().default('true'),

  // Phase 4 optional URL bases for buildAdminUrl in src/lib/email.ts (WR-03).
  // NEXT_PUBLIC_SITE_URL is the canonical production URL when set; VERCEL_URL
  // is auto-injected on Vercel deployments (without a scheme — bare hostname).
  // Both optional: in dev neither is required; in prod missing-both yields a
  // relative admin URL plus a warn-level log rather than a clickable
  // localhost link.
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  VERCEL_URL: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
