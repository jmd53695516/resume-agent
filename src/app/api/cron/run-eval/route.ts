// src/app/api/cron/run-eval/route.ts
// Phase 5 Plan 05-11. Weekly drift run (EVAL-11).
//
// IMPORTANT: this route does NOT spawn the eval CLI directly.
// Vercel functions have a 60s max duration; our eval suite runs 3-5 minutes.
// Instead, this route triggers GitHub Actions via repository_dispatch (event_type
// 'scheduled-eval'); the existing workflow (Plan 05-10 .github/workflows/eval.yml)
// routes that into the same eval body running against PROD URL.
//
// Auth: validateCronAuth (Phase 4 D-C-09 reuse) — POST + Bearer CRON_SECRET.
// Schedule: cron-job.org Mon 03:00 ET, 4th scheduled job (Plan 05-11 Task 4).
//
// Threat-register: T-05-11-01..06. GH_DISPATCH_TOKEN never returned in
// response body; only the dispatch outcome is surfaced.
import { validateCronAuth } from '@/lib/cron-auth';
import { childLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const log = childLogger({ event: 'cron_run', cron_name: 'run-eval' });
  const started = Date.now();

  const ghToken = process.env.GH_DISPATCH_TOKEN;
  if (!ghToken) {
    log.error(
      { reason: 'GH_DISPATCH_TOKEN unset', duration_ms: Date.now() - started },
      'run_eval_dispatch_skipped',
    );
    return Response.json(
      { error: 'GH_DISPATCH_TOKEN not configured' },
      { status: 503 },
    );
  }

  // Default to the actual repo (jmd53695516/resume-agent — see project memory
  // / 05-10-SUMMARY.md). GH_REPO_SLUG env var overrides for repo renames.
  const repoSlug = process.env.GH_REPO_SLUG ?? 'jmd53695516/resume-agent';
  // T-05-11-03 mitigation: target_url comes from process.env, never the request body.
  // Fallback is the apex URL locked in 05-12 (D-12-A-02: 'chat' is already in the
  // apex name; no chat.* subdomain exists). NEXT_PUBLIC_SITE_URL is .optional() in
  // env.ts; the fallback only fires if that env var drifts.
  const targetUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://joe-dollinger-chat.com';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoSlug}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'resume-agent-cron',
        },
        body: JSON.stringify({
          event_type: 'scheduled-eval',
          client_payload: { target_url: targetUrl },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      log.error(
        {
          status: res.status,
          body: text.slice(0, 200),
          duration_ms: Date.now() - started,
        },
        'run_eval_dispatch_failed',
      );
      return Response.json(
        { error: 'github dispatch failed', status: res.status },
        { status: 502 },
      );
    }

    log.info(
      {
        status: 'dispatched',
        targetUrl,
        repoSlug,
        duration_ms: Date.now() - started,
      },
      'run_eval_dispatched',
    );
    return Response.json({ ok: true, dispatched_to: 'github-actions' });
  } catch (e) {
    log.error(
      {
        err: (e as Error).message,
        duration_ms: Date.now() - started,
      },
      'run_eval_dispatch_throw',
    );
    return Response.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }
}

// Belt-and-suspenders: 405 for GET so accidental browser hits don't get the
// generic 401 (validateCronAuth rejects non-POST, but a 405 is clearer in
// logs/devtools). validateCronAuth still rejects non-POST at the Bearer check
// path; this branch is unreachable when called via POST handler binding alone,
// so Next.js will return 405 automatically for GET. We don't export GET here.
