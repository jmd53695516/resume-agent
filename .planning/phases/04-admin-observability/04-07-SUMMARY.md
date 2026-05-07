---
phase: 04
plan: 07
subsystem: cron-retention
tags: [cron, heartbeat, archive, retention, prompt-cache, supabase-storage, gzip-jsonl, observability]
requirements_addressed: [OBSV-13, OBSV-14, OBSV-15]
dependency-graph:
  requires:
    - "Plan 04-01 — env.SUPABASE_STORAGE_ARCHIVE_BUCKET (default 'transcripts-archive') + env.HEARTBEAT_LLM_PREWARM (default 'true') + private bucket created Joe-side"
    - "Plan 04-06 — validateCronAuth() in src/lib/cron-auth.ts (POST + Bearer + constant-time compare)"
    - "Plan 03-02 — heartbeat:anthropic / heartbeat:classifier Redis key convention (TTL 120s) — heartbeat cron writes the same key the chat onFinish writes"
    - "Plan 03-04 — health.ts ping helpers (pingAnthropic/Classifier/Supabase/Upstash/Exa)"
    - "Phase 1 — buildSystemPrompt() byte-identical determinism contract (Pitfall 5)"
  provides:
    - "src/lib/archive.ts — buildJsonlGzip + uploadArchive + findArchiveCandidates + archiveSession + deleteClassifierFlags90d (consumed by /api/cron/archive)"
    - "/api/cron/heartbeat — 5-min business-hours pre-warm; writes heartbeat:anthropic Redis key on success; mute mechanism for Plan 04-06 dep-down alarm"
    - "/api/cron/archive — daily 180d→cold + 90d classifier purge; idempotent; capped at 100 sessions/run"
  affects: []
tech-stack:
  added: []
  patterns:
    - "Upload-first-then-delete order (RESEARCH Pitfall 9) — failed Storage upload MUST never trigger DELETE, otherwise transient Storage outage destroys transcripts"
    - "gzip-JSONL via zlib.gzipSync + Buffer (Node-only, runtime='nodejs')"
    - "Idempotent archive: Storage upsert:true + DELETE-on-already-deleted is a no-op → safe to re-run"
    - "Lazy Anthropic client construction (mirrors anthropic.ts anthropicClient() + Plan 04-05 Resend lazy pattern) — keeps module import cheap for tests"
    - "vi.hoisted() container with mutable env fields read via getter — clean way to flip HEARTBEAT_LLM_PREWARM per-test without resetModules ceremony"
    - "Class-based vi.mock for @anthropic-ai/sdk default export (Plan 03-00 Exa + Plan 04-05 Resend pattern) — arrow vi.fn() not constructible against `new Anthropic(...)`"
    - "Two parallel Promise.all deletes for classifier_verdict + deflection paths — supabase-js doesn't OR cleanly across distinct conditions in a single chain"
key-files:
  created:
    - "src/lib/archive.ts"
    - "src/app/api/cron/heartbeat/route.ts"
    - "src/app/api/cron/archive/route.ts"
    - "tests/lib/archive.test.ts"
    - "tests/cron/heartbeat.test.ts"
    - "tests/cron/archive.test.ts"
    - ".planning/phases/04-admin-observability/04-07-SUMMARY.md"
  modified: []
decisions:
  - "Lazy Anthropic client in heartbeat route — module-load constructor would force every other test that imports the route module (none today, but defensive) to fully wire ANTHROPIC_API_KEY in env mock; lazy keeps the surface narrow"
  - "vi.hoisted() with `get env()` getter on the env mock — lets the test mutate mocks.HEARTBEAT_LLM_PREWARM between tests without re-mocking. Cleaner than vi.spyOn(env, 'env', 'get') per-test"
  - "Classifier purge ALWAYS runs even on zero archive candidates — independent retention policies; emptied archive list shouldn't skip the 90d hard-delete step"
  - "status: 'partial' when archive run has any errors[] entries — separate from 'ok' so cron-job.org alerting can distinguish a noisy run from a clean one"
  - "Cost-rounding via Math.round (NOT Math.ceil) for cache_read cost_cents in heartbeat log — heartbeat cost is reportable not chargeable; the chargeable spend cap path (incrementSpend in cost.ts) still uses Math.ceil"
  - "Storage path convention archive/<yyyy>/<mm>/<session_id>.jsonl.gz baked into archivePath() helper, locked by a dedicated test that asserts the path regex + contentType + upsert opts"
  - "deleteClassifierFlags90d uses Promise.all on the two deletes (classifier_verdict path + deflection path) — they hit the same table but different row sets; serialising would double the round-trip latency for no benefit"
metrics:
  duration: "~7 min"
  tasks_completed: 3
  files_changed: 6
  commits: 6
  completed_date: "2026-05-07"
---

# Phase 4 Plan 07: Heartbeat + Archive Crons + Retention Library Summary

Wave 3 plan D — closes the Phase 4 observability stack. Three deliverables: a retention library (`src/lib/archive.ts`) for gzip-JSONL transcript archival to Supabase Storage with the upload-first-then-delete safety order (Pitfall 9); a 5-min business-hours heartbeat cron that pings 5 deps and (gated by `HEARTBEAT_LLM_PREWARM=true`) does an Anthropic prompt-cache pre-warm using `buildSystemPrompt()` (Pitfall 5 determinism contract) plus refreshes the `heartbeat:anthropic` Redis key so Plan 04-06's `dep-down` alarm doesn't false-fire; and a daily archive cron that finds up-to-100 sessions with messages older than 180 days, gzips full transcripts to private Storage, deletes the 180d-old rows, then hard-purges classifier-flagged + deflection-stop rows older than 90 days. 23 plan-scoped tests pass; full repo holds at 328/328. Operationally, Joe still needs to add 2 cron-job.org schedules + (optionally) configure BetterStack monitor (see Operational Notes).

## What Was Built

### Task 1 — src/lib/archive.ts (commits `aeede69`, `e6fe8d4`)

Five exports:

- **`buildJsonlGzip(rows)`** — `zlib.gzipSync(Buffer.from(rows.map(JSON.stringify).join('\n') + '\n'))`. Round-trips through `gunzipSync` to identical lines. Empty array yields a valid empty-content gzip stream.
- **`uploadArchive(path, buffer)`** — Wraps `supabaseAdmin.storage.from(env.SUPABASE_STORAGE_ARCHIVE_BUCKET).upload(path, buffer, { contentType: 'application/gzip', upsert: true })`. Returns `false` on error (logged via Pino as `event: 'archive_upload_failed'`); never throws.
- **`findArchiveCandidates(maxSessions=100)`** — Selects `session_id` from messages with `created_at < now() - 180d`, overshoots row limit to `maxSessions * 100`, dedupes in Node via `Set`, bails at `maxSessions` distinct values. Returns `[]` and logs `event: 'archive_find_candidates_failed'` on supabase error.
- **`archiveSession(session_id)`** — SELECT all messages for the session (regardless of age — full transcript context), build gzip-JSONL, upload to `archive/<yyyy>/<mm>/<session_id>.jsonl.gz`, then DELETE rows older than 180d. **Upload runs before DELETE; if upload fails, DELETE does NOT run** (Pitfall 9 — locked by `callOrder` test). Returns `{ rows_archived, uploaded }`. Re-running on an already-archived session yields `{ rows_archived: 0, uploaded: false }` because the SELECT comes back empty.
- **`deleteClassifierFlags90d()`** — `Promise.all` of two deletes (cutoff = now − 90d): one for `classifier_verdict NOT IN ('normal') AND classifier_verdict IS NOT NULL`, one for `stop_reason LIKE 'deflection:%'`. Sums counts; failure on one path doesn't kill the other (each logs `event: 'classifier_purge_failed'` with `kind: classifier_verdict | deflection`).

11 tests across 4 describe blocks: `buildJsonlGzip` (round-trip + empty), `findArchiveCandidates` (dedupe + cap + error path), `archiveSession` (upload-first ordering + upload-fail-skips-delete + already-archived returns 0 + storage path/content-type lock + delete-error-after-upload partial state), `deleteClassifierFlags90d` (sum counts + one-failed-still-counts-the-other).

### Task 2 — /api/cron/heartbeat (commits `afc7afd`, `fe81104`)

POST handler — pseudocode:

```ts
if (!validateCronAuth(req)) return 401;
const [supabase, upstash, exa, anthropic, classifier] = await Promise.all([
  timed(pingSupabase), timed(pingUpstash), timed(pingExa),
  timed(pingAnthropic), timed(pingClassifier),
]);
const llmPrewarmEnabled = (env.HEARTBEAT_LLM_PREWARM ?? 'true').toLowerCase() !== 'false';
const prewarm = llmPrewarmEnabled ? await warmPromptCache() : { cache_read_tokens: 0, cost_cents: 0, ok: true };
log({ event: 'heartbeat', deps_pinged, latencies_ms, statuses, anthropic_cache_read_tokens, cost_cents, prewarm_enabled, duration_ms });
log({ event: 'cron_run', cron_name: 'heartbeat', status: 'ok', items_processed: 1 });
return Response.json({ ok: true });
```

`warmPromptCache()` calls `getAnthropic().messages.create({ model: MODELS.MAIN, max_tokens: 1, system: [{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: 'ping' }] })`, then `redis.set('heartbeat:anthropic', Date.now(), { ex: 120 })`. Cost: `Math.round((cache_read / 1_000_000) * 30)` cents. On throw: logs `event: 'heartbeat_anthropic_failed'` at `'warn'` level, returns zeros, route still 200s.

`runtime = 'nodejs'`, `maxDuration = 60`. Lazy `getAnthropic()` keeps module import cheap for tests.

6 tests: 401 no-auth, 401 GET-with-token, 200 happy-path with cache-read tokens (verifies `buildSystemPrompt()` value flowed through to `system[].text`, `redis.set` called with `{ ex: 120 }`, log includes `cost_cents: 3` for 85k cache_read tokens), 200 with `HEARTBEAT_LLM_PREWARM=false` (Anthropic NOT called, `redisSet` NOT called, log shows `prewarm_enabled: false`), 200 on Anthropic throw (best-effort), all-5-pings-recorded with `degraded` status surfaced through to the heartbeat log's `statuses` field.

### Task 3 — /api/cron/archive (commits `a3569bc`, `7493fac`)

POST handler — pseudocode:

```ts
if (!validateCronAuth(req)) return 401;
try {
  const candidates = await findArchiveCandidates(100);
  let sessions_archived = 0, rows_archived = 0;
  const errors: string[] = [];
  for (const id of candidates) {
    try {
      const r = await archiveSession(id);
      if (r.uploaded) sessions_archived++;
      rows_archived += r.rows_archived;
    } catch (e) { errors.push(`${id}: ${e.message}`); }
  }
  const rows_deleted_classifier_90d = await deleteClassifierFlags90d();
  log({ event: 'archive_run', sessions_archived, rows_archived, rows_deleted_classifier_90d, errors, duration_ms });
  log({ event: 'cron_run', cron_name: 'archive', status: errors.length > 0 ? 'partial' : 'ok', items_processed: sessions_archived });
  return Response.json({ ok: true, sessions_archived, rows_archived, rows_deleted_classifier_90d, errors });
} catch (err) {
  log({ event: 'cron_run', status: 'error', ... }, 'error');
  return Response.json({ error: 'internal' }, { status: 500 });
}
```

Per-session errors collected in `errors[]`, cron continues. Classifier purge ALWAYS runs even on zero candidates (independent policy). Top-level throw (e.g. `findArchiveCandidates` blowing up) returns 500.

`runtime = 'nodejs'`, `maxDuration = 60`.

6 tests: 401 no-auth, 401 GET-with-token, happy-path (2 sessions archived, 19 rows total, 3 classifier-purged, errors=[], cron_run status='ok'), continues-past-per-session-errors (s1 + s3 archive, s_bad in errors[], status='partial'), 500 on `findArchiveCandidates` throw with error log, zero-candidates clean (no archiveSession calls, classifier purge still runs once).

## Test Results

| File | Tests | Status |
|---|---|---|
| `tests/lib/archive.test.ts` | 11 | PASS |
| `tests/cron/heartbeat.test.ts` | 6 | PASS |
| `tests/cron/archive.test.ts` | 6 | PASS |
| **Plan-scoped total** | **23** | **PASS** |
| Full repo suite | 328 | PASS (41 files) |

`npx tsc --noEmit` clean.

## Deviations from Plan

None — plan executed as written. The plan template's notes about possible mock-pattern inconsistencies all resolved on first compose:

- The plan flagged the `vi.spyOn(...env...)` pattern for the `HEARTBEAT_LLM_PREWARM=false` test as fiddly. Used the cleaner `vi.hoisted()` + `get env()` getter on the env mock instead — same pattern Plan 04-06's `cron-auth.test.ts` uses, no spying gymnastics.
- The plan flagged the `chain()` thenable mock as rough and suggested mirroring Plans 04-05/04-06 for consistency. Mirrored Plan 04-06 `alarms.test.ts` `chain(value)` pattern verbatim.
- Class-based vi.mock for `@anthropic-ai/sdk` default export — plan's template had `vi.fn().mockImplementation(...)`; switched to a class because `new Anthropic(...)` requires constructibility. Same fix Plan 04-05 needed for Resend.

## Manual Smoke (deferred to deploy preview)

Plan §verification specifies manual smokes that require a live deploy:

1. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/heartbeat` → 200, Vercel logs show `event: 'heartbeat'`. On a fresh deploy with no chat traffic, `anthropic_cache_read_tokens` may be 0 on first run (cold cache). Subsequent runs within Anthropic's 5-min ephemeral window should show ~85k cache_read.
2. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/archive` → 200, body `{ ok: true, sessions_archived: 0, rows_archived: 0, rows_deleted_classifier_90d: 0, errors: [] }` on a fresh deploy (no 180d data exists yet).

These are **deferred** until Joe runs them on a deploy preview before Phase 4 closes (or as part of LAUNCH-* in Phase 5).

## Operational Notes (Joe's post-deploy checklist for Plan 04-07)

### cron-job.org — 2 additional jobs

**Job: heartbeat**
- Title: `resume-agent: heartbeat`
- URL: `https://<production-domain>/api/cron/heartbeat`
- Method: POST
- Schedule (US business hours, Mon-Fri 9am-6pm ET): `*/5 14-22 * * 1-5` (UTC) — or use cron-job.org's timezone selector for `*/5 9-18 * * 1-5 America/New_York`
- Headers: `Authorization: Bearer <CRON_SECRET>` (paste exact value from `.env.local`)
- Save + Enable

**Job: archive**
- Title: `resume-agent: archive`
- URL: `https://<production-domain>/api/cron/archive`
- Method: POST
- Schedule: `0 8 * * *` (daily at 03:00 ET = 08:00 UTC; adjust for DST or use timezone selector)
- Headers: `Authorization: Bearer <CRON_SECRET>`
- Save + Enable

After saving each, click "Test run" once. Confirm in Vercel logs:
- `event: 'cron_run', cron_name: 'heartbeat', status: 'ok'`
- `event: 'cron_run', cron_name: 'archive', status: 'ok'` (or `'partial'` if any per-session errors — 0 expected on a fresh deploy)

### BetterStack synthetic monitor (OBSV-13)

Operational only — code-side surface (`/admin/health` link-out) shipped in Plan 04-04.

- Sign in at https://betterstack.com/uptime
- Create monitor: HTTP type, URL `https://<production-domain>/`, 3-minute interval, US-East + US-West + EU regions, expected 200, alert channel = `JOE_NOTIFICATION_EMAIL`
- Create status page → copy public URL into `BETTERSTACK_DASHBOARD_URL` env var (Vercel project settings) → redeploy → /admin/health "View BetterStack status page" link appears

### HEARTBEAT_LLM_PREWARM cost-tuning recommendation

Per CONTEXT D-C-10: Sonnet 4.6 cache_read is $0.30/MTok. With ~85k tokens cached and pinging every 5 min during 9-hour business window × 5 days = 540 pings/week → ~$15/business-week. **Recommendation: leave `HEARTBEAT_LLM_PREWARM=true` (default) during the active job-search window**; flip to `false` only if (a) recruiter traffic increases enough that organic chat keeps the cache warm without help, or (b) Joe's monthly Anthropic spend hits the $20 cap (SAFE-12) and the heartbeat is the largest non-chat line item. The escape hatch is one env var flip, no code change.

### Phase 4 Coverage Confirmation

After this plan ships:
- **OBSV-13** — BetterStack synthetic monitor: code surface live (Plan 04-04); operational config Joe-side
- **OBSV-14** — Heartbeat pre-warm: code live (this plan); cron-job.org schedule Joe-side
- **OBSV-15** — Retention (180d hot/cold + 90d classifier purge): code live (this plan); cron-job.org schedule Joe-side
- **All 3 cron-job.org jobs** required by Phase 4: `check-alarms` (Plan 04-06), `heartbeat` (this plan), `archive` (this plan)

## Self-Check

- src/lib/archive.ts — FOUND
- src/app/api/cron/heartbeat/route.ts — FOUND
- src/app/api/cron/archive/route.ts — FOUND
- tests/lib/archive.test.ts — FOUND
- tests/cron/heartbeat.test.ts — FOUND
- tests/cron/archive.test.ts — FOUND
- src/lib/archive.ts exports buildJsonlGzip, uploadArchive, findArchiveCandidates, archiveSession, deleteClassifierFlags90d — VERIFIED
- src/app/api/cron/heartbeat/route.ts contains literal `buildSystemPrompt()` (Pitfall 5) — VERIFIED
- src/app/api/cron/heartbeat/route.ts contains literal `'heartbeat:anthropic'` Redis key with `{ ex: 120 }` — VERIFIED
- src/app/api/cron/heartbeat/route.ts reads `env.HEARTBEAT_LLM_PREWARM` — VERIFIED
- src/lib/archive.ts archiveSession uploads BEFORE delete (test verifies via callOrder array) — VERIFIED
- Storage path matches `archive/<yyyy>/<mm>/<session_id>.jsonl.gz` (test asserts regex) — VERIFIED
- Storage upload uses `contentType: 'application/gzip'` and `upsert: true` (test asserts opts shape) — VERIFIED
- Both routes use `runtime = 'nodejs'` and `maxDuration = 60` — VERIFIED
- Both routes invoke `validateCronAuth(req)` at the top — VERIFIED
- Commit aeede69 (Task 1 RED) — FOUND in git log
- Commit e6fe8d4 (Task 1 GREEN) — FOUND in git log
- Commit afc7afd (Task 2 RED) — FOUND in git log
- Commit fe81104 (Task 2 GREEN) — FOUND in git log
- Commit a3569bc (Task 3 RED) — FOUND in git log
- Commit 7493fac (Task 3 GREEN) — FOUND in git log
- 23/23 plan-scoped tests passing
- 328/328 full-repo tests passing
- npx tsc --noEmit clean

## Self-Check: PASSED
