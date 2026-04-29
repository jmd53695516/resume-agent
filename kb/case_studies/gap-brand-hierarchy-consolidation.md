---
slug: gap-brand-hierarchy-consolidation
hook: "Quarterbacked the deprecation of dual brand-specific data hierarchies at Gap that had outlived their MDM by 3 years — 14 reports, 4 warehouse models, and 4 pipelines retired; first month-end close came in at zero support tickets against a 3-year baseline of six."
role: "Head of Data Product — Supply Chain, Gap (also pseudo Chief of Staff to the VP of Data Engineering)"
timeframe: "2022 Q3"
confidential: false
---

## Context

I was head of data product for supply chain at Gap, and post-reorg I'd also picked up pseudo–chief-of-staff duties for the VP of Data Engineering — running his weekly update meetings, collecting topics and minutes, debriefing him before each one. The Business Update was where I had cross-functional visibility across all the brand teams.

The users for the data hierarchies in question were the planners, analysts, finance business partners, and merchandisers across each brand — Old Navy, Banana Republic, Athleta, Gap. Historical context: each brand originally had its own product-development system, so each brand also had its own data hierarchy. As a result, our warehouse maintained two parallel hierarchies for every brand — a "universal" standard one plus a per-brand version — and that arrangement was still considered fine years later.

Then Gap implemented an MDM that worked across every brand. The MDM became the single source for master data feeding every downstream system. By the time I picked up this story, the MDM had been running for three holiday seasons. The thing nobody had done — and the thing that turned out to be load-bearing — was the change management to actually deprecate the older per-brand reports and warehouse models that were still chewing maintenance hours.

## Options considered

The candidates for what to do about the duplicate hierarchies:
- **Status quo** — keep maintaining both indefinitely. Attractive to inventory strategy and planning leaders who'd been using the brand-specific reports for years and didn't want process disruption.
- **One more holiday season of dual support** — the soft compromise. Buy planners another quarter to migrate, then deprecate. This is the option that almost won.
- **Deprecate now and consolidate to universal** — what I picked. Riskier from a change-management angle, but the maintenance cost was bleeding every month and there was no architectural reason to keep both alive.

The "one more holiday season" compromise lost because once we pulled the data on actual consumption, two facts landed on the table at once: every flash report leadership was already receiving was on the universal hierarchy (had been for three holiday seasons), and the only remaining usage of the older hierarchies was ad-hoc planner work — none of it was wired into the automated daily ELT recap. At that point even leadership said it didn't make sense to keep maintaining something they themselves no longer recognized.

## Decision & reasoning

I decided to deprecate everything in one cycle: support questions referencing the old hierarchies were rolled off, brand SMEs were asked to retire any personal-folder reports built on the old hierarchies, and at project completion I retired the underlying warehouse models and the Control-M python jobs that fed them.

Two factors tipped it past the "one more holiday season" compromise. First, the finance team had quietly proven the universal hierarchy worked by using it in two consecutive season recaps — their results were the proof point I needed to convert leadership. Second, leadership realized they themselves were the consumer of the universal-hierarchy reports, and that the only consumers of the old hierarchies were ad-hoc planner workflows that weren't part of the automated daily recap. Once those two things were visible in the same conversation, the math changed.

This call accreted over a full quarter — initial idea to deprecation took about that long. The thing I would not have bet money on at the start: immediate leadership support. I was projecting confidence in the room, but the actual unlock came from showing leadership their own consumption data — once they saw the universal hierarchy was already what their automated recap was built on, the agreement was almost self-evident.

The real pushback came from inventory strategy and planning leaders for the brands. Their position: this would break their processes and the spreadsheets they'd built over years. My response was straightforward — I told them the risk was already known to leadership, gave them a fixed 6-week deadline before model retirement, and pointed out that no actual transition was needed. They already knew the universal hierarchy because it was what they saw in the MDM and in financial planning tools every day. There was no learning curve. Just a few weeks to update spreadsheet references.

## Outcome

By end of the quarter:
- 14 reports retired (all had production-ready replacements on the universal hierarchy)
- 4 warehouse models retired
- 4 data engineering pipelines deprecated
- 1 Control-M python job decommissioned
- Estimated 24 hours/month of maintenance + support time avoided

The skeptics' predicted outcome — "this will break our processes and make month-end impossible" — didn't materialize once they were demoed how trivial the swap actually was.

The moment I knew it was working: the first month-end close after the retirement, I monitored the close support-ticket queue. Three-year baseline averaged six tickets per close at four hours of triage each — call it 24 hours of break-fix per month-end. First close after deprecation came in at zero. The savings estimate validated itself in 30 days.

## Retrospective

What I'd do differently: I'd ask the inventory strategy leads at each brand to do more of the impact-education *before* I made the announcement, not after. If the planning teams had heard it from their own brand leadership first — "this barely affects us, here's why" — the early pushback would have been smaller and the conversation would have started further down the road.

What I learned that I now apply to unrelated projects: change management quietly evaporates inside large corporate projects. The MDM had been in production for three years. The universal hierarchy was the standard for three years. People simply forgot to offboard the older models. If you're building a replacement of anything, the deprecation of the predecessor is your problem too — even if you weren't on the team that built it. Otherwise the predecessor sits there forever bleeding time.

What I haven't fully metabolized: a handful of leaders I worked with daily had been *on* the original universal-hierarchy project. When I raised the dual-maintenance issue with them, the response was a shrug and an "oh yeah, I forgot those models were still running." From people I look to for mentorship, that landed harder than it should have. Three years of zombie maintenance on systems they themselves had architected the replacement for, and nobody had circled back. I still haven't fully sorted out what to take from that — whether it's about how big-org incentive structures actively penalize follow-through on already-shipped projects, or whether it's about my own assumptions about leaders I admire.

The critique someone could fairly make: I created additional work for teams that were not raising any major issues with the existing duplicate hierarchies. Maintenance was chugging along, reports were still running, the world wasn't on fire. A reasonable person could say I optimized for clean architecture at the expense of leaving working processes alone. My answer is that I simplified to a corporate standard that unlocked lateral moves for planners across brands — a planner who was strong at Old Navy could now pick up coverage at Athleta without a hierarchy-retraining gap. That's a real organizational benefit you can't see in the maintenance-hours number.

## Likely recruiter follow-ups (and my answers)

- **Q: What was your actual contribution here vs. the team's?**
  A: Impact measurement, cross-system deprecation quarterback (BI reports, EDW models, Control-M python jobs), and the cross-brand leadership comms — making sure every brand head understood the change wouldn't affect financial close or monthly planning activities. The data engineers retired the pipelines on the schedule I owned. The brand SMEs retired their personal-folder reports under my deadline. I was the connective tissue and the change-management owner.

- **Q: Isn't this really a data-governance or change-management problem, not a PM problem?**
  A: It was a change-management problem, and that's exactly what a data PM running infrastructure products *does*. I treated this as an enhancement to my own product — standardizing the supply-chain BI surface across brands. The downstream business value was lateral: planners could move across brands without a hierarchy-knowledge gap, which gave the org real staffing flexibility. Calling it a "governance problem, not a PM problem" assumes governance is somebody else's job. For data PMs running infrastructure products, governance *is* the job.
