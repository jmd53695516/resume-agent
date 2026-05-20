# Heartbeat Cron Over-Fire — 2026-05-20

Date detected: 2026-05-20. Date reconciled: 2026-05-20. Severity: financial-cost-only (no user-facing impact). Author: Joe + agent pair.

## Summary

The heartbeat cron-job.org schedule fired every minute during business hours (`* 13-22 * * 1-5` UTC, ~600 fires/biz-day) instead of every 5 minutes as intended. Because Anthropic's ephemeral prompt-cache TTL is ~5 min, 4-of-5 fires hit a still-warm cache and added zero coverage value — pure wasted `cache_read_input_tokens` spend at ~$5.57/biz-day. The mismatch was silent for at least 6 weekdays (from ~2026-05-12 onward per the spend-cap-incident memory note). No automated alarm fired because the $3/day spend cap is enforced only on `/api/chat`, not on the cron path. Reconciled 2026-05-20 by setting the cron-job.org dashboard schedule to `*/5 9-17 * * 1-5` with timezone `America/New_York`.

## What happened

- The code comment in `src/app/api/cron/heartbeat/route.ts` documented the intended schedule as `*/5` (every 5 min) during business hours.
- The operational reality in the cron-job.org dashboard was `* 13-22 * * 1-5` UTC — every minute, 9am-7pm ET Mon-Fri — approximately 600 fires per business day.
- Each fire executed `warmPromptCache()`, which calls Anthropic `messages.create` with `cache_control: ephemeral` against `buildSystemPrompt()`. Cache reads at Sonnet 4.6 rates are ~$0.30/MTok; the observed total was approximately $5.57/biz-day.
- Anthropic's ephemeral prompt-cache TTL is ~5 min. At a 1-minute cadence, 4 of every 5 fires hit a still-warm cache and provided no additional coverage — the warmed cache was already valid when the next fire arrived.

## Root cause

Schedule mismatch between two source-of-truth surfaces:

- **Intent** lived in the code comment (`*/5 14-22 * * 1-5` UTC approximation).
- **Reality** lived in a separate external system (cron-job.org dashboard) with no programmatic check that the two agreed.

No drift-detection mechanism exists between code comments and cron-job.org configuration. The two surfaces diverged silently at some point during setup and remained out of sync for an unknown duration before detection.

## Detection

Joe manually questioned Anthropic dashboard spend during a 3-day idle window (no `/api/chat` logins 2026-05-17 through 2026-05-20). Traced the unexplained spend to heartbeat fires by counting `event=heartbeat` log lines per business day. No automated alarm fired. The idle window was the only signal — without it, the over-fire could have continued indefinitely.

## Fix applied

- cron-job.org dashboard schedule changed to `*/5 9-17 * * 1-5` with timezone `America/New_York` (DST-safe via the dashboard's built-in timezone selector; no UTC math required).
- Expected new cost: approximately 108 fires/biz-day x ~1¢/fire = ~$1.08/biz-day. Approximately $20/biz-week saved vs. the over-fire baseline.
- Code comment in `src/app/api/cron/heartbeat/route.ts` reconciled to match the operational schedule (this plan, Task 1).
- MILESTONE_SUMMARY-v1.0.md Section 6 line 125 reconciled to reflect the 5-min cadence and reconciliation date (this plan, Task 1).

## Open systemic issue — spend cap scope gap (backlog)

The $3/day spend cap in CLAUDE.md is enforced **only** on the `/api/chat` path. The heartbeat cron path (`/api/cron/heartbeat`) does not consult the same daily-cap counter. At the over-fire cadence, the heartbeat alone consumed ~$5.57/biz-day — exceeding the documented daily cap before any user request — with no alarm firing.

Backlog items (do NOT address in this quick task; flagged for the next milestone planning pass):

- Wire `warmPromptCache()` cost into the same daily-cap counter used by `/api/chat`, or add a separate cron-budget counter with its own alarm threshold and email notification.
- Add a `cron_run` cost-rollup alarm so a misconfigured schedule triggers an email within one business day instead of silently spending for weeks.
- Consider an automated drift check — for example, a CI step that reads cron-job.org's API for the heartbeat job and asserts the schedule string matches a verified constant in the codebase.

## Lessons

- Source-of-truth split between code comments and external dashboards is a recurring failure mode. This is the second cron-job.org-related ops surprise after the spend-cap incident on 2026-05-12. Prefer programmatic schedule registration when feasible; when not feasible, codify the expected schedule as a verified constant with a CI assertion.
- The $3/day spend cap currently has a hole the size of the cron path. Treat the spend cap as scope-limited until the cron-path gap is closed.
- Idle-window spend is a useful diagnostic signal: any non-zero Anthropic spend during a no-login window means the cron path is the culprit. Check cron cadence first before investigating application bugs.
- The comment-as-documentation pattern creates a silent drift hazard when the thing being documented (a cron schedule) lives in a separate external system that can be edited independently. Treat externally-configured schedules as infrastructure that requires the same drift-check rigor as environment variables.

## References

- `src/app/api/cron/heartbeat/route.ts` — top-of-file comment now reflects the reconciled `*/5 9-17 * * 1-5` schedule and points back to this file.
- `.planning/reports/MILESTONE_SUMMARY-v1.0.md` Section 6 line 125 — tech-debt bullet now reflects the 5-min cadence and reconciliation date.
- Prior related incident: spend-cap-incident memory note 2026-05-12 (single-hour 272¢ spike from eval verification run + silent failure due to unscheduled alarm cron).
