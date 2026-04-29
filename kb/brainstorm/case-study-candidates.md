# Case-Study Candidates (Brainstorm)

<!-- Working doc for the selection session (Plan 04 Task 5). -->
<!-- Joe + Claude produced 9 candidates here on 2026-04-24, -->
<!-- pruned to 5 using the coverage rubric. -->
<!-- This file is NOT concatenated into the system prompt at production time -->
<!-- (it's in kb/brainstorm/, not kb/ top-level or kb/case_studies/). -->

## Coverage Rubric (checked when pruning to 4-6)

- [x] At least one failure or killed project
- [x] At least one leadership-without-authority story
- [x] At least one data-rooted decision
- [x] At least one cross-functional conflict
- [x] At least one recent (<2y) story
- [x] At least one long-arc (>12mo) story

## Candidate: SAP-to-Snowflake EDW migration

- **Role / timeframe:** Under Armour, BI team lead → Enterprise Data & Analytics
- **One-line hook:** Moved the enterprise data warehouse out of SAP and into Snowflake — "the coolest transformation I've ever been a part of, rapid and big."
- **Why this one?:** Long-arc data platform migration; Joe's signature technical-leadership win
- **Rough outcome:** Successful migration; unlocked downstream wins (Tableau finance sandbox, faster query performance for sourcing/supply planning); cross-functional praise from Hong Kong / sourcing / supply / leadership
- **Confidentiality concerns:** None per kb/guardrails.md — UA named publicly; no NDA
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** long-arc, data-rooted, leadership
- **Status:** **SELECTED** for final 5

## Candidate: Tableau finance sandbox dashboard

- **Role / timeframe:** Under Armour, Enterprise Data & Analytics
- **One-line hook:** Built a live Tableau sandbox fed by Snowflake models — finance teams stopped cobbling season forecasts from spreadsheets across teams.
- **Why this one?:** Cross-functional impact across Hong Kong, sourcing, supply, leadership
- **Rough outcome:** Replaced manual Excel cobble; cross-functional praise across geographies and functions
- **Confidentiality concerns:** None
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** cross-functional, data-rooted
- **Status:** Cut — subsumed by EDW migration narrative; mention as a downstream win there

## Candidate: Black Friday flash-report turnaround

- **Role / timeframe:** Retail role (UA), second Black Friday owning intake
- **One-line hook:** Cut support tickets for flash-report issues by 75% by changing report frequency and source testing.
- **Why this one?:** Concrete, numeric outcome on a high-stakes business event
- **Rough outcome:** 75% support-ticket reduction year-over-year
- **Confidentiality concerns:** None
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** data-rooted
- **Status:** Cut — narrow scope; mention inside EDW migration story if relevant

## Candidate: UA project rescue

- **Role / timeframe:** Under Armour; Joe came in ~8 months after the original project failed
- **One-line hook:** A respected VP staffed her own initiative with personal relationships, none of them checked each other, the project collapsed; Joe came in eight months later, picked up the pieces, the team got the praise.
- **Why this one?:** Cleanest "failure" rubric story; rich politics + satisfaction-payoff arc
- **Rough outcome:** Rescued and shipped; team got the praise
- **Confidentiality concerns:** Per guardrails — no naming the original VP, framed as "what I learned about staffing" not as personal critique
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** failure, leadership, cross-functional rescue
- **Status:** **SELECTED** for final 5

## Candidate: Hiring an analyst on a flyer

- **Role / timeframe:** Under Armour
- **One-line hook:** Hired an analyst from a non-data team because he was constantly improving processes around him without being asked — tools can be taught, curiosity can't.
- **Why this one?:** Hiring philosophy in action; defending a non-obvious hire
- **Rough outcome:** Hire succeeded on Joe's team
- **Confidentiality concerns:** None
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** leadership, hiring philosophy
- **Status:** Cut — already canonized in kb/management_philosophy.md; agent already has this

## Candidate: Comp advocacy for underpaid analyst

- **Role / timeframe:** Under Armour
- **One-line hook:** Fought to make a long-tenured analyst the highest-paid on the team after newer hires doing less work were paid more — comp advocacy is a manager's job, not HR's process.
- **Why this one?:** Leadership-without-authority over comp/HR
- **Rough outcome:** Got the comp adjustment done
- **Confidentiality concerns:** Don't name the analyst
- **Freshness:** UA tenure (>2y old)
- **Rubric bucket(s) it could fill:** leadership-without-authority
- **Status:** Cut — already canonized in kb/management_philosophy.md; agent already has this

## Candidate: Cortex AI / semantic-layer client win

- **Role / timeframe:** Current role, recent client onsite
- **One-line hook:** A client onsite with formidable technical constraints; semantic layer + Cortex AI unlocked cash-flow forecasting they were excited about, deepening the relationship.
- **Why this one?:** Discrete recent win; answers "what are you doing right now?"
- **Rough outcome:** Client excited about cash-flow forecasting capability; relationship deepened
- **Confidentiality concerns:** Don't name the client (recruiter context doesn't need it)
- **Freshness:** Recent (<2y, possibly current quarter)
- **Rubric bucket(s) it could fill:** recent, data-rooted, cross-functional
- **Status:** **SELECTED** for final 5

## Candidate: Gap brand-hierarchy consolidation

- **Role / timeframe:** Gap, post-reorg; Joe owned VP of Data Engineering's standups + a Business Update with cross-functional stakeholders
- **One-line hook:** Through the Business Update, became aware that upstream apps were building per-brand data hierarchies; killed two pieces of that work and brought brand leaders together to align on a single standard hierarchy.
- **Why this one?:** Triple-rubric: killed project + leadership-without-authority (cross-brand persuasion) + cross-functional conflict resolution
- **Rough outcome:** Custom per-brand hierarchies killed; standard hierarchy adopted; saved maintenance + code-change cost
- **Confidentiality concerns:** None — Gap named publicly in FAQ; no specific people named
- **Freshness:** Gap tenure (>2y old)
- **Rubric bucket(s) it could fill:** killed-project, leadership-without-authority, cross-functional
- **Status:** **SELECTED** for final 5

## Candidate: Snowflake marketplace datashare app

- **Role / timeframe:** Current role, 12+ months in the making
- **One-line hook:** Built a private app on the Snowflake Marketplace that lets subscribed clients query their legal entities and view IRR metrics over a user-input timeperiod — biggest current-role win.
- **Why this one?:** Long-arc current-role build; concrete data product; navigated 3 iterations of AI governance with PMO
- **Rough outcome:** Live on Snowflake Marketplace; subscribed clients querying IRR metrics; AI governance approved through 3 iterations
- **Confidentiality concerns:** None per guardrails
- **Freshness:** Current; >12 months, ongoing
- **Rubric bucket(s) it could fill:** long-arc, recent, data-rooted, cross-functional
- **Status:** **SELECTED** for final 5

---

## Final 4-6 (selected 2026-04-24)

1. `snowflake-edw-migration`               — rubric: long-arc, data-rooted, leadership
2. `ua-project-rescue`                     — rubric: failure, leadership, cross-functional rescue
3. `cortex-ai-client-win`                  — rubric: recent, data-rooted, cross-functional
4. `gap-brand-hierarchy-consolidation`     — rubric: killed-project, leadership-without-authority, cross-functional
5. `snowflake-marketplace-datashare`       — rubric: long-arc, recent, data-rooted, cross-functional

Rubric coverage verified: ✅ failure ✅ leadership-w/o-authority ✅ data-rooted ✅ cross-functional ✅ recent ✅ long-arc

**Cut from candidate pool:**
- Tableau finance sandbox — subsumed by EDW migration narrative
- Black Friday flash-report — narrow scope; mention inside EDW migration if relevant
- Hiring an analyst on a flyer — already canonized in kb/management_philosophy.md
- Comp advocacy for underpaid analyst — already canonized in kb/management_philosophy.md

**Slug for #2 is generic (`ua-project-rescue`) and may be refined during the case-study interview in Task 6 once the project itself is named (per guardrails: don't name the original VP).**
