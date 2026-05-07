---
status: partial
phase: 04-admin-observability
source: [04-VERIFICATION.md]
started: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. GitHub OAuth happy path on deploy preview
expected: OAuth completes; AdminNav top-bar visible; sessions table renders (or empty-state)
result: [pending]

### 2. Non-allowlisted GitHub account
expected: Lands on NotAuthorized page (or signed out + redirected); /admin/* paths inaccessible
result: [pending]

### 3. First-message-of-session email
expected: Subject `[PRIORITY] new chat: <email>` for company-domain or `new chat: <email>` for free-mail; body shows first-message preview, classifier verdict, cost-so-far, View transcript button; arrives within ~5–10s
result: [pending]

### 4. Per-session email idempotency
expected: Sending a SECOND message in the same session sends NO additional email — atomic UPDATE-WHERE-IS-NULL on `first_email_sent_at` blocks the duplicate
result: [pending]

### 5. /api/cron/check-alarms auth gate
expected: `curl -X POST -H 'Authorization: Bearer $CRON_SECRET' /api/cron/check-alarms` → 200 `{ ok: true, results: [...4 conditions...], fired_count: 0 }` on healthy preview; same curl WITHOUT bearer → 401
result: [pending]

### 6. Force-trip spend-cap alarm
expected: `redis-cli SET <spend-key> 350` then POST /api/cron/check-alarms → plain-text alarm email arrives with subject `[ALARM] resume-agent: spend-cap`; row written to `public.alarms_fired`; second run within 1h does NOT duplicate (NX suppression); /admin/health "Recent alarms" widget shows the entry
result: [pending]

### 7. /api/cron/heartbeat live behavior
expected: 200 + Vercel logs show `event: 'heartbeat'` with `anthropic_cache_read_tokens > 0` (after at least one chat session has warmed the cache); both `heartbeat:anthropic` and `heartbeat:classifier` Redis keys refreshed
result: [pending]

### 8. /api/cron/archive smoke on fresh deploy
expected: 200 with `{ sessions_archived: 0, rows_archived: 0, rows_deleted_classifier_90d: 0, errors: [] }` (no transcripts >180d yet)
result: [pending]

### 9. cron-job.org schedules configured
expected: 3 jobs configured (check-alarms every 5m / heartbeat every 5m business hours / archive daily 03:00 ET) with `Authorization: Bearer $CRON_SECRET`; "Test run" from cron-job.org dashboard returns 200; Vercel logs show `event: 'cron_run'` with `cron_name` field per job
result: [pending]

### 10. BetterStack synthetic monitor + dashboard link
expected: BetterStack monitor created (3-min interval, multi-region) pinging production from outside Vercel; public status-page URL pasted into `BETTERSTACK_DASHBOARD_URL` env var; redeploy; /admin/health renders "View BetterStack status page" link
result: [pending]

### 11. Visual confirmation of always-expanded admin trace
expected: On /admin/sessions/[id] for a session with at least one tool call, all tool traces are forced-open with label `Tool trace` (not `See what I did`) and no chevron — admin can read full input + output JSON inline without clicking
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
