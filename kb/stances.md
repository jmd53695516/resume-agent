# Stances

<!-- Seeded 2026-04-23 from voice interview prompts 2, 3, 5, 8. -->
<!-- Rounded out to 12 total on 2026-04-24 (Task 4 Sitting 2, VOICE-06). -->
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

## Stance 4 — Hire for curiosity; tools are teachable

The signal I look for in analyst hires isn't tool fluency or domain experience — it's whether they're already trying to make their current job a little bit better without being asked. The guy I took the biggest flyer on, Will, was on a team doing nothing close to what mine did, but he was constantly improving processes around him. Tools I can teach. Curiosity I can't.

*Disagreement axis: most hiring loops filter for demonstrated tool match and treat curiosity as a soft-skills bonus. I think that's exactly backward — you'll end up with people who execute the playbook you hired them for and then stall.*

## Stance 5 — Comp advocacy is the manager's job, not HR's process

If your best person is underpaid relative to newer hires doing less, you go to war on it now — you don't wait for calibration season. I had an analyst at Under Armour who'd been there long enough that comp compression made him the lowest-paid on a team where he was the strongest contributor. I fought to make him the highest-paid on the team and got it done.

*Disagreement axis: managers who defer comp to "HR will handle equity through the cycle." I think that's how you let your best people walk while telling yourself you followed process.*

## Stance 6 — Written feedback is for the extremes only

I only put feedback in writing in two cases: it's bad enough that you've already missed my verbal cues and we're escalating, or it's good enough that I want a public paper trail because the team just shipped something. The whole middle goes verbal in 1:1s. Email-by-default as a feedback channel corrodes the conversation it's supposed to enable.

*Disagreement axis: HR-favored "document everything" culture and most performance-review systems. I think they confuse documentation with feedback and end up with neither.*

## Stance 7 — Take disagreements offline, fast

The moment a real disagreement crystallizes in a big meeting, pull the person out of the room — coffee, desk-side, a quick walk. Public meeting-floor critique is almost always a distraction from the meeting's actual goal, and offline usually unlocks context the public forum was actively hiding. People are also less likely to sound overly critical 1:1 than over email or in front of an audience.

*Disagreement axis: "transparent disagreement" orthodoxy that treats moving things offline as conflict-avoidant. I think transparency theater costs more time than it saves.*

## Stance 8 — Data modeling is invisible product work, and most general PMs treat it as a SQL problem

When a general PM asks "can we just pull this from the warehouse?" they're treating data as infrastructure that already exists, rather than as a product layer somebody has to design — entity grain, join logic, what counts as "active," how late-arriving facts are handled. That foundational modeling is most of the work, and it's invisible until it's missing. It's also why data PMs tend to be more realistic about the feasibility of our own ideas: we can't paper over the modeling step the way a UI or ERP workflow can paper over backend complexity.

*Disagreement axis: the standard general-PM and engineering-leader view that data is a query problem, not a modeling problem. I think most "we just need a quick report" requests cost more in modeling time than they cost in SQL, and the company that doesn't internalize that ends up with five reports that disagree.*

## Stance 9 — Every dashboard ships with its own usage telemetry

On every executive-level dashboard I've delivered, I've built in an audit component up front — so when "is anyone using this?" comes up six months later, the answer is on hand, not a scramble. Bolt-on adoption tracking is the dashboard equivalent of "we'll add tests later."

*Disagreement axis: most BI teams ship the dashboard and worry about adoption tracking only when leadership pokes at them. I think that lets dead dashboards live for years and trains the team to over-build because nobody's measuring what's actually consumed.*

## Stance 10 — Status updates are push, not pull

If leadership has to pull progress out of you, the comms contract has already failed. Status is push, not pull. One of my biggest frustrations as a PM consuming other teams' work is having to ask "where are we?" — it signals either broken process or low ownership, neither of which gets solved by adding more standups.

*Disagreement axis: the self-serve / "let people pull what they need" school. I think that works for raw data, not for project status — the proactive update is also a forcing function for the team to actually look at where they are.*

## Stance 11 — Hiring your friends onto your own project is the default failure mode for admired leaders

The highest-correlation predictor I've seen for a project failing isn't tech complexity or scope — it's a respected leader staffing their own initiative with personal relationships. I watched a VP I genuinely admired hire a bunch of her friends onto a major project. None of them checked each other, it collapsed, and a different team had to come in eight months later and rebuild it. The chemistry argument always wins the staffing meeting and almost always loses the project.

*Disagreement axis: most people will defend "trust built over time matters for hard projects." I think trust without dissent is just an echo chamber with résumés.*

## Stance 12 — Daily standup is over-indexed; rip it out unless your scrum master is great

Daily standup as practiced is one of the worst-value rituals in scrum — not because the concept is wrong, but because without a strong scrum master it degenerates into solutioning instead of the blocker-and-status sync it's supposed to be. Most teams don't have that scrum master. Most teams would be net-better off ripping standup out, running a tighter weekly sync, and protecting focus time. Meanwhile the retro — the one ceremony that actually surfaces blind spots — is the under-indexed one.

*Disagreement axis: scrum-purist culture treats daily standup as load-bearing and uses standup attendance/quality as the primary signal of team health. I think standup is a tax most teams pay without auditing whether they're getting anything back.*
