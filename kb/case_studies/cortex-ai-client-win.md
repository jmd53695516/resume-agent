---
slug: cortex-ai-client-win
hook: "Surfaced a Cortex AI time-series forecasting use case mid-onsite, navigated AI governance, and shipped to production in 4 months — taking the client's cash-flow forecasting from Excel to a live model that earned the analyst's smile in the demo."
role: "Senior Product Manager — fund-services data platform"
timeframe: "2025 Q4 – 2026 Q1"
confidential: true
---

## Context

This was a new client coming onto our datashare. The whole reason for the onsite was to walk through our roadmap and strategy for the cloud product — what their potential use cases could be, where our planned deliverables overlapped, and where we saw value in them consuming the data. It was a 40-person room: roughly 20 from the client side (GM, CAO, CDO, CIO, some fund managers, their data engineering team) and 20 from ours (Tech Infrastructure, Product, Relationship Managers, Operations Managers, Application Owners). The eventual users of whatever we'd land on were the client's fund managers and their trading and analyst teams. Going into it, the way I described it to a friend was: "I'm hosting a new client this week to discuss the roadmap and strategy of our cloud product — figuring out which of their potential use cases line up with what we already have planned and where we see value in them consuming the data from it." One assumption I'd flag in hindsight: we walked in with a particular data-ingestion strategy in mind that turned out not to be the one they preferred.

## Options considered

This wasn't a vendor evaluation — it was a real-time discovery in the middle of a roadmap meeting. Their current state was Excel-driven cash-flow forecasting. The options that surfaced internally:

- **Status quo on their side, more raw data on ours.** They keep doing what they're doing; we push more raw data through the datashare for them to model themselves.
- **Custom-model dev.** Our data engineering team builds a custom forecasting model.
- **Cortex AI + time-series forecasting (out of the box).** Our RM asked about Snowflake's AI capabilities mid-conversation. I suggested Cortex; he asked what was available out of the box; I pointed at time-series forecasting because I'd seen a Snowflake how-to on it. He liked it and ran with the pitch.

There wasn't a real runner-up — the room agreed to a POC and we moved on.

## Decision & reasoning

The substantive PM call was post-meeting: build a POC and validate it internally with our operations team before going back to the client with anything. Two factors tipped that:

1. The dev team had never built on Cortex — there was a learning curve we wanted to derisk.
2. We didn't want to seem foolish or sloppy to the client by demoing something half-working.

The honest gap I should name: I wouldn't have bet my own money on where this would land. Cortex was tech we'd never been asked to deliver on, and we didn't entirely know how to create and provide value with it. The gap between what we said was possible and what we'd actually built before was infinitely large. We were also helped by something we had no right to expect — after I sent an email update to the RM letting them know we'd kicked off, the client's data engineering leader proactively sent over a list of potential pitfalls and things to watch out for. Test cases we didn't have to develop ourselves.

## Outcome

Timeline: about 6 weeks from the onsite to AI Governance Council approval, then 4 weeks of dev, 1 week of QA, 1 week of UAT with our operations group, then handoff to the client's UAT environment. We gave them 2 days of free play before the official demo. After the demo, they wanted it in production — went out in the following month's release. Ideation to production: about 4 months total.

The risks the AI Governance Council flagged were the right ones — cross-contamination of underlying data (the warehouse is multi-tenant, so we had to prove the model wouldn't see other clients' funds) and internet exposure. The internet-exposure one was easy: cyber's containment posture plus higher-tier VPN access in the upper environments. Cross-contamination was harder. All our views are secured views with a `client_id` predicate baked into the WHERE clause at deployment, scoped to the client's schema. We trained the ML model on top of that secured view, so it could only see data the `client_id` filter returned. None of the flagged risks materialized.

The moment I let myself believe it had landed: during the live demo we showed how varying the input and the confidence interval changed the prediction markedly. One of the client's analysts had a huge smile on his face. I still remember that smile.

## Retrospective

What I'd do differently: pre-meet with internal teams that had already navigated AI Governance Council approval before engaging the council ourselves. There was a lot of documentation we had to fill out and a lot of considerations I'd never thought through, and a chunk of the back-and-forth could have been avoided if we'd absorbed institutional knowledge upstream of the gate.

The lesson I now apply to unrelated projects: our application owners don't always understand the art of the possible when it comes to data. Whatever they're asking for is often a fraction of what we could actually deliver if the problem were modeled differently — and pointing that out is part of the PM job, not noise.

The thing I haven't fully metabolized: the v1 we shipped didn't include any way to take snapshots of generated forecasts. I would have liked to include that in the first product. Without it, the client can vary inputs and see live predictions, but they can't say "what did we forecast last month and how close did we get?" — which is the kind of question fund managers ultimately care about. Same instinct that made me value time-travel as a Snowflake feature on previous projects, and I missed it on the one where I most needed it.

The critique I'd take seriously: we got handed test cases by the client's data engineering team unprompted, after just a single email update from me to the RM. A thoughtful critic would point out that most of the time clients don't gift you that, and a meaningful chunk of the de-risking work the case study glosses over actually landed in our laps because of the relationship — not because of anything our team did.

## Likely recruiter follow-ups (and my answers)

- **Q: What was your actual contribution vs. the team's? The RM made the pitch, the dev team built it, Snowflake CS trained your devs.**
  A: My hands-on was documenting the needs and expectations of the time-series model, owning the requirements of all the data inputs, owning acceptance testing and root-causing any bugs we found, owning all of the AI governance documentation, and the demo of the finished product. The vision to have this as a possibility was based on knowledge of features available to us and how we could apply them to solve a business need — connecting that need to a roadmap is the PM job.

- **Q: Isn't this really a data science problem, not a PM problem? The model is what delivered value.**
  A: It would be a data science problem if this were a model we were developing internally. This was a built-in feature we were unlocking with a POC that had an applicable use case. Understanding the problems of the client and how to solution it out is my role as a PM — connecting needs and a roadmap to solve those needs.
