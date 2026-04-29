---
slug: ua-project-rescue
hook: "Came in eight months after a SAP AFS→FMS go-live at Under Armour where 18 of 20 supply-chain reports never landed — rebuilt 5 data models from scratch, surfaced a smart-case SKU grain bug that had been under-counting fill rate by 20-30x, restored fill-rate-by-cancel-date by 18%, dropped a 75-minute purchase-order query to under 30 seconds, and ran 125+ hours of office hours so 200+ users across finance, planning, supply chain, customer service, sales, and logistics could actually adopt the rebuild."
role: "BI Manager — Enterprise Data & Analytics, Under Armour"
timeframe: "2018 Q1 – 2018 Q4"
confidential: false
---

## Context

I came onto the rescue eight months after a brutal SAP AFS-to-FMS go-live at Under Armour. The system migration also moved our enterprise warehouse to SAP HANA and our BI reporting from BW cubes to BusinessObjects — a stack change in three places at once. Roughly 200+ users across finance, planning, supply chain, customer service, sales, and logistics depended on the ~20 reports that were supposed to ship at go-live. As of 7/1/2017, two of them had passed QA and UAT, and even those two had significant performance issues. I got handed the rescue with an SME team scrambled together from global operations and global revenue. The honest version of what I told friends at the time: I'd been pulled in to do work that other people had already taken project bonuses and raises for less than 18 months earlier. It was an honor to help. The circumstance sucked.

The thing nobody had argued about at the start of the original project — and the thing that turned out to be load-bearing — was reporting staffing. The implementation team had a fat support layer for each functional module (OTC, P2P, RTR) to validate application functionality, but reporting was treated as a thin add-on. One BA per module, shared limited EDW dev capacity, and two of those BAs left mid-project and were never backfilled. Their work just got absorbed by whoever was still around. By go-live, the reporting work was structurally under-resourced by an order of magnitude relative to the user surface it was supposed to serve.

## Options considered

The candidates for how to bail this out:
- **Hot-fix what existed.** Patch the two reports that had limped through UAT, then patch the rest one at a time. Pushed by the project head. Almost won — until the smart-case discovery (more on that below) made it obvious every fix would break the next one.
- **Restart with the current dev pool.** The exec sponsor's pick. Lower-friction politically, but the people on the bench were the same people who'd just shipped the broken version, with the same patterns and the same lack of FMS-specific experience.
- **Emergency PMO business case for FMS-experienced developers.** Pushed by our head of BI. Higher-cost, harder ask, but the only option that addressed the staffing root cause. Eventually the call.
- **Do nothing — wait for the project team to prioritize reporting after hypercare.** What the project's BAs were quietly hoping for. Defensible in the abstract; in practice it meant 200+ supply-chain users running blind for another quarter while the C-suite waited on dashboards that didn't exist.

The hot-fix option almost won until I demoed the smart-case fill-rate impact at an Executive S&OP prep meeting — the dry run with the chief of staff and the head of supply chain. FMS had introduced "smart cases" — pre-determined size-run units — where one case SKU might contain 27 shirts (3 XS + 4 SM + 5 MD + 7 LG + 5 XL + 3 XXL). The original models treated the case as the unit of fulfillment, so an order shipping 30 shirts in a smart-case configuration was credited as a single unit shipped on time. The fill-rate metric was wrong by a factor of 20-30x. You can't hot-fix a unit-grain problem; the model itself is wrong. After the demo, the C-suite flipped to "just get it fixed asap" mode and the political air cover for Option 3 materialized inside a single meeting.

## Decision & reasoning

We went with Option 3 — the PMO business case for FMS-experienced developers. Two factors tipped it. First, data quality and consistency in the warehouse were already broken: each developer in the original project had been building their own dimensional models with their own naming, so the EDW had five different dim representations of the same underlying entities. Hot-fixing meant rationalizing five definitions of "vendor" or "ship date" before fixing anything else, on top of the smart-case grain bug. Second, the S&OP demo had landed leadership in fast-track mode — the air cover existed, and the window to ask for real headcount was right then, not after another month of internal debate.

The thing I would not have bet money on at the time: the original project team being completely apathetic to the rescue, and their inability to execute even basic handoff. There was no consolidated documentation. Some BRDs existed, some didn't; some lived on personal drives. Pulling requirements out of the original work product was largely a forensic exercise.

When Option 3 was made the call, the skeptics — primarily the project head and the BAs — pushed back with "you'll have the same issues we did." The honest answer was that they never thought holistically across the entire project; siloed module thinking (OTC, P2P, RTR) was the original failure mode, not the technology stack. What I didn't predict was that the BAs flipped from blocker to my single biggest resource. Once dev capacity actually existed, their QA-environment scenario-design capability was the thing that made UAT real and edge-case testing tractable. The loudest pre-decision skeptics often become the strongest executors after the call lands — if you give them work that uses what they're best at.

## Outcome

Over the rescue:
- **Five new supply-chain data models** built from scratch: Purchase Order Summary (designed to feed the executive scorecard), Purchase Order Detail, Inbound Logistics Detail, Forecast vs Actuals, Forecast History.
- **Fill rate by cancel date improved by 18%** — a truer unit-count fill rate after the smart-case grain fix.
- **A one-year purchase-order query went from 75+ minutes to under 30 seconds** — roughly 150x faster.
- **Tickets requesting "add this attribute to my report" dropped to zero** once the standardized dimensions were available across all five models. The variance that had been driving that ticket queue was the inconsistent dim work, not anything users were actually missing.
- **125+ hours of office hours** for users to come ask questions of the new design — the change-management work that made the rebuild actually adopted, not just delivered.

The skeptics had predicted "you'll have the same issues we did." They whiffed entirely. The original failure was surface-level data investigation paired with developer autonomy that nobody checked; the rescue was disciplined modeling paired with explicit handoff structures.

The moment I knew it was working: Purchase Order Summary went from ideation to production in less than six weeks, and the chief supply chain officer's vendor-metrics dashboard was dark for only two of his monthly reviews during the rebuild. I was measuring success not by the model-build milestones but by how few of his standing executive meetings had to run on yesterday's data.

## Retrospective

What I'd do differently: if I could rewind, I'd have asked to be on the original implementation project, not just the rescue. A lot of the bad calls were visible from the start to anyone with warehouse experience, and I'd have caught them before they were 18 months baked-in. Within the rescue itself, I'd have asked for more dev help earlier, and I'd have requested direct dev access to build mock models myself rather than writing a BRD and waiting for a developer to deliver something only to discover it didn't match what supply-chain users actually needed. The spec-and-wait cycle is where data PM work goes to die.

What I learned that I now apply to unrelated projects: a single source of truth for project documentation is a force multiplier — not because anyone reads the docs in steady state, but because mid-project onboarding (which is where most rescues actually start) is structurally impossible without it. The original project had documentation scattered across personal drives, BRD versions, and people's heads. Half the rescue was forensic recovery before any new building could start.

What I haven't fully metabolized: the leadership accountability puzzle. The project's leadership had pushed two prior 90-day delays, then chose to go live with the recommendation that the launch would have "no material impact on operations" — with two of twenty reports through UAT and both of those running on broken performance. The post-mortem on that decision never landed organizationally; the people closest to the call survived it intact, and the rescue team got the praise for the cleanup. I still don't fully know what to take from that. Whether it's about how big-org incentive structures actively discourage telling the C-suite "we need a third delay," or whether it's about my own assumptions about the level of accountability that exists at the top of a project. I've worked through both readings. Neither sits cleanly.

The critique someone could fairly make: I skipped traditional SME-driven requirements gathering. I built the new models off the old BW cube baselines as a starting point, layered in the FMS enhancements the project team had already specified, applied my own knowledge of how supply-chain users at UA actually used the data, and presented the result to users for UAT. I didn't ask permission. A reasonable critic could say I executed on assumptions that should have been validated upstream, and the fact that it worked doesn't justify the process. My answer is that the rescue's binding constraint was time, not requirements precision — every week without working reports was 200+ users running blind on a system the company had already bet a quarter on. UAT-as-validation was a deliberate trade, not a corner cut. But the critique is real, and I'd take it seriously in any context where the time pressure was less acute.

## Likely recruiter follow-ups (and my answers)

- **Q: What was your actual contribution here vs. the team's?**
  A: I owned the BRDs the new dev pool built against, ran unit testing on what they delivered, designed the UAT test cases (with the BAs whose QA scenario work I described above), and ran the leadership comms on data-availability expectations across the rescue. The cross-functional change-management work was probably the highest-leverage piece — I hosted over 125 hours of office hours so users across finance, planning, supply chain, customer service, sales, and logistics could come ask questions of the new design and figure out where things lived in the new models. The dev team built the queries; the BAs broke them in QA before they reached users; I owned the contract between them and the people consuming the output.

- **Q: Isn't this really a data engineering / SAP integration / change management problem, not a product management problem?**
  A: It's all of the above, and the PM component is what drove the whole rescue. Owning a suite of data models and their standard BI reports means owning the roadmap, the prioritization, and the trade-offs between immediate data needs and longer-term consistency. The dev team rebuilt the models, but the call about which model to rebuild first — and which downstream report had to be ready for which monthly executive review — was a roadmap decision under tight time constraint. That's the PM job. Calling it "really an X problem" assumes the roadmap and prioritization happen for free, which is the assumption that landed the original project at 2 of 20 reports through UAT in the first place.
