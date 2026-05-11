---
slug: snowflake-marketplace-datashare
hook: "Inherited a Snowflake data-share product for PE clients and made it the alternative to quarterly Excel attachments — 18 months in, 5 accounting systems and 7 clients live."
role: "Senior Consultant, Nimbl Digital — PM on SEI Data Cloud"
timeframe: "2024 Q4 – present"
confidential: false
---

## Context

I inherited this project about 18 months ago as Lead Product Owner on a data cloud product for our private-equity client base. The firm runs accounting for PE clients across real estate, LBOs, VCs, fund-of-funds, and distressed assets, on a stack of disjointed applications that each handle a different flavor of accounting. The point of the data cloud product is to upsell those clients on their own data — replace the quarterly Excel attachment from our ops group with a self-serve query against secured views and table functions in Snowflake. The consumers are fund managers and their analyst teams who need investor-reporting numbers every quarter. On the product side it's me plus three business analysts; data engineering builds the pipelines.

The architecture call — private app on Snowflake Marketplace, secure data sharing, RBAC plus row-level security — was made by the VP of Product before I joined. I inherited that and own everything downstream: what we model, how we sequence integrations, what we expose, how we test it.

The thing the team thought would be simpler and absolutely was not: pulling data out of the portfolio accounting system. Its backend speaks a custom query language called RSL, and we underestimated the time it takes to write a standard extract per data point. It's been the load-bearing constraint on the roadmap ever since.

## Options considered

For the second system integration after the obvious first one, the candidates were:
- **CRM** — relationship managers wanted this because it would have lit up their largest clients first.
- **A real-estate REIT tracking system** — narrow but high-value for the RE subset of clients.
- **A SaaS investment system** — same RM logic, follow-the-largest-account pattern.
- **Portfolio accounting (the RSL system)** — the option I picked: hard extraction, but one integration that unlocks the most clients and feeds the most downstream reporting.

The relationship managers' position was internally consistent — go where the biggest revenue is. The lost-by-a-hair was probably the SaaS investment system; it would have been easier to extract from and would have kept an RM happy. I made a different call.

## Decision & reasoning

I went with portfolio accounting next. Two factors tipped it.

First, the amount of operations-side workload it eliminates. Portfolio accounting feeds the most ops reporting, so standardizing extraction here removes the most manual Excel work downstream.

Second, reusability. The same pipeline feeds other internal reporting platforms — our investor portal as well as the client portal — so the integration cost amortizes across more than just the marketplace data share.

The call crystallized fast. About a month after I joined I had a system catalogue, I'd reviewed it with each application owner, and the timeline proposal basically wrote itself. Less than four weeks of accretion, then it was on the page.

The bet I wouldn't have wagered my own money on at the time was the RSL extraction itself — could we actually get a custom-language pipeline to stay maintainable AND have the calculated results match what the source application produced? That was the real risk under the timeline confidence.

The biggest skeptic was the application owner of the RSL system. Her dev team had constraints that didn't fit my timeline, and she said so plainly. Rather than override her, I offered to help with resourcing so her team could come up to speed on what we were asking for. Once that resourcing was on the table, she was asked to revisit her feasibility position; her team got augmented and the asks were accommodated.

## Outcome

Eighteen months in:
- 5 accounting systems plus 1 CRM connected
- 50+ standardized views in production
- 20 custom Snowflake table functions in production
- 5 clients live in production, 2 more in UAT/pilot
- Now expanding scope to build the internal operations group's analytics warehouse off the same foundation
- Next on the roadmap: Snowflake Streams (change-tracking) so clients get visibility into when their data updates instead of polling for changes

The skeptic's predicted outcome — "this won't fit our timelines" — didn't materialize once the resource constraint was solved.

The moment I knew it was working: clients started querying the secured views and table functions and then asking for *enhancements* — quality-of-life requests, mostly small. That's the signal I trust most for an internal data product. Silence is fine, complaints are bad, but feature requests for QoL polish on something clients are actively using is the cleanest "this matters to them" signal you get.

## Retrospective

What I'd do differently: I'd force the requesting teams to be more concrete on what they actually wanted before we built anything. Fuzzy intake has caused rework on the dev side more than once because the person asking for a number in an internal report didn't actually know what they were asking for. Sounds silly but it's true.

What I now apply to unrelated projects: don't let stakeholders dictate the *path* to the solution. Ingest the requirement, then own the path. If you let the requester architect the solve, you end up building their idea of a workaround instead of the right thing.

What I haven't fully metabolized: documentation drift and the rework it produces. I know some of our docs are out of date relative to what's actually live in the code, and we have naming-convention inconsistencies — the same field showing up under two different names across reports. None of it breaks functionality, but it's the kind of thing that'll trip a future engineer on the team, and I haven't put real effort into closing the gap yet.

The critique someone could fairly make: *what did this actually solve, and at what cost?* The data already existed in on-prem databases that were perfectly queryable. A reasonable PM could look at the build cost and ask whether we needed a Snowflake data-share product to do what an internal SQL query already did. My answer is the workflow elimination — client emails RM, RM forwards to ops, ops analyst opens an app, runs a report, exports to Excel, manipulates, emails it back — collapses to a single client query. That's a real answer, but it's not a slam dunk.

## Likely recruiter follow-ups (and my answers)

- **Q: What was your actual contribution here vs. the team's?**
  A: I designed the data mart, owned the integration roadmap, built the test cases for the standard views, wrote the data-quality rules for systems that aren't CDC-enabled, and designed the historical-snapshot workflow so we can do point-in-time reporting. The data engineers built the pipelines off requirements I gave them — target systems, server details, CDC expectations. The application owners brought their systems' extraction expertise. I'm the connective tissue and the modeling brain.

- **Q: Isn't this really a data-engineering problem, not a PM problem?**
  A: Engineering is a real component, but not the part I run. I tell the data engineers which systems and what CDC behavior we need. They execute. My job starts once the data hits Snowflake — what are we *doing* with it? Raw data isn't usable by a fund manager; you have to model it into views that answer the questions clients actually have. The status quo was: client emails RM, RM forwards to ops, ops opens an app, runs a report, exports to Excel, cleans it, emails the spreadsheet back. The data share collapses all of that to a query. That's product work, not pipeline work.
