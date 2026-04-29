// src/lib/env.ts
// Zod-validated process.env reader. Parsed at module load — throws with the
// field list if a required var is missing. Phase 2 tightens Anthropic + Upstash
// to required; these must be present in .env.local before `npm run dev` boots.
// Source: RESEARCH.md §Environment Availability + CONTEXT.md D-F-01..04.
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

  // Phase 3-4 placeholders (still optional)
  EXA_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_GITHUB_USERNAMES: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
