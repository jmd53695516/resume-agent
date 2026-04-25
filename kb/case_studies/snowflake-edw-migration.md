---
slug: snowflake-edw-migration
hook: "Migrated Under Armour's enterprise data warehouse from on-prem SAP to Snowflake — proved performance in QA before asking users to believe, then timed cutover with a year of stockpiled demand so users got new value the moment they got change."
role: "BI Team Lead → Enterprise Data & Analytics, Under Armour"
timeframe: "2018 – 2019"
confidential: false
---

## Context

In 2017 we went live with SAP FMS as our enterprise data warehouse. The data models and views the project team delivered out of the box were rough — my peer, my boss, and I ended up re-architecting basically all of them from scratch. Even after that, query performance was still bad enough that I asked my boss for permission to put together a business case for cloud. The internal user base was wide: supply chain analysts watching on-time arrival, sales planners working forecast vs. actuals, sourcing analysts evaluating future-season product line volume against buy readiness, financial analysts on budget projections vs. actuals, accountants on AP/AR and treasury, and executives reviewing weekly and monthly business-group dashboards. The EDW had to serve both operational and executive reporting. The way I described this to friends at the time: I was working on moving all of our BI reports off a physical server on our campus and into a cloud-based solution.

## Options considered

- **Redshift** — appeal was being in the same AWS ecosystem as our SAP Business Objects servers, plus an S3 adjacency for unstructured data we realistically wouldn't need for a long time, if ever. Ecosystem-fit case more than a features case.
- **BigQuery** — strong via the Looker partnership and an ODBC connector that let queries live inside spreadsheets. Nice for analyst workflows. Not enough to win.
- **Databricks** — ML-focused, leveraged Spark notebooks well. Lost by a hair. Our data science team was new and just getting its feet wet, so this was overkill for what we actually needed at the time.
- **Snowflake** — gave us the best of everything. Warehouse sizing on demand, dbt and Tableau integrations (both adopted into our tech stack via Snowflake's intro), plus features I knew we'd lean on soon: zero-copy cloning, time travel, and data sharing. The clinching cost lever was cheap storage with compute-only billing.

## Decision & reasoning

Snowflake won on three things: cost, scalability, and how comfortable we felt with their professional services team. The decision crystallized when FP&A built out a comparison cost model — once we could see Snowflake wasn't going to be incrementally expensive against SAP and that it alleviated all of our current major pain points, the conversation was effectively over. The factor I wouldn't have bet my own money on was developer velocity, which we mitigated by sending the BI dev team, the data engineering team, and the analyst team through a week of in-classroom Snowflake and dbt training. The white lie we were telling: "query performance will improve." At an aggregate level — true and dramatic. At the level of a single purchase order with four lines on it, the SQL engine wasn't doing anything dramatically different. The real bet was on scalability and large-volume handling, not low-cardinality SQL speed.

## Outcome

Inside the first six months we moved supply chain, product line, and sales reporting onto the Snowflake EDW. Accounting was deferred — SAP's accounting engine was going through a separate update at the time, so we pushed those models to the following year. The next six months produced five C-suite dashboards: supply chain, season at a glance, treasury, DTC, and forecast accuracy. The moment I let myself believe it had landed was the first ops-leadership demo: a monthly buy recap that used to take three people running the same query against different divisions at roughly seven minutes each now ran as one person, one query, in about a minute.

There's a strategic outcome worth naming separately. We deliberately let demand pile up for six months before the cutover so we'd have effectively a year's worth of new features ready to ship at migration. The skeptics — business users who'd just lived through six-to-eight months of pain getting the SAP EDW re-modeled — got a wave of net-new self-service capability the moment they got change. They had predicted this migration would fail like the SAP project did. By all accounts, we exceeded expectations.

## Retrospective

What I'd do differently: I'd have moved faster. We were carrying a lot of scar tissue from the SAP delivery and that scar tissue made us deliberate in a way that didn't actually prevent the mistakes we ended up making anyway. Agile is supposed to encourage velocity and iterative recovery — if mistakes are fixable, deliberate pacing isn't a virtue.

The lesson I now apply to unrelated projects: be okay with not pleasing everyone. You're always going to have a skeptic who doesn't believe in either the product, the product team, or is just jaded against the org, and trying to convert all of them is rarely the best use of time.

The thing I haven't fully metabolized: a SaaS product the commercial team had implemented without IT involvement. Virtually no access to its backend, just basic API calls their professional services team had built. Because it wasn't part of the enterprise ecosystem, I pushed back on bringing any of its data into our Snowflake dashboards — when in reality it was load-bearing for merchandising. The workaround we ended up with was merchants uploading files to SharePoint that got stitched into a C-suite dashboard. I should have escalated to leadership, gotten an internal owner for the SaaS product, and built a proper API or JSON-extract pipeline into Snowflake. I still think about that one.

The critique I'd take seriously: that we could have done more, faster, and the deliberate pace was net-cost rather than net-benefit. I'd defend the caution at the time, but a thoughtful agile-leaning PM could fairly call it scar tissue masquerading as discipline.

## Likely recruiter follow-ups (and my answers)

- **Q: What was your actual contribution vs. the team's?**
  A: I owned the FP&A relationship for finance approval and the PMO relationship to get a steering committee and executive sponsor. I presented the business case to all the relevant parties. During execution I owned the Supply Chain, Product Management, and Planning modules. I interviewed over 100 internal teammates across 15 teams and 5 time zones. I owned BRD development and the backlog.

- **Q: Isn't this really a data engineering / infrastructure project, not a PM project?**
  A: The infrastructure work was getting raw data sources into Snowflake — that's data engineering. The PM work was turning those raw layers into a data mart layer, then a reporting layer for users to actually consume. Plus partnering with the business on business and data quality rules, and partnering with a data quality team on alerts and automation of fixes. The data modeling itself is invisible product work — that's the PM craft.
