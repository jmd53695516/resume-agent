---
phase: quick-260520-t5j
plan: 01
type: execute
tags: [cron, split-cron, prompt-cache, heartbeat, cost-control, ops]
completed: "2026-05-21"
---

# Quick Task 260520-t5j: Split-Cron Implementation for Heartbeat

**One-liner:** Extracted warmPromptCache() into a shared lib, added dedicated prewarm-cache cron route, and rewired heartbeat to deps-only mode — resolving the banner-vs-cost tension from the 2026-05-20 heartbeat over-fire incident.

**Backreference:** .planning/incidents/2026-05-20-heartbeat-overfire.md Addendum (split-cron decision rationale)

---

## Operational Steps for Joe (post-deploy — execute in order)

These steps MUST be performed manually after the code is deployed to Vercel. Do NOT skip any step.

### Step 1: Set HEARTBEAT_LLM_PREWARM=false in Vercel Production

1. Go to Vercel dashboard > Project > Settings > Environment Variables
2. Find `HEARTBEAT_LLM_PREWARM` (it already exists)
3. Set its value to `false` (literal string)
4. Apply to Production environment only (preview/dev can keep default 'true')
5. Trigger a redeploy (either push a commit or use Vercel's "Redeploy" button)

Without this step: both heartbeat AND prewarm-cache will call Anthropic every fire, doubling cost.

### Step 2: Update existing heartbeat cron-job.org schedule to */1

1. Log in to cron-job.org
2. Find the existing heartbeat job: `POST https://joe-dollinger-chat.com/api/cron/heartbeat`
3. Change the schedule from current `*/5 9-17 * * 1-5` back to `*/1 9-17 * * 1-5`
   - Timezone: America/New_York (leave as-is)
   - This restores 1-minute cadence so the StatusBanner stays green (HEARTBEAT_OK_S=60)
4. Save and verify the next scheduled fire appears in ~1 minute

### Step 3: Create a NEW prewarm-cache cron-job.org entry

1. In cron-job.org, create a new job with these settings:
   - URL: `https://joe-dollinger-chat.com/api/cron/prewarm-cache`
   - Method: POST
   - Header: `Authorization: Bearer <your CRON_SECRET value>` (copy from Vercel env, same secret as heartbeat)
   - Schedule: `*/5 9-17 * * 1-5`
   - Timezone: America/New_York
2. Save and enable the job

### Step 4: Verify post-deploy

1. Wait 2 minutes after deploy + cron changes
2. Visit https://joe-dollinger-chat.com (or /admin/health)
3. Confirm the StatusBanner shows green ("Chat is online") during business hours
4. Check the heartbeat event log in Vercel logs: `event=heartbeat` should show `prewarm_enabled: false`
5. Check the prewarm log: `event=prewarm_cache` should appear every 5 minutes with `ok: true`

### Step 5: Verify cost (next business day)

1. Check the Anthropic dashboard (api.anthropic.com > Usage)
2. Confirm 24-hour spend is approximately $1.06 total:
   - Heartbeat (deps-only with HEARTBEAT_LLM_PREWARM=false): ~$0.06/biz-day (Haiku classifier calls)
   - prewarm-cache (Sonnet cache_read): ~$1.00/biz-day (~108 fires x ~30k tokens/fire x $0.30/MTok)
3. If spend exceeds $2/biz-day, check that HEARTBEAT_LLM_PREWARM is set to 'false' in Vercel Production

---

## Expected Steady-State Cost

| Route | Schedule | Role | Est. Cost/biz-day |
|-------|----------|------|-------------------|
| /api/cron/heartbeat | `*/1 9-17 * * 1-5` | Deps-only + classifier banner | ~$0.06 |
| /api/cron/prewarm-cache | `*/5 9-17 * * 1-5` | Sonnet cache_read warm | ~$1.00 |
| **Total** | | | **~$1.06** |

Previous state: ~$5.57/biz-day (1-min cadence with prewarm enabled)
After 2026-05-20 fix: ~$1.08/biz-day (5-min cadence with prewarm, but banner regressed)
After this split-cron: ~$1.06/biz-day (banner green + cost controlled)

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/prompt-cache.ts` | Shared warmPromptCache() helper (exported, consumed by both cron routes) |
| `src/app/api/cron/prewarm-cache/route.ts` | New dedicated cache-warmth cron route |
| `tests/cron/prewarm-cache.test.ts` | 5-case test suite for prewarm-cache route |

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/cron/heartbeat/route.ts` | Removed inline warmPromptCache/getAnthropic; added import from @/lib/prompt-cache; updated top comment for deps-only role + */1 schedule |
| `.planning/incidents/2026-05-20-heartbeat-overfire.md` | Flipped Addendum "Implementation status" to SHIPPED |
| `.planning/reports/MILESTONE_SUMMARY-v1.0.md` | Updated line 125 cron-job.org bullet to describe two-cron operational reality |

---

## Commits

| Hash | Task | Description |
|------|------|-------------|
| abedcec | Task 1 | Extract warmPromptCache into shared lib + rewire heartbeat |
| 3aa89b1 | Task 2 | Add POST /api/cron/prewarm-cache route |
| db74ea7 | Task 3 | Add prewarm-cache.test.ts (5 cases) |
| 9865b34 | Task 4 | Doc reconciliation — incident doc + MILESTONE_SUMMARY |

---

## Verification Gates

- `npx tsc --noEmit`: exits 0
- `npm run build`: exits 0, /api/cron/prewarm-cache listed as Dynamic route
- `npx vitest run tests/cron/heartbeat.test.ts`: 11/11 passed (no regression)
- `npx vitest run tests/cron/prewarm-cache.test.ts`: 5/5 passed

---

## Deviations from Plan

None — plan executed exactly as written. The transitive mock propagation path worked
on the first attempt: vi.mock('@anthropic-ai/sdk') class-mock in heartbeat.test.ts
applied globally and reached the lazy new Anthropic() inside the new
src/lib/prompt-cache.ts without any heartbeat.test.ts changes needed.

---

## Self-Check: PASSED

- [x] src/lib/prompt-cache.ts exists and exports warmPromptCache (FOUND)
- [x] src/app/api/cron/prewarm-cache/route.ts exists and exports POST + runtime='nodejs' + maxDuration=60 (FOUND)
- [x] tests/cron/prewarm-cache.test.ts exists with 5 passing tests (FOUND)
- [x] heartbeat/route.ts does NOT contain function warmPromptCache (removed — grep confirms PASS)
- [x] heartbeat/route.ts does NOT import from @anthropic-ai/sdk or @/lib/anthropic or @/lib/system-prompt directly (grep confirms PASS)
- [x] heartbeat/route.ts imports warmPromptCache from '@/lib/prompt-cache' (grep confirms PASS, line 43)
- [x] Incident doc Addendum 'NOT YET SHIPPED' replaced with 'SHIPPED in commit <hash>' (grep confirms PASS)
- [x] MILESTONE_SUMMARY line ~125 now describes both crons with cost numbers (grep confirms PASS)
- [x] Commits abedcec, 3aa89b1, db74ea7, 9865b34 all exist in git log (FOUND)
- [x] No emoji in any file (CLAUDE.md enforcement honored)
