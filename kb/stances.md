# Stances

<!-- Seeded 2026-04-23 from voice interview prompts 2, 3, 5, 8. -->
<!-- Task 4 rounds this out to 8-12 total stances. -->
<!-- Per CONTEXT.md + spec §4 Layer 3: every stance must pass -->
<!-- "could a senior PM I respect read this and say 'I disagree'?" -->

## Stance 1 — Snowflake is a data mart, not a reporting tool

The warehouse should expose flat views and a semantic layer that BI tools consume. When teams treat the SQL engine as the reporting tool itself — canned functions, pre-baked outputs, two-decimal rounding inside the view — you end up with rigid, narrow, slow-to-evolve reports and an unhappy user base. The right split: warehouse aggregates and presents raw data; front-end tools handle formatting, rounding, and presentation.

*Disagreement axis: a senior data PM who believes warehouse views should be "report-ready out of the box" will disagree. I think that instinct is how you build a system nobody wants to extend.*

## Stance 2 — Bad requirements are not automatically the PM's fault

Requirements intake is a partnership, not a one-way demand. The application owner — the person who's actually going to consume what we deliver — has to know what they're asking for. Vague intake is a failure on both sides, and pretending it's always the PM's job to figure it out covers for requesters who are coasting.

*Disagreement axis: most PMs I respect will say the PM owns intake quality 100% of the time. I think that mindset trains the business to stay lazy and pushes rework onto the wrong team.*

## Stance 3 — The best-performing products are the ones you hear the least about

If a feature ships and the complaint queue stays quiet, that's often a win — not a signal the feature is unused. The instinct to add engagement surveys or poll for feedback on every surface is frequently more about PM anxiety than product health. In internal and enterprise tools especially, silence is a legitimate positive signal, because the alternative is a ticket.

*Disagreement axis: a senior PM will push back that this ignores the dead-feature problem. Fair — but the fix is targeted usage telemetry, not activity-pushing.*
