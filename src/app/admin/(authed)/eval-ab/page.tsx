// src/app/admin/(authed)/eval-ab/page.tsx
//
// Phase 5 Plan 05-08 Task 3 — Joe-only blind A/B test page (EVAL-05).
//
// Path correction (Rule 3 — execute-plan.md): plan frontmatter listed
// `src/app/(authed)/admin/eval-ab/page.tsx`. Actual repo convention since
// Phase 4 is `src/app/admin/(authed)/eval-ab/page.tsx` (the admin layout
// at `src/app/admin/(authed)/layout.tsx` provides the requireAdmin gate).
//
// Per CONTEXT D-A-03 (two-layer admin perimeter), this page also calls
// requireAdmin() per-page as belt-and-suspenders.
//
// Flow (RESEARCH §10):
//   1. Server component pre-warms 5 fresh agent paragraphs in parallel
//      (Open Question 4 mitigation — friend-tester sees ready cards).
//   2. Loads 5 curated voice.md excerpts from evals/cat-04-real-joe.yaml.
//   3. createAbSession shuffles + persists mapping in eval_ab_sessions.
//   4. Sets HTTP-only `ra_eval_session` cookie (Pitfall 6 prefix isolation
//      from @supabase/ssr cookie names).
//   5. Renders AbClient with snippets that have `kind` stripped (T-05-08-01).
//
// Cookie: name=ra_eval_session, httpOnly, secure (prod-only — dev http needs false),
// sameSite=strict, maxAge=3600 (1h matches eval_ab_sessions.expires_at default),
// path=/admin/eval-ab.
//
// Reuses src/lib/eval/agent-client.ts (mintEvalSession + callAgent) — synthetic
// session_ids would be rejected by /api/chat (BL-17). Each pre-warm call uses
// the same minted session_id; the agent treats them as multi-turn but voice
// quality of each first reply is what we render.

import { cookies, headers } from 'next/headers';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

import { requireAdmin } from '@/lib/admin-auth';
import { createAbSession } from '@/lib/eval/ab-mapping';
import { callAgent, mintEvalSession } from '@/lib/eval/agent-client';
import { childLogger } from '@/lib/logger';
import NotAuthorized from '../../components/NotAuthorized';
import { AbClient } from './AbClient';

export const dynamic = 'force-dynamic';

const log = childLogger({ event: 'eval_ab_page' });

const COOKIE_NAME = 'ra_eval_session';
const COOKIE_MAX_AGE_SECONDS = 3600;

/** Resolve the absolute base URL of the running Next.js server. */
async function resolveTargetUrl(): Promise<string> {
  // Prefer NEXT_PUBLIC_SITE_URL when explicitly set (most reliable for production).
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return explicit.startsWith('http') ? explicit : `https://${explicit}`;
  }
  // Fall back to inspecting the current request headers.
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  // Final fallback for local dev when neither env nor header is available.
  return 'http://localhost:3000';
}

interface PromptYamlEntry {
  case_id: string;
  prompt: string;
}
interface RealJoeYamlEntry {
  case_id: string;
  source?: string;
  snippet: string;
}

async function loadCat4Prompts(): Promise<PromptYamlEntry[]> {
  const raw = await readFile(
    path.join(process.cwd(), 'evals', 'cat-04-prompts.yaml'),
    'utf8',
  );
  const list = yaml.load(raw) as PromptYamlEntry[];
  if (!Array.isArray(list) || list.length < 5) {
    throw new Error(
      `cat-04-prompts.yaml must contain at least 5 entries (got ${
        Array.isArray(list) ? list.length : 'non-array'
      })`,
    );
  }
  return list.slice(0, 5);
}

async function loadRealJoeExcerpts(): Promise<
  Array<{ source_id: string; snippet: string }>
> {
  const raw = await readFile(
    path.join(process.cwd(), 'evals', 'cat-04-real-joe.yaml'),
    'utf8',
  );
  const list = yaml.load(raw) as RealJoeYamlEntry[];
  if (!Array.isArray(list) || list.length < 5) {
    throw new Error(
      `cat-04-real-joe.yaml must contain at least 5 entries (got ${
        Array.isArray(list) ? list.length : 'non-array'
      })`,
    );
  }
  return list.slice(0, 5).map((e) => ({
    source_id: e.case_id,
    snippet: e.snippet,
  }));
}

/**
 * Pre-warm: issues 5 /api/chat calls in parallel using a freshly-minted eval
 * session. Returns one paragraph per prompt. Reuses the eval-cli's
 * mintEvalSession + callAgent helpers (BL-17 — /api/chat validates session
 * existence in Supabase; synthetic session_ids are rejected).
 *
 * Per-call failures fall back to a placeholder string so the page still
 * renders — Joe can refresh to retry. Logging surfaces individual failures.
 */
async function generateAgentParagraphs(
  targetUrl: string,
): Promise<Array<{ source_id: string; snippet: string }>> {
  const prompts = await loadCat4Prompts();
  const sessionId = await mintEvalSession(targetUrl);
  log.info({ sessionId, targetUrl }, 'eval_ab_prewarm_started');

  const paragraphs = await Promise.all(
    prompts.map(async (p) => {
      try {
        const { response } = await callAgent({
          targetUrl,
          prompt: p.prompt,
          sessionId,
        });
        return { source_id: p.case_id, snippet: response };
      } catch (err) {
        log.warn(
          { caseId: p.case_id, error: (err as Error).message },
          'eval_ab_prewarm_case_error',
        );
        return {
          source_id: p.case_id,
          snippet: `[pre-warm failed for ${p.case_id} — please refresh the page]`,
        };
      }
    }),
  );

  return paragraphs;
}

export default async function EvalAbPage() {
  // D-A-03 belt-and-suspenders: per-page guard in addition to (authed) layout.
  const admin = await requireAdmin();
  if (!admin) return <NotAuthorized />;

  const targetUrl = await resolveTargetUrl();

  let agentParagraphs: Array<{ source_id: string; snippet: string }>;
  let realJoeExcerpts: Array<{ source_id: string; snippet: string }>;
  try {
    [agentParagraphs, realJoeExcerpts] = await Promise.all([
      generateAgentParagraphs(targetUrl),
      loadRealJoeExcerpts(),
    ]);
  } catch (err) {
    log.error(
      { error: (err as Error).message, targetUrl },
      'eval_ab_setup_failed',
    );
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-semibold">Cat 4 Blind A/B Test</h1>
        <p className="text-sm text-destructive">
          Setup failed: {(err as Error).message}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Refresh to retry. If the failure persists, check that
          /api/chat is reachable at {targetUrl} and that
          evals/cat-04-real-joe.yaml exists.
        </p>
      </div>
    );
  }

  const { sessionId, renderedSnippets } = await createAbSession({
    agentParagraphs,
    realJoeExcerpts,
  });

  // Set HTTP-only cookie. secure: production only — dev runs over http://localhost
  // and the secure flag would prevent the cookie from being set at all.
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/admin/eval-ab',
  });

  log.info(
    { sessionId, targetUrl, snippetCount: renderedSnippets.length },
    'eval_ab_page_rendered',
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Cat 4 Blind A/B Test</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Tester: select a role, then click <strong>AI</strong> or{' '}
        <strong>Joe</strong> for each of the 10 snippets below. Submit when
        done. The mapping is server-side; nothing in the page reveals
        which is which.
      </p>
      <AbClient sessionId={sessionId} snippets={renderedSnippets} />
    </div>
  );
}
