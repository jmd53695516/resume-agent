// src/lib/env.ts
// Zod-validated process.env reader. Parsed at module load — throws with the
// field list if a required var is missing. Phase 1 requires only Supabase vars;
// Phase 2+ vars are optional here and made required in their respective phases.
// Source: RESEARCH.md Pattern 2 + CONTEXT.md D-F-01..04.
import { z } from 'zod';

const EnvSchema = z.object({
  // Supabase (Phase 1)
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Future-phase placeholders (optional in Phase 1)
  ANTHROPIC_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_GITHUB_USERNAMES: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
