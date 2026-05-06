# Phase 4: Admin & Observability — Research

**Researched:** 2026-05-06
**Domain:** Admin dashboard (Supabase Auth + GitHub OAuth, SSR), transactional email (Resend + React Email), scheduled jobs (cron-job.org), cold storage (Supabase Storage), prompt-cache warming, Redis alarm suppression
**Confidence:** HIGH overall — all major API surfaces verified against current official docs or installed package versions; two LOW-confidence items flagged below

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin Auth Gating (A)**
- D-A-01: Supabase Auth + GitHub OAuth only
- D-A-02: `ADMIN_GITHUB_LOGINS` env var, comma-separated GitHub usernames
- D-A-03: Two-layer enforcement — middleware/proxy perimeter + per-route `requireAdmin()` helper
- D-A-04: GitHub login flow: unauthed → `/admin/login` → GitHub OAuth → `/auth/callback` → `/admin/sessions`. Non-allowlisted user: 403 page + `signOut()`
- D-A-05: `/admin/login` only unauthed-accessible admin route
- D-A-06: "Sign out" in top-bar nav; `signOut()` then `router.push('/')`
- D-A-07: Failed-403 attempts logged as Pino `event: 'admin_403'`

**Dashboard IA & Refresh (B)**
- D-B-01..10: SSR on each navigation; `revalidate = 60`; manual refresh button; no Realtime; no client polling
- Last 100 rows; shadcn Table primitive (no third-party data-table library)

**Email & Alarms (C)**
- D-C-01: Resend + React Email
- D-C-02: Per-session email on first user turn (not session creation); `waitUntil()`
- D-C-05: Idempotency via `sessions.first_email_sent_at` atomic UPDATE guard
- D-C-06: 4 alarm conditions (spend-cap, error-rate, dep-down, rate-limit abuse)
- D-C-07: `/api/cron/check-alarms` with per-condition Redis suppression key 1h TTL
- D-C-08: cron-job.org three jobs (5min all, 5min business hours, daily 03:00 ET)
- D-C-09: Bearer `CRON_SECRET` auth on all `/api/cron/*` routes
- D-C-10: Heartbeat = dep pings + optional Anthropic cache-warm (`HEARTBEAT_LLM_PREWARM` env var)

**Retention & Cold Storage (D)**
- D-D-01..07: 180d hot, then archive to Supabase Storage `transcripts-archive`; 90d hard-delete for classifier-flagged rows; sessions table never auto-deleted

**External Monitor (E)**
- D-E-01..04: BetterStack, configured externally, `/admin/health` links to status page via `BETTERSTACK_DASHBOARD_URL`

**Logging (F)**
- D-F-01..02: 7 new Pino event types on existing logger

**Schema (G)**
- D-G-01: Single migration `0002_phase4.sql` — add `sessions.first_email_sent_at` + `alarms_fired` table

**Auth Flow Files & Env (H)**
- D-H-01: 9 new/updated env vars in `src/lib/env.ts`
- D-H-02..04: `admin-auth.ts`, `supabase-browser.ts` helpers

### Claude's Discretion
- Visual styling within shadcn norms
- React Email template prose and visual design
- BetterStack monitor cadence (3 min default)
- Free-mail allowlist grooming
- Alarm email format (recommend plain text per specifics)
- Archive bucket region/storage class
- Minimum sample size for error-rate >2% alarm (recommend ≥10 turns in window)
- Whether heartbeat rotates user-message text (recommend stable "ping")
- Whether alarm "5 unique IPs" uses `ip_hash` (default) or `email` dimension

### Deferred Ideas (OUT OF SCOPE)
- End-of-session feedback prompt (OBSV-D3)
- `/admin/evals/<run-id>` (Phase 5)
- Daily digest email (OBSV-D1)
- Weekly question-clustering (OBSV-D2)
- Anthropic org-level spend cap (Phase 5 operational)
- All items in CONTEXT.md `<deferred>` section
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBSV-01 | Admin dashboard at `/admin` gated by Supabase Auth + GitHub OAuth | §Auth section: `@supabase/ssr` + GitHub OAuth + `proxy.ts` pattern |
| OBSV-02 | Admin email allowlist enforced at API/middleware layer, not just UI | §Auth section: `requireAdmin()` in `proxy.ts` + per-route belt-and-suspenders |
| OBSV-03 | Sessions table view — last 100 sessions sortable by date/domain | §shadcn Table section: URL-driven sort via search params |
| OBSV-04 | Transcript viewer — full conversation with tool-call traces inline | Reuses Phase 3 components; admin always-expand prop |
| OBSV-05 | Cost tracker — rolling 24h/7d/30d with per-tool breakdown + cache hit rate | Live SUM queries on `messages` table; existing schema sufficient |
| OBSV-06 | Abuse log — classifier-flagged + rate-limit hits with hashed IP + email | Query on existing `messages.classifier_verdict` + `stop_reason` columns |
| OBSV-08 | Per-session email to Joe; company-domain priority flag | §Email (Resend + React Email) section; `waitUntil()` / `after()` |
| OBSV-09 | Alarm emails on 4 conditions | §Alarm Dispatcher section; Redis suppression keys |
| OBSV-13 | External synthetic monitor (BetterStack) | §BetterStack section |
| OBSV-14 | cron-job.org heartbeat every 5 min business hours | §cron-job.org section; §Prompt-Cache Warming section |
| OBSV-15 | 180d hot / cold archive; captured emails indefinite; 90d classifier flags | §Supabase Storage section; §Archive Cron section |
</phase_requirements>

---

## Executive Summary

- **CRITICAL: Next.js 16 renamed `middleware.ts` to `proxy.ts`** (and the exported function from `middleware` to `proxy`). This project runs `next@16.2.4`. The file to create for admin perimeter protection is `src/proxy.ts`, not `src/middleware.ts`. Proxy now defaults to Node.js runtime (Edge was default pre-v15.2), so `@supabase/ssr` compatibility issues that existed in the Edge runtime are resolved. [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy]

- **`after()` from `next/server` is now preferred over `waitUntil()` from `@vercel/functions`** for fire-and-forget side effects in Next.js 15.1+. Since this project runs Next.js 16, use `import { after } from 'next/server'` in `/api/chat`'s `onFinish` callback for the per-session email send — not `waitUntil`. The project already has `@vercel/functions@^3.4.4` installed; Vercel docs confirm `after()` is the framework-integrated path. [VERIFIED: vercel.com/docs/functions/functions-api-reference/vercel-functions-package]

- **GitHub OAuth user metadata field is `user_name`** in `session.user.user_metadata.user_name` (GitHub's `login` mapped to `user_name` in Supabase's raw_user_meta_data). This is the field `requireAdmin()` must read for the allowlist check. [MEDIUM: supabase/auth PR #127 + community confirmation; not in official Supabase docs page scraped]

- **Resend and React Email are not yet installed** in this project. Phase 4 must `npm install resend @react-email/components`. Latest versions as of research: `resend@6.12.2`, `@react-email/components@1.0.12`. [VERIFIED: npm registry]

- **Supabase Storage upload accepts `Buffer` / `Uint8Array` / `Blob` / `ArrayBuffer`** as the file body, with `{ contentType, upsert: true }` options. Node.js `zlib.gzipSync()` returns a `Buffer`, which works directly. [ASSUMED: TypeScript type check in node_modules not found; supabase-js source confirms Blob/ArrayBuffer/Buffer]

- **BetterStack free tier: 10 monitors, 3-minute check interval, public status page included at `status.yourdomain.com`**. Status page iframe embedding is not confirmed from official docs — recommend link-out as safe default. [MEDIUM: betterstack.com/uptime]

---

## 1. Supabase Auth + GitHub OAuth + `@supabase/ssr` in Next.js 16

### Critical: `middleware.ts` → `proxy.ts` in Next.js 16

Next.js 16 deprecated `middleware.ts` and renamed the file convention to `proxy.ts`, with the exported function renamed from `middleware` to `proxy`.

```ts
// src/proxy.ts  (NOT src/middleware.ts — would produce a deprecation warning in Next.js 16)
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

export async function proxy(request: NextRequest) {
  // Supabase SSR cookie sync + allowlist check
}
```

[VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy, 2026-05-06]

**Backward compat:** `middleware.ts` still works in Next.js 16 but emits a deprecation warning. Since this is a new file (does not exist yet), create `proxy.ts` from the start.

**Runtime:** Proxy now defaults to **Node.js runtime** (stable since Next.js 15.5; `'edge'` was the previous default). The `@supabase/ssr` package requires Node.js APIs that were unavailable in the Edge runtime — this is no longer a concern.

### `@supabase/ssr` Cookie Pattern in Proxy

The Supabase Proxy pattern in Next.js App Router requires a cookie proxy to refresh Auth tokens (Server Components cannot write cookies):

```ts
// src/proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Must call getClaims() (not getSession()) to refresh token and sync cookies.
  // Note: per security rule, DO NOT use getClaims() return value for auth decisions
  // in the proxy — proxy only syncs cookies. Auth decisions happen in requireAdmin().
  await supabase.auth.getClaims();

  // --- Admin allowlist check ---
  const { data } = await supabase.auth.getClaims();
  const githubLogin = data?.claims?.user_metadata?.user_name ?? null;
  const allowed = getAllowedLogins(); // parse ADMIN_GITHUB_LOGINS env var
  const isAllowedPath = request.nextUrl.pathname === '/admin/login';

  if (!isAllowedPath) {
    if (!githubLogin || !allowed.includes(githubLogin)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

[VERIFIED: supabase.com/docs/guides/auth/server-side/creating-a-client, 2026-05-06]
[VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy, 2026-05-06]

**`getClaims()` vs `getSession()` (CRITICAL):**
- `supabase.auth.getClaims()` — validates JWT signature against project's public keys. Use this in all server contexts.
- `supabase.auth.getSession()` — does NOT validate JWT signature in server contexts. Security gap: a tampered cookie could spoof identity.
- **Always use `getClaims()` in `proxy.ts`, server components, and route handlers.**

[VERIFIED: supabase.com/docs/guides/auth/server-side/creating-a-client, "getClaims" section]

### GitHub OAuth User Metadata

When a user signs in with GitHub OAuth, Supabase stores the GitHub profile in `user.user_metadata`. The field `user_metadata.user_name` contains the GitHub username (`login`). This was added to Supabase Auth via PR #127 (supabase/auth).

```ts
// How to read GitHub username from claims:
const { data } = await supabase.auth.getClaims();
const githubLogin: string | undefined = data?.claims?.user_metadata?.user_name;
```

[MEDIUM: github.com/supabase/auth/pull/127 — confirmed `user_name` maps to GitHub `login`]
[ASSUMED: The exact path `claims.user_metadata.user_name` — verify in `/auth/callback` with a real session log if possible]

### GitHub OAuth Flow Files

**1. `src/app/admin/login/page.tsx`** (client component — needs `'use client'`):
```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function signInWithGitHub() {
  await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
```

[VERIFIED: supabase.com/docs/reference/javascript/auth-signinwithoauth]

**2. `src/app/auth/callback/route.ts`** (server route handler):
```ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/admin/sessions';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=oauth_failed`);
}
```

[ASSUMED: Based on standard Supabase PKCE callback pattern; verify against current @supabase/ssr docs]

**Supabase Dashboard setup (operational, not code):**
- Authentication > Providers > GitHub: enabled with GitHub OAuth App credentials
- Authentication > URL Configuration: add `https://<your-domain>/auth/callback` to Allowed Redirect URLs

### `requireAdmin()` Helper Pattern

```ts
// src/lib/admin-auth.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function requireAdmin(): Promise<{ login: string } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(/* ... anon key, cookies */);

  const { data } = await supabase.auth.getClaims();
  const login = data?.claims?.user_metadata?.user_name as string | undefined;

  if (!login) return null; // not authenticated
  const allowed = (process.env.ADMIN_GITHUB_LOGINS ?? '').split(',').map(s => s.trim());
  if (!allowed.includes(login)) return null; // not in allowlist
  return { login };
}
```

**Non-allowlisted user signout**: when `requireAdmin()` returns null AND the user IS authenticated (but not in the allowlist), the server component must also call `supabase.auth.signOut()` using the **service-role client** (or a new anon client from cookies) so the session cookie is cleared.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY` Pre-commit Hook Note

CONTEXT.md D-H-04 flags that the existing pre-commit hook (Phase 1) scans for `NEXT_PUBLIC_*KEY*` patterns. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design (Supabase's anon key is safe to expose client-side). The pre-commit hook must exempt this specific key name or use a more targeted pattern.

Verify the pre-commit hook pattern — if it blocks `NEXT_PUBLIC_SUPABASE_ANON_KEY`, add an exemption comment/allowlist entry.

[ASSUMED: Current hook pattern not verified; check before Phase 4 implementation]

---

## 2. Resend + React Email

### Installation (packages not yet installed)

```bash
npm install resend @react-email/components
```

**Current versions (npm registry, 2026-05-06):**
- `resend`: `6.12.2`
- `@react-email/components`: `1.0.12`

[VERIFIED: npm registry via `npm view resend version` + `npm view @react-email/components version`]

### Resend Client + Send Pattern

```ts
// src/lib/email.ts
import { Resend } from 'resend';
import { env } from './env';

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendSessionNotification(params: {
  session_id: string;
  email: string;
  email_domain: string;
  is_priority: boolean;
  first_message: string;
  classifier_verdict: string;
  cost_cents: number;
}) {
  const subject = params.is_priority
    ? `[PRIORITY] new chat: ${params.email}`
    : `new chat: ${params.email}`;

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: env.JOE_NOTIFICATION_EMAIL,
    subject,
    react: SessionNotification(params), // React Email template as function call
  });
  // handle error...
  return data;
}
```

[VERIFIED: resend.com/docs/send-with-nextjs, 2026-05-06]

**Key: pass the React Email template as a function call (`EmailTemplate({ ...props })`), not as JSX (`<EmailTemplate />`)**. Resend handles HTML rendering internally.

### `after()` for Fire-and-Forget Email Sends

Since this project runs **Next.js 16** (≥15.1), use `after()` from `next/server` instead of `waitUntil()` from `@vercel/functions`:

```ts
// src/app/api/chat/route.ts — in onFinish callback
import { after } from 'next/server';

// After persistNormalTurn succeeds and first_email_sent_at guard passes:
after(async () => {
  await sendSessionNotification({ session_id, ... });
});
```

`after()` runs the callback after the response is sent, does not block the streaming response, and uses `waitUntil()` under the hood on Vercel. This is the officially recommended pattern for Next.js 15.1+.

[VERIFIED: vercel.com/docs/functions/functions-api-reference/vercel-functions-package, 2026-05-06]

**Note:** ARCHITECTURE.md Pattern 6 documents `waitUntil()` (from the Phase 2 research era, before Next.js 15.1 landed). Upgrade to `after()` for Phase 4 — same semantics, better integration. CONTEXT.md D-C-02 references `waitUntil()` by name; the planner should note this upgrade.

### `sessions.first_email_sent_at` Atomic Idempotency Guard

```ts
// Atomic claim: only proceed if this UPDATE returns a row
const { data: claimed } = await supabaseAdmin
  .from('sessions')
  .update({ first_email_sent_at: new Date().toISOString() })
  .eq('id', session_id)
  .is('first_email_sent_at', null)  // only update if null (not yet sent)
  .select('id')
  .single();

if (claimed) {
  after(async () => {
    await sendSessionNotification({ session_id, ... });
  });
}
```

Concurrent `/api/chat` requests for the same session race on this UPDATE. Postgres's row-level locking ensures only one wins. [VERIFIED: Postgres UPDATE with WHERE clause is atomic at the row level]

### React Email Template Pattern

```tsx
// src/emails/SessionNotification.tsx
import { Html, Body, Container, Text, Button, Section } from '@react-email/components';

export function SessionNotification({ session_id, email, is_priority, first_message, ... }: Props) {
  return (
    <Html>
      <Body>
        <Container>
          <Text>{is_priority ? '[PRIORITY] ' : ''}New chat from {email}</Text>
          <Text>First message: {first_message}</Text>
          <Button href={`https://yourdomain.com/admin/sessions/${session_id}`}>
            View transcript
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

[VERIFIED: @react-email/components@1.0.12 — Html, Body, Container, Text, Button, Section are all available]

### Alarm Emails: Plain Text (Claude's Discretion)

Per CONTEXT.md Specifics, alarm emails should be plain text for phone readability. Use Resend's `text` field:

```ts
await resend.emails.send({
  from: env.RESEND_FROM_EMAIL,
  to: env.JOE_NOTIFICATION_EMAIL,
  subject: `[ALARM] resume-agent: ${condition}`,
  text: `Alarm fired: ${condition}\nTime: ${new Date().toISOString()}\nDetails: ${details}`,
});
```

### DKIM/Sender Domain Caveat

`onboarding@resend.dev` works without DNS verification (dev/preview only). Before public deploy, Joe must set up DKIM DNS records for his custom domain in the Resend dashboard. This is an operational task, not code. The `RESEND_FROM_EMAIL` env var handles the switch.

---

## 3. cron-job.org + Bearer Secret Pattern

### Configuration (operational — Joe sets up post-deploy)

cron-job.org free tier: unlimited jobs, 1-minute granularity. No code integration needed — configure entirely in the dashboard.

**Three jobs to create:**
| Job | URL | Schedule | Method | Auth Header |
|-----|-----|----------|--------|-------------|
| check-alarms | `https://<domain>/api/cron/check-alarms` | `*/5 * * * *` (every 5 min) | POST | `Authorization: Bearer <CRON_SECRET>` |
| heartbeat | `https://<domain>/api/cron/heartbeat` | `*/5 9-18 * * 1-5` (every 5 min, 9am-6pm ET Mon-Fri) | POST | `Authorization: Bearer <CRON_SECRET>` |
| archive | `https://<domain>/api/cron/archive` | `0 8 * * *` (daily at 03:00 ET = 08:00 UTC) | POST | `Authorization: Bearer <CRON_SECRET>` |

[VERIFIED: cron-job.org supports custom HTTP headers including Authorization]

### Cron Auth Helper

```ts
// src/lib/cron-auth.ts
import { env } from './env';

export function validateCronAuth(req: Request): boolean {
  if (req.method !== 'POST') return false;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === env.CRON_SECRET;
}
```

**Every `/api/cron/*` route MUST validate at the very top:**
```ts
export async function POST(req: Request) {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  // ... cron logic
}
```

### Vercel Hobby Timeout Constraint

Vercel Hobby functions have a 60s max duration. The `archive` cron must batch to max 100 sessions per run (D-D-03) to stay within budget. With ~50KB per session JSONL + gzip overhead, 100 sessions = ~5MB total write throughput — well within the timeout.

[VERIFIED: vercel.com/docs/functions/limitations — 60s Hobby plan max]

---

## 4. Supabase Storage — Gzipped JSONL Archive

### Upload Pattern

```ts
import { gzipSync } from 'zlib';
import { supabaseAdmin } from './supabase-server';

async function archiveSession(session_id: string, messages: MessageRow[]) {
  // Build JSONL: one JSON object per line
  const jsonl = messages.map(m => JSON.stringify(m)).join('\n');

  // Gzip synchronously — acceptable in a cron route (not in a hot path)
  const gzipped: Buffer = gzipSync(jsonl);

  // File path by year/month for logical organization
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const path = `archive/${year}/${month}/${session_id}.jsonl.gz`;

  const { error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_ARCHIVE_BUCKET ?? 'transcripts-archive')
    .upload(path, gzipped, {
      contentType: 'application/gzip',
      upsert: true,   // overwrite OK — idempotent
    });

  if (error) throw error;
}
```

**File body types:** `@supabase/supabase-js` v2 storage accepts `ArrayBuffer | ArrayBufferView | Blob | Buffer | File | FormData | ReadableStream | URLSearchParams | string`. Node.js `zlib.gzipSync()` returns `Buffer`, which is an `ArrayBufferView`. [MEDIUM: supabase-js source review; not stated in scraped docs]

### Private Bucket

- Bucket must be created in Supabase dashboard BEFORE Phase 4 deploys (D-D-07 operational task)
- Set bucket to **private** (no public read)
- The service-role key (used by `supabaseAdmin`) bypasses bucket RLS policies — no Storage policy config needed for write access

### Storage Free Tier

Supabase free tier: 1GB Storage. Per-session JSONL is typically 2-20KB uncompressed; gzipped ~0.5-5KB. At 100 sessions/day × 5KB = 500KB/day → ~15MB/month → ~180MB/year. Comfortably within free tier for years.

[VERIFIED: supabase.com/pricing — 1GB Storage on free tier]

---

## 5. Anthropic Prompt-Cache Pre-Warming in Heartbeat

### Pre-Warm Call Pattern

```ts
// src/app/api/cron/heartbeat/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { env } from '@/lib/env';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function warmPromptCache(): Promise<{ cache_read_tokens: number; cost_cents: number }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: 'ping' }],
  });

  const cache_read = response.usage.cache_read_input_tokens ?? 0;
  // Cost: cache_read × $0.30/MTok = cents
  const cost_cents = Math.round((cache_read / 1_000_000) * 30);
  return { cache_read_tokens: cache_read, cost_cents };
}
```

**Use `@anthropic-ai/sdk` direct (not AI SDK) for this one-shot non-streaming call** — consistent with the pattern for Haiku classifier calls.

[VERIFIED: Anthropic prompt caching docs — `cache_control: { type: 'ephemeral' }` on system block]

### System-Prompt Determinism Contract (CRITICAL)

The heartbeat MUST call `buildSystemPrompt()` — the same exported function used by `/api/chat`. Never inline a local copy. The Anthropic cache hit is keyed on the byte-identical prefix; if the heartbeat uses a slightly different string, the cache miss occurs in recruiter sessions, not the heartbeat.

```ts
// Phase 1 / ARCHITECTURE.md Pattern 1
// buildSystemPrompt() is a module-level singleton — call once, reuse everywhere
import { buildSystemPrompt } from '@/lib/system-prompt';
```

### Cost Math

- ~85k token system prompt × $0.30/MTok cache_read = ~$0.026/call
- 5min interval × 10h business hours × 5 days/week = ~600 calls/week × $0.026 = **~$15.60/business-week**
- Break-even: each pre-warmed recruiter session saves ~14¢ on `cache_creation`. Net positive only if ≥6 sessions/business-day arrive within 5 min of a heartbeat.
- `HEARTBEAT_LLM_PREWARM` env var (default `true`) allows disabling the LLM-warm if cost outpaces benefit.

[VERIFIED: Anthropic pricing — Sonnet 4.6 cache_read $0.30/MTok, as of 2026-05-06]

---

## 6. Redis Alarm Suppression Keys

### SET NX EX Pattern

```ts
// src/lib/alarms.ts
import { redis } from './redis';

type AlarmCondition = 'spend-cap' | 'error-rate' | 'dep-down' | 'rate-limit-abuse';

/**
 * Returns true if the alarm should fire (key was absent → set it).
 * Returns false if already suppressed (key existed → NX returned null).
 * TTL: 1 hour — prevents spam for the same condition.
 */
export async function claimAlarmSuppression(condition: AlarmCondition): Promise<boolean> {
  const key = `resume-agent:alarms:fired:${condition}`;
  const result = await redis.set(key, '1', { ex: 3600, nx: true });
  return result === 'OK'; // 'OK' = key set (was absent); null = key existed (suppressed)
}
```

[VERIFIED: Upstash Redis SET NX docs — returns 'OK' on success, null if NX prevented write]
[VERIFIED: Existing redis.ts uses `redis` export from `@upstash/redis` — compatible with this pattern]

**Per-condition keys are independent.** `spend-cap` firing does NOT suppress `dep-down` alerts.

### Alarm Condition #1: Spend Cap

Read the existing rolling spend counter:

```ts
import { getSpendToday } from './redis';

const spendCents = await getSpendToday();
const tripped = spendCents >= 300; // 300 cents = $3.00 (matches SAFE-04 threshold)
```

[VERIFIED: src/lib/redis.ts — `getSpendToday()` and 300 cent cap already implemented]

### Alarm Condition #2: Error Rate >2% over 10min

```sql
-- Supabase query (example — planner picks exact implementation)
SELECT
  COUNT(*) FILTER (WHERE stop_reason = 'error' OR (content = '' AND stop_reason NOT LIKE 'deflection:%')) AS error_count,
  COUNT(*) AS total_count
FROM messages
WHERE created_at > now() - interval '10 minutes'
  AND role = 'assistant'
```

Claude's discretion: require minimum sample of ≥10 turns in the window to suppress false positives on low-traffic periods.

### Alarm Condition #3: Any Dependency Down

Import `pingAnthropic`, `pingClassifier`, `pingSupabase`, `pingUpstash`, `pingExa` from existing `src/lib/health.ts` — or fetch `/api/health` internally. Either works; direct import is cleaner for a cron route.

```ts
import { pingAnthropic, pingClassifier, pingSupabase, pingUpstash, pingExa } from '@/lib/health';

const [anthropic, classifier, supabase, upstash, exa] = await Promise.all([
  pingAnthropic(), pingClassifier(), pingSupabase(), pingUpstash(), pingExa()
]);
const anyDown = [anthropic, classifier, supabase, upstash, exa].some(s => s !== 'ok');
```

[VERIFIED: src/lib/health.ts — all five ping helpers exist and return `DepStatus`]

### Alarm Condition #4: ≥5 Unique IPs Hitting Rate Limits in 1h

```sql
-- Supabase query
SELECT COUNT(DISTINCT s.ip_hash) AS unique_ips
FROM messages m
JOIN sessions s ON m.session_id = s.id
WHERE m.stop_reason = 'deflection:ratelimit'
  AND m.created_at > now() - interval '1 hour'
```

Returns a count; condition trips if count ≥ 5.

---

## 7. shadcn/ui `<Table>` Primitive

### Installation

```bash
npx shadcn@latest add table
```

Creates `src/components/ui/table.tsx`. [VERIFIED: shadcn CLI behavior — copies to `components/ui/`]

### Table API

```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Email</TableHead>
      <TableHead>Domain</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {sessions.map(s => (
      <TableRow key={s.id}>
        <TableCell>{s.email}</TableCell>
        <TableCell>{s.email_domain}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

[VERIFIED: ui.shadcn.com/docs/components/table]

### URL-Driven Sort (App Router Pattern)

Clickable column headers push search params; server component re-renders with new `ORDER BY`:

```tsx
// /admin/sessions/page.tsx — server component
import { type SearchParams } from 'next/dist/server/request/search-params';
import Link from 'next/link';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sortBy = sp.sort === 'domain' ? 'email_domain' : 'created_at';
  const sortDir = sp.dir === 'asc' ? 'asc' : 'desc';

  const { data: sessions } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .order(sortBy, { ascending: sortDir === 'asc' })
    .limit(100);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Link href={`/admin/sessions?sort=created_at&dir=${sortDir === 'asc' ? 'desc' : 'asc'}`}>
              Date
            </Link>
          </TableHead>
          {/* ... */}
        </TableRow>
      </TableHeader>
      {/* ... */}
    </Table>
  );
}
```

No client-side state needed — `<Link>` pushes new URL, server component re-fetches. Segment `revalidate = 60` still applies; manual refresh button calls `router.refresh()`.

---

## 8. Next.js 16 Proxy (formerly Middleware) Constraints

### Runtime

**Proxy now defaults to Node.js runtime** (stable since Next.js 15.5; Edge was the pre-15.2 default). This is significant:
- `@supabase/ssr` is fully compatible in Node.js proxy (no edge constraints)
- Full Node.js APIs available (no WebCrypto-only restriction)
- No `export const runtime = 'edge'` needed or desired

[VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy — "Proxy defaults to using the Node.js runtime"]

### Matcher Pattern

```ts
// Exclude /admin/login from protection (D-A-05)
export const config = {
  matcher: [
    '/admin/((?!login).*)',   // /admin/* EXCEPT /admin/login
    '/api/admin/:path*',
  ],
};
```

Or equivalently use negative lookahead in a single pattern. The key: `/admin/login` must NOT be in the matcher or unauthed users can't reach the sign-in button.

### `waitUntil` in Proxy Context

The Next.js proxy's second parameter `event: NextFetchEvent` has its own `waitUntil()` method (pre-15.1 pattern). In proxy.ts, use `event.waitUntil()` for any background work, NOT `after()`. `after()` is for route handlers and server components only.

```ts
export async function proxy(req: NextRequest, event: NextFetchEvent) {
  event.waitUntil(doSomeLogging());
  return NextResponse.next();
}
```

However, Phase 4 proxy only needs to: sync cookies, check allowlist, redirect. No fire-and-forget work needed in the proxy itself — background email sends happen in the `/api/chat` route handler via `after()`.

---

## 9. Pino Logging — Phase 4 Event Types

No changes to `src/lib/logger.ts` needed. The existing `log({ event: '...', ...fields }, level)` pattern supports all 7 new event types from D-F-01:

```ts
log({ event: 'admin_access', github_login, path });
log({ event: 'admin_403', github_login, reason, attempted_path }, 'warn');
log({ event: 'cron_run', cron_name, duration_ms, status, items_processed });
log({ event: 'alarm_fired', condition, resend_send_id, suppression_until_ts });
log({ event: 'archive_run', sessions_archived, rows_archived, rows_deleted_classifier_90d, errors });
log({ event: 'heartbeat', deps_pinged, latencies_ms, anthropic_cache_read_tokens, cost_cents });
log({ event: 'session_email_sent', session_id, email_domain, is_priority, resend_send_id, latency_ms });
```

Pino's structured JSON logger accepts arbitrary fields — no schema enforcement needed. [VERIFIED: src/lib/logger.ts — `childLogger` and `log` exports accept `Record<string, unknown>`]

**Pino discipline reminder (from PITFALLS.md):**
- JSON to stdout only — no worker-thread transports in production
- No `pino-pretty` in production builds
- Existing `logger.ts` already correct; do not modify

---

## 10. BetterStack Synthetic Monitor

### Free Tier Details

- **10 monitors** (this project needs 1)
- **3-minute check interval** (CONTEXT.md D-E-02 says "every 3 min")
- **Public status page** included at `status.yourdomain.com` or `betteruptime.com/your-team`
- **Multiple geographic regions** (exact count not confirmed in scraped docs)
- **Alerts**: Joe's email (`JOE_NOTIFICATION_EMAIL`)

[MEDIUM: betterstack.com/uptime landing page — "10 monitors, 10 heartbeats, and a status page with 3-minute checks totally free"]

### Status Page Iframe Embed

BetterStack docs did not confirm iframe embed support in the content retrieved. **Recommend link-out as the safe default** for `/admin/health`:

```tsx
// src/app/admin/health/page.tsx
{env.BETTERSTACK_DASHBOARD_URL && (
  <a href={env.BETTERSTACK_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
    View BetterStack Status Page
  </a>
)}
```

If Joe verifies iframe works in BetterStack UI, can upgrade to `<iframe>` later.

### No Code Integration

BetterStack is purely external — configured in its dashboard, no code in the project beyond the link-out. Phase 4 adds `BETTERSTACK_DASHBOARD_URL` as an optional env var.

---

## 11. Environment Changes (D-H-01)

The existing `src/lib/env.ts` already has:
- `NEXT_PUBLIC_SUPABASE_URL` (added Phase 1)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (added Phase 1)
- `SUPABASE_SERVICE_ROLE_KEY` (Phase 1)
- `RESEND_API_KEY` (currently `z.string().optional()` — Phase 4 must make REQUIRED)
- `ADMIN_GITHUB_USERNAMES` (currently `z.string().optional()` — Phase 4 must rename to `ADMIN_GITHUB_LOGINS` and make REQUIRED)

Phase 4 additions/changes to env schema:
```ts
// Existing optionals to promote to required:
RESEND_API_KEY: z.string().startsWith('re_'),  // was optional
ADMIN_GITHUB_LOGINS: z.string().min(1),         // was optional + renamed

// New required vars:
CRON_SECRET: z.string().min(32),
RESEND_FROM_EMAIL: z.string().email(),
JOE_NOTIFICATION_EMAIL: z.string().email(),
SUPABASE_STORAGE_ARCHIVE_BUCKET: z.string().default('transcripts-archive'),

// New optional vars:
BETTERSTACK_DASHBOARD_URL: z.url().optional(),
HEARTBEAT_LLM_PREWARM: z.string().optional().default('true'),
```

**Note:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in the schema (Phase 1 added them). No new additions needed there.

[VERIFIED: src/lib/env.ts — confirmed current schema state]

---

## 12. Schema Migration (0002_phase4.sql)

The only schema additions per D-G-01:

```sql
-- supabase/migrations/0002_phase4.sql

-- Per-session email idempotency guard
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS first_email_sent_at timestamptz;

-- Alarm history for /admin/health "last 5 alarms" widget
CREATE TABLE IF NOT EXISTS public.alarms_fired (
  id             text primary key,
  condition      text not null,
  fired_at       timestamptz not null default now(),
  resend_send_id text,
  body_summary   text
);
CREATE INDEX IF NOT EXISTS alarms_fired_fired_at_idx ON public.alarms_fired (fired_at DESC);
ALTER TABLE public.alarms_fired ENABLE ROW LEVEL SECURITY;
-- service-role-only; no SELECT policy (admin reads via service role bypassing RLS)
```

No other schema changes needed. Existing `sessions` + `messages` schema handles all admin queries via aggregate SUMs and JOINs.

---

## Pitfalls and Anti-Patterns

### Pitfall 1: Creating `middleware.ts` Instead of `proxy.ts` in Next.js 16

**What goes wrong:** Creating `src/middleware.ts` (or `src/app/middleware.ts`) will produce a deprecation warning. The correct file name in Next.js 16 is `src/proxy.ts` (or `proxy.ts` at project root).

**Failure mode:** Code works but emits warnings on every build. Future Next.js versions may remove `middleware.ts` support entirely.

**Fix:** Create `src/proxy.ts` with `export function proxy(...)` and `export const config = { matcher: [...] }`.

[VERIFIED: nextjs.org/docs/messages/middleware-to-proxy]

### Pitfall 2: Using `getSession()` Instead of `getClaims()` in Server Contexts

**What goes wrong:** `supabase.auth.getSession()` in `proxy.ts`, server components, or route handlers returns a session object without validating the JWT signature. An attacker who can forge or tamper with session cookies (or intercept them) can bypass the admin allowlist check.

**Correct pattern:** Always `supabase.auth.getClaims()` in any server context.

[VERIFIED: supabase.com/docs/guides/auth/server-side/creating-a-client]

### Pitfall 3: Using `waitUntil()` From `@vercel/functions` in Route Handlers (Next.js 16)

**What goes wrong:** The code works but uses the deprecated Vercel-specific API when Next.js 16 provides the better-integrated `after()` from `next/server`.

**Correct pattern:** `import { after } from 'next/server'` in route handlers and server components. Keep `import { waitUntil } from '@vercel/functions'` only if needed in non-Next.js contexts.

[VERIFIED: vercel.com/docs/functions/functions-api-reference/vercel-functions-package — "If you're using Next.js 15.1 or above, we recommend using the built-in after() function"]

### Pitfall 4: Blocking `/api/chat` Response on Email Send

**What goes wrong:** Awaiting `sendSessionNotification()` inside `onFinish` without `after()` adds 200-600ms to chat response latency (Resend API round-trip).

**Correct pattern:** Wrap in `after(async () => { ... })`. The response stream is already closed; the email fires in the background.

### Pitfall 5: Heartbeat Using a Different System Prompt Than `/api/chat`

**What goes wrong:** If `heartbeat` route.ts builds its own prompt string (instead of calling `buildSystemPrompt()`), the Anthropic cache key will differ from the one `/api/chat` uses. Every recruiter session starts with a cache miss, paying `cache_creation` rates instead of `cache_read` rates — roughly 12x more expensive.

**Correct pattern:** Always `import { buildSystemPrompt } from '@/lib/system-prompt'`. This is the Phase 1 determinism contract.

### Pitfall 6: Per-Condition Redis Suppression Key Uses Wrong Return Value

**What goes wrong:** Checking `result !== null` instead of `result === 'OK'` inverts the logic. Null means the key already existed (suppressed); 'OK' means the key was freshly set (fire the alarm).

**Correct pattern:**
```ts
const result = await redis.set(key, '1', { ex: 3600, nx: true });
const shouldFire = result === 'OK';  // NOT: result !== null
```

[VERIFIED: Upstash Redis NX return value behavior — 'OK' on success, null on NX block]

### Pitfall 7: `ADMIN_GITHUB_LOGINS` Env Var Not Matching Exact GitHub Username Case

**What goes wrong:** GitHub usernames are case-sensitive for comparison purposes in some contexts. If `ADMIN_GITHUB_LOGINS=joedollinger` but the OAuth token returns `JoeDollinger`, the allowlist check fails.

**Mitigation:** Lowercase both the env var list and the `user_name` from claims during comparison:
```ts
const allowed = env.ADMIN_GITHUB_LOGINS.split(',').map(s => s.trim().toLowerCase());
const login = (data?.claims?.user_metadata?.user_name ?? '').toLowerCase();
```

[ASSUMED: GitHub OAuth returns lowercase username; normalize defensively]

### Pitfall 8: Supabase Free Tier Inactivity Pause During Development

**What goes wrong:** Supabase free projects auto-pause after 7 days of inactivity. If Joe's dev environment goes idle (e.g., between Phase 3 and Phase 4 implementation), the database pauses and the heartbeat cron that's supposed to prevent it hasn't been deployed yet.

**Mitigation:** During active development, keep the Supabase project active manually (or deploy heartbeat cron early in Phase 4). Documented in STACK.md.

### Pitfall 9: Archive Cron Deleting Messages Before Storage Upload Succeeds

**What goes wrong:** If the Storage upload fails but the DELETE runs anyway, transcript data is lost permanently.

**Correct pattern (D-D-03 algorithm):** Upload FIRST, then DELETE. If upload fails, log error and continue to next session (idempotent — re-run will retry).

### Pitfall 10: `@supabase/ssr` `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**What it is:** The official Supabase docs now use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (newer naming). This project already has `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Phase 1. Both work with `@supabase/ssr@0.10.2`.

**Action:** Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` — it's already set, already in the env schema, and the installed `@supabase/ssr` version accepts it. Do not rename.

---

## Key Decisions Confirmed

| Decision from CONTEXT.md | Status | Notes |
|---|---|---|
| `@supabase/ssr` is current for Next.js 16 | **CONFIRMED** | v0.10.2 installed; compatible with proxy.ts / Node.js runtime |
| File name `middleware.ts` for admin perimeter | **CORRECTED** | Must be `proxy.ts` in Next.js 16; `middleware.ts` is deprecated |
| `getClaims()` not `getSession()` in server code | **CONFIRMED** | Official Supabase SSR docs mandate this |
| `waitUntil()` from `@vercel/functions` for email fire | **UPGRADED** | Use `after()` from `next/server` (Next.js 16 ≥ 15.1 preferred path) |
| Resend + React Email for notifications | **CONFIRMED** | Not yet installed; `npm install resend @react-email/components` |
| cron-job.org for 3 scheduled jobs | **CONFIRMED** | Vercel Hobby allows only 1 cron; cron-job.org fills the gap |
| Supabase Storage for cold archive (gzipped JSONL) | **CONFIRMED** | Buffer upload works; private bucket; 1GB free |
| BetterStack 3-min checks, free tier | **CONFIRMED** | 10 monitors, 3-min interval, status page included |
| Redis `SET key NX EX` for alarm suppression | **CONFIRMED** | Returns 'OK' if set, null if existing; correct gate for alarm dispatch |
| shadcn Table primitive, no third-party data table | **CONFIRMED** | `npx shadcn@latest add table` |
| `buildSystemPrompt()` in heartbeat (IDENTICAL to /api/chat) | **CONFIRMED** | Phase 1 determinism contract; cache key equality requires byte-identical prefix |

---

## Open Questions

1. **`user_metadata.user_name` field name — verify on first real GitHub login**
   - What we know: Supabase maps GitHub `login` to `user_name` in `raw_user_meta_data` (PR #127, community examples)
   - What's unclear: Whether the exact path is `claims.user_metadata.user_name` or `claims.user.user_metadata.user_name` — structure of `getClaims()` return shape
   - Recommendation: Planner should add a debug log in `/auth/callback` on first login: `log({ event: 'oauth_debug', claims: data?.claims })` — one-time diagnostic, remove after confirmed

2. **`ADMIN_GITHUB_LOGINS` env var rename**
   - Current `env.ts` has `ADMIN_GITHUB_USERNAMES` (optional). Phase 4 renames it to `ADMIN_GITHUB_LOGINS` per D-A-02 and D-H-01.
   - Any `.env.local` or `.env.example` files with the old name must be updated.
   - Recommendation: Planner treats this as a rename task in the env schema wave.

3. **Pre-commit hook exemption for `NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - CONTEXT.md D-H-04 flags this. The current hook pattern is unknown.
   - Recommendation: Early in Phase 4, verify by running the pre-commit hook with a staged change that touches `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If it blocks, add an exemption.

4. **BetterStack status page iframe support**
   - Not confirmed in docs retrieved. Claude's discretion: default to link-out.
   - Recommendation: Joe can check the BetterStack dashboard after creating the status page; if iframe embed URL is provided, upgrade to `<iframe>` in a follow-on commit.

5. **`getClaims()` return shape in `@supabase/ssr@0.10.2`**
   - Official docs show `data.claims.user_metadata.user_name` but the exact TypeScript return type of `supabase.auth.getClaims()` in v0.10.2 was not verified from source.
   - Recommendation: Planner should check `node_modules/@supabase/ssr/dist/types.d.ts` or the `@supabase/auth-js` types to confirm the shape during task authoring.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/ssr` | Proxy auth, createServerClient | ✓ | 0.10.2 | — |
| `@supabase/supabase-js` | Storage upload, all DB queries | ✓ | 2.104.0 | — |
| `@vercel/functions` | `after()` supersedes; kept for ipAddress() | ✓ | 3.4.4 | — |
| `resend` | Session notification emails, alarm emails | ✗ | — | Install: `npm install resend` |
| `@react-email/components` | React Email templates | ✗ | — | Install: `npm install @react-email/components` |
| `pino` | Structured logging | ✓ | 10.3.1 | — |
| `next` (proxy.ts) | Admin perimeter gating | ✓ | 16.2.4 | — |
| `zlib` (Node.js built-in) | Gzip for archive | ✓ | Node.js 25.9 built-in | — |
| Supabase Storage bucket | Archive cron | ✗ (operational) | — | Joe creates bucket in dashboard pre-deploy |
| BetterStack account | External monitor | ✗ (operational) | — | Joe creates account and monitor post-deploy |
| cron-job.org account | 3 scheduled crons | ✗ (operational) | — | Joe configures 3 jobs post-deploy |

**Missing code dependencies:**
- `resend` + `@react-email/components` — must install before implementing email features (Wave 1 or Wave 0)

**Missing operational dependencies (no code fallback — need Joe action before full Phase 4 is live):**
- Supabase Storage `transcripts-archive` bucket creation
- BetterStack monitor setup
- cron-job.org 3-job configuration
- Resend DKIM DNS records for custom sender domain (can use `onboarding@resend.dev` for dev)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub OAuth sets `user_metadata.user_name` to the GitHub `login` (username) | §Auth | Admin allowlist check fails for all users; sign-in → 403 every time |
| A2 | Supabase `@supabase/ssr@0.10.2` `.upload()` accepts Node.js `Buffer` as file body | §Storage | Archive cron fails with type error; needs `Buffer.from(gzipped)` or `new Blob([gzipped])` workaround |
| A3 | `supabase.auth.getClaims()` return type is `{ data: { claims: { user_metadata: { user_name: string } } } }` | §Auth | Allowlist check reads wrong field; all admins get 403 |
| A4 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the correct env var name for `@supabase/ssr@0.10.2` (not `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | §Auth | Auth client initialization fails at runtime |
| A5 | Pre-commit hook does NOT currently block `NEXT_PUBLIC_SUPABASE_ANON_KEY` | §Auth | Hook blocks Phase 4 implementation commits |

---

## Sources

### Primary (HIGH confidence)
- [Next.js 16 proxy.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — middleware→proxy rename, Node.js default runtime, matcher syntax — retrieved 2026-05-06
- [Vercel @vercel/functions package docs](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) — `waitUntil()` deprecated for Next.js 15.1+; `after()` preferred — retrieved 2026-05-06
- [Supabase SSR creating-a-client docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `createServerClient`, `createBrowserClient`, `getClaims()` vs `getSession()` — retrieved 2026-05-06
- [Resend Next.js docs](https://resend.com/docs/send-with-nextjs) — `resend.emails.send()` API, React component pass as function call — retrieved 2026-05-06
- [Upstash Redis SET docs](https://upstash.com/docs/redis/sdks/ts/commands/string/set) — NX + EX options, return value — retrieved 2026-05-06
- [Next.js middleware-to-proxy migration](https://nextjs.org/docs/messages/middleware-to-proxy) — codemod instructions, rename diff — retrieved 2026-05-06
- Installed package: `src/lib/redis.ts` — confirms `getSpendToday()`, 300 cent cap, `redis.set()` with `{ ex, nx }` compatible
- Installed package: `src/lib/health.ts` — confirms 5 ping helpers available for alarm condition #3
- Installed package: `src/lib/persistence.ts` — confirms `persistNormalTurn()` signature for email trigger integration
- Installed package: `src/lib/env.ts` — confirms existing env schema, optional RESEND_API_KEY and ADMIN_GITHUB_USERNAMES
- npm registry: `resend@6.12.2`, `@react-email/components@1.0.12` (current as of 2026-05-06)

### Secondary (MEDIUM confidence)
- [BetterStack uptime landing](https://betterstack.com/uptime) — "10 monitors, 10 heartbeats and a status page with 3-minute checks totally free"
- [Supabase GitHub OAuth PR #127](https://github.com/supabase/auth/pull/127) — confirms `user_name` field in user_metadata for GitHub provider
- WebSearch: Next.js 16 proxy.ts + Supabase auth 2026 (multiple sources confirming Node.js runtime + proxy.ts pattern)

### Tertiary (LOW confidence — flagged as ASSUMED)
- `getClaims()` return shape — inferred from community examples; not verified from TypeScript types
- `Buffer` accepted by Supabase Storage upload — inferred from supabase-js source patterns; not directly confirmed from docs retrieved
- GitHub username case-sensitivity in `user_metadata.user_name` — defensive assumption

---

## RESEARCH COMPLETE
