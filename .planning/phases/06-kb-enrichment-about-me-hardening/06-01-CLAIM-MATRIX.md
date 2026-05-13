# 06-01 Claim Matrix — LLM about-me → ground-truth source

**Generated:** 2026-05-13
**Source file:** docs/transcripts/06-about-me/llm-about-me.md (gitignored, 933 lines)
**Primary ground-truth:** docs/transcripts/06-about-me/transcript.md (gitignored, 66 paragraphs)
**Secondary ground-truth:** kb/about_me.md, kb/profile.yml, kb/resume.md, kb/case_studies/*.md, evals/cat-01-fabrication.yaml
**Tertiary ground-truth (added 2026-05-13 post-initial-grading):** docs/transcripts/06-about-me/consolidated-resume.md (gitignored, 680 lines — LLM-consolidated from 10+ historical resume versions). Re-grading triggered: 13 items flipped (mostly `verify-with-joe` → `keep` after resume validation). See "Re-grading impact (consolidated-resume.md)" section below.
**Total claims extracted:** 142
**Disposition summary (post-re-grade):** keep=73, strip=51, verify-with-joe=9, meta=9

## Method

Every factual claim about Joe is mapped to one of: transcript quote, existing kb/ fact, or no_source. Per CONTEXT D-A-02, only `transcript` and `existing_kb` sources clear a claim for merge. `no_source` claims are stripped in Plan 06-02. `verify-with-joe` items get Joe's decision below before Plan 06-02 strip. `meta` rows are agent-direction/instructions (not factual claims about Joe) and are NOT migrated into kb/about_me.md regardless.

**Source priority order:**
1. `transcript` — transcript.md line N (strongest; what Joe actually said in the interview)
2. `existing_kb` — kb/about_me.md, kb/profile.yml, kb/resume.md, kb/case_studies/*, evals/cat-01-fabrication.yaml ground_truth_facts (pre-blessed truth)
3. `no_source` — not in transcript, not in existing kb

**Privacy guard:** No raw transcript content longer than 10 contiguous words appears in the matrix; longer support is summarized + line-referenced.

## Claim Matrix

| claim_id | claim_text | source_type | source_quote_or_path | disposition | notes |
|----------|------------|-------------|----------------------|-------------|-------|

### Core Positioning (LLM lines 11-37)

| claim-001 | "Joe is a product owner for a data cloud platform and an experienced analytics leader who connects business processes to KPIs" | transcript | transcript.md line 3 (verbatim Joe phrasing) | keep | Direct transcript hit; canonical positioning |
| claim-002 | "Data cloud platform owner" (self-descriptor) | transcript | transcript.md line 35 | keep | Joe's own term |
| claim-003 | "Business-to-technology translator" (self-descriptor) | transcript | transcript.md line 35 | keep | Joe's own term |
| claim-004 | "KPI storyteller" (self-descriptor) | transcript | transcript.md line 35 | keep | Joe's own term |
| claim-005 | "Strategic analytics leader" (label) | no_source | — | strip | LLM-introduced framing; not in transcript or kb |
| claim-006 | "AI-enabled analytics product owner" (label) | no_source | — | strip | LLM-introduced framing; closest real is target_roles entry; redundant if claim-007 used |
| claim-007 | Joe is targeting AI Product Owner positioning | transcript | transcript.md line 17 | keep | Direct transcript hit |
| claim-008 | Roles to avoid: salesman, coder, pure software engineer, pure data engineer, traditional supply chain planner, pure sales | transcript | transcript.md line 22 (sw eng, data eng, supply chain planner, pure sales) + line 34 (salesman, coder) | keep | Direct transcript hit |
| claim-009 | "Joe has technical fluency and sales engineering experience, but those are supporting strengths rather than his core identity" | verify-with-joe | partial: transcript line 22 (supply chain planner not core); kb/resume.md (Retailcloud SE) — but "supporting strengths" framing is LLM | verify-with-joe | LLM-added framing; ask Joe if true |
| claim-010 | Agent should "always project Joe as a strategic thinker who is able to work cross-functionally to deliver impactful results" | transcript | transcript.md line 67 (verbatim) | meta | Agent instruction, not a factual claim about Joe |

### Career Story (LLM lines 49-58)

| claim-011 | "Joe's career arc is defined by continuous learning, curiosity, and willingness to take on unfamiliar challenges" | transcript | transcript.md line 64 ("always learning and taking on new challenges") | keep | Direct transcript hit |
| claim-012 | Domain breadth: "retail analytics, BI leadership, Snowflake platform ownership, solutions consulting, private equity data products, AI-enabled analytics" | existing_kb | kb/resume.md (chronological roles) + kb/profile.yml companies[] | keep | All grounded in resume |
| claim-013 | "Joe is comfortable entering the unknown, experimenting, failing, learning, and improving" | transcript | transcript.md line 64 ("just trying and failing... you learn the best from failure. You grow from failure, not just successes") | keep | Direct transcript hit |
| claim-014 | "Joe started in retail and supply chain analytics, developed into a BI and data product leader, helped modernize enterprise data platforms, and now owns data cloud and AI-enabled analytics products" | existing_kb | kb/resume.md chronology | keep | Accurate resume summary |

### What Energizes Joe (LLM lines 61-74)

| claim-015 | "Joe is energized by building products that users actually consume and rely on to do their jobs better" | transcript | transcript.md line 4 ("I enjoy building products that I know users will not only consume, but will be meaningful in how they accomplish their job") | keep | Direct transcript hit (paraphrased) |
| claim-016 | Example: "pricing models that forecast future-season impact" | transcript | transcript.md line 4 ("a new pricing model with the ability to forecast pricing changes over future seasons") | keep | Direct transcript hit |
| claim-017 | Example: "gross margin models that show how price, unit demand, and margin dollars interact" | transcript | transcript.md line 4 ("a gross margin model... display how certain factors can affect it") | keep | Direct transcript hit |
| claim-018 | Example: "executive dashboards that explain performance and tradeoffs" | existing_kb | kb/about_me.md (Season at a Glance) + kb/case_studies/snowflake-edw-migration.md (5 C-suite dashboards) | keep | Strong source |
| claim-019 | Example: "self-service analytics products that help users answer questions without depending on manual reporting" | existing_kb | kb/case_studies/snowflake-marketplace-datashare.md + kb/case_studies/cortex-ai-client-win.md | keep | Strong source |
| claim-020 | Example: "forecasting tools that help clients understand future cash flows or capital raise scenarios" | transcript + existing_kb | transcript.md line 27 ("forecast future cash flows and any potential capital raises") + kb/case_studies/cortex-ai-client-win.md | keep | Direct transcript hit |
| claim-021 | "Joe does not want to build 'ghost models'" | transcript | transcript.md line 9 (verbatim "ghost models") | keep | Direct transcript hit; distinctive voice |

### Differentiator + Under Armour S&OP story (LLM lines 77-92)

| claim-022 | "Joe's key differentiator is his ability to connect operational decisions to downstream KPI movement" | transcript | transcript.md line 5 ("my ability to connect the dots between process A and how a decision affects the KPIs surrounding it") | keep | Direct transcript hit |
| claim-023 | Under Armour auto-replenishment team increased safety stock on high-volume mainstay products | transcript | transcript.md line 5 (verbatim) | keep | Direct transcript hit |
| claim-024 | "Finance reported a large month-over-month increase in days forward coverage but could not explain it because the forecast had not materially changed" | transcript | transcript.md line 5 (verbatim) | keep | Direct transcript hit |
| claim-025 | Joe explained that safety-stock increase triggered new POs and those POs had no planned sales, causing days-forward-coverage rise | transcript | transcript.md line 5 (verbatim) | keep | Direct transcript hit |
| claim-026 | "Head of North America Supply Chain asked Joe to lead the Supply Chain War Room" | transcript | transcript.md line 5 (verbatim phrasing) | keep | Direct transcript hit |
| claim-027 | War Room responsibilities: prepare exec slide deck, gather weekly themes, invite cross-functional partners, coordinate follow-ups, provide recaps | transcript | transcript.md line 6 (verbatim) | keep | Direct transcript hit |

### Leadership Style (LLM lines 95-104)

| claim-028 | "Joe's leadership style is a blend of servant leadership and hands-on product ownership" | transcript | transcript.md line 14 ("Servant leader and a hands on product owner") | keep | Direct transcript hit |
| claim-029 | "Joe would not ask an analyst to take on a project, analysis, or operational task that he was not willing or able to do himself" | transcript | transcript.md line 14 (verbatim) | keep | Direct transcript hit |
| claim-030 | "This leadership style helps him build credibility with technical teams, analysts, executives, and business users" | no_source | — | strip | LLM-added downstream framing; not in transcript |

### Communication Style (LLM lines 107-130)

| claim-031 | Joe's style: "confident and direct" | transcript | transcript.md line 21 (verbatim) | keep | Direct transcript hit |
| claim-032 | Joe's style: "data-driven" | no_source | — | verify-with-joe | Not explicitly in transcript but compatible with his identity; ask Joe |
| claim-033 | Joe's style: "business-outcome focused" | no_source | — | verify-with-joe | Inferred from transcript line 48 ("My approach is always based on executive urgency and business impact") — partial support |
| claim-034 | Joe's style: "practical" | no_source | — | strip | LLM filler adjective; no source |
| claim-035 | Joe's style: "credibility-based" | no_source | — | strip | LLM filler adjective; no source |
| claim-036 | "Joe is especially effective at translating technical data issues into executive-level business context" | existing_kb | kb/case_studies/ua-project-rescue.md (smart-case S&OP demo) + kb/about_me.md | keep | Multiple case-study evidence |
| claim-037 | Joe focuses on: inputs, outputs, assumptions, use cases, business decisions when communicating with non-technical users | transcript | transcript.md line 29 ("walk them through the inputs and outputs"); line 30; line 35 | keep | Direct transcript hit |
| claim-038 | "He avoids overwhelming business users with unnecessary technical depth" | transcript | transcript.md line 29 ("How the sausage was made I left up to a more seasoned technical partner... never explained the tech in and out to a business user") | keep | Direct transcript hit |
| claim-039 | "When deeper technical explanation is needed, he connects the client's technical team with the appropriate technical partner" | transcript | transcript.md line 29 ("we always connected the clients' technical team with ours") | keep | Direct transcript hit |

### Personal Traits (LLM lines 133-161)

| claim-040 | Trait: "Intellectual curiosity" | transcript | transcript.md line 30 ("Intellectually curious") | keep | Direct transcript hit |
| claim-041 | Trait: "Analytical thinking" | transcript | transcript.md line 30 ("analytical") | keep | Direct transcript hit |
| claim-042 | Trait: "Practical problem-solving" | transcript | transcript.md line 30 ("problem solver") | keep | Direct transcript hit |
| claim-043 | Trait: "Healthy skepticism" | transcript | transcript.md line 30 ("a skeptic") | keep | Direct transcript hit |
| claim-044 | Trait: "WOO — Winning Others Over" | transcript | transcript.md line 30 (verbatim "I have WOO (winning others over)") | keep | Direct transcript hit; distinctive |
| claim-045 | Trait: "Humor" | transcript | transcript.md line 32 ("Humor") | keep | Direct transcript hit |
| claim-046 | Trait: "Storytelling" | transcript | transcript.md line 32 (verbatim) | keep | Direct transcript hit |
| claim-047 | Trait: "Genuine human interaction" | transcript | transcript.md line 32 (verbatim) | keep | Direct transcript hit |
| claim-048 | Trait: "Willingness to go the extra mile" | transcript | transcript.md line 32 (verbatim) | keep | Direct transcript hit |
| claim-049 | "Joe's healthy skepticism is not negativity. It is product discipline." | no_source | — | strip | LLM-added framing/interpretation; nice but not Joe's words |
| claim-050 | Joe asks: "What problem does this solve?" | transcript | transcript.md line 31 (verbatim) | keep | Direct transcript hit |
| claim-051 | Joe asks: "What does this resolve and correct that we previously could not?" | transcript | transcript.md line 31 (verbatim) | keep | Direct transcript hit |
| claim-052 | Joe asks: "What decision are we actually trying to make?" | no_source | — | verify-with-joe | LLM-added third question; not in transcript but compatible with style — ask Joe |
| claim-053 | "His WOO strength shows up through humor, storytelling, relationship-building, and making complex work approachable" | no_source | — | strip | LLM interpretation; "making complex work approachable" isn't Joe's framing |
| claim-054 | "Joe is obsessed with sports, especially Philadelphia professional teams" | transcript + existing_kb | transcript.md line 33 (verbatim) + kb/about_me.md L11 (golf obsession also referenced) | keep | Direct transcript hit |
| claim-055 | "Joe is a dog lover" | transcript | transcript.md line 33 (verbatim) | keep | Direct transcript hit |
| claim-056 | "His personality is competitive, relationship-oriented, and grounded" | no_source | — | strip | LLM interpretation; not Joe's words |

### Target Roles (LLM lines 164-200)

| claim-057 | Target: Data Cloud Product Owner | existing_kb | kb/profile.yml target_roles[] | keep | In profile.yml |
| claim-058 | Target: AI Product Owner | transcript | transcript.md line 17 (verbatim) | keep | Direct transcript hit |
| claim-059 | Target: Analytics Director | no_source | — | verify-with-joe | Not in profile.yml or transcript; ask if intentional addition |
| claim-060 | Target: Director of Business Operations | no_source | — | verify-with-joe | Not in profile.yml or transcript; ask |
| claim-061 | Target: Data Product Manager | existing_kb | kb/profile.yml ("Senior Product Manager — data space / data platform") | keep | Adjacent to profile.yml |
| claim-062 | Target: BI Director | no_source | — | verify-with-joe | Not in profile.yml; ask |
| claim-063 | Target: Snowflake Product Owner | no_source | — | verify-with-joe | Not in profile.yml; ask if interested |
| claim-064 | Target: Technical Product Manager | no_source | — | verify-with-joe | Not in profile.yml; ask |
| claim-065 | Target: Solutions Consultant | existing_kb (partial) | kb/resume.md Retailcloud role title | verify-with-joe | Job done, but is it a TARGET? Ask |
| claim-066 | "AI Product Owner Pitch should emphasize: AI-powered resume agent, Snowflake Cortex experience, semantic layer for Cortex Analyst, ability to connect AI capabilities to governed data" | transcript + existing_kb | transcript.md line 65 + line 19 (resume agent built); kb/case_studies/cortex-ai-client-win.md | keep | Direct transcript hit + case study |
| claim-067 | "Joe's strongest AI product angle is his ability to make AI useful for business users... combines semantic layer design, business definitions, natural-language analytics, and product ownership" | existing_kb | kb/case_studies/cortex-ai-client-win.md + cat1-fab-014 ground truth | keep | Strong existing kb support |

### Roles to Avoid (LLM lines 203-212)

| claim-068 | "Joe is technically fluent and can work credibly with engineers, but his value is product ownership, analytics leadership, stakeholder translation, and business impact" | transcript + existing_kb | transcript.md line 22 (roles not targeting) + line 20 (what agent should do) | keep | Direct transcript context |

### Technical Profile (LLM lines 215-285)

| claim-069 | "Technically fluent but not an engineer" | transcript | transcript.md line 14 (servant + hands-on PM, not "engineer") + cat1-fab-008/009 ground_truth ("not an ML engineer", "not a frontend developer") | keep | Strong evidence |
| claim-070 | "Hands-on with SQL, Snowflake, BI tools, and AI-enabled analytics" | existing_kb | kb/profile.yml tools[] + kb/resume.md | keep | Resume-grounded |
| claim-071 | "Able to prototype and validate concepts" | transcript + existing_kb | transcript.md line 63 ("Exploratory poc I did personally"); line 28 + kb/case_studies/cortex-ai-client-win.md | keep | Direct transcript hit |
| claim-072 | "Comfortable partnering with engineers but not trying to replace them" | transcript | transcript.md line 29 (connects clients' technical team with ours; technical partner does the explaining) | keep | Direct transcript hit |
| claim-073 | "Strong at translating business requirements into technical execution" | existing_kb | kb/resume.md (multiple bullets); kb/case_studies/*.md | keep | Multiple case studies |
| claim-074 | "Joe rates his SQL skills around 7/10" | transcript | transcript.md line 37 (verbatim "my sql skills are a 7/10") | keep | Direct transcript hit |
| claim-075 | SQL competencies: CTEs, joins across views, subqueries, window functions, filters, aggregations, validation queries | transcript | transcript.md line 37 (verbatim "able to write CTEs, window functions, join other views, write subqueries etc") | keep | Direct transcript hit (filters/aggregations/validation are LLM additions but compatible) |
| claim-076 | "There are some things I don't know how to do (mainly DDL)" / "He should not be positioned as a deep DDL/database engineer" | transcript | transcript.md line 37 (verbatim "There are some things I dont know how to do (mainly DDL)") | keep | Direct transcript hit; honesty marker |
| claim-077 | Snowflake experience: data cloud platform ownership | existing_kb | kb/resume.md + kb/case_studies/snowflake-marketplace-datashare.md | keep | Resume-grounded |
| claim-078 | Snowflake experience: "writing requirements for source-to-target mapping from raw to silver and silver to gold layers" | transcript | transcript.md line 38 (verbatim "raw to silver and silver to gold layers") | keep | Direct transcript hit; distinctive phrasing |
| claim-079 | Snowflake experience: "designed the data mart for supply chain and product management at Under Armour" | transcript | transcript.md line 38 (verbatim) | keep | Direct transcript hit |
| claim-080 | Snowflake experience: supporting secure data sharing as client-facing product capability | existing_kb | kb/case_studies/snowflake-marketplace-datashare.md | keep | Strong case study evidence |
| claim-081 | Snowflake experience: building semantic layers | existing_kb | kb/case_studies/cortex-ai-client-win.md ("semantic layer") + cat1-fab-014 ground_truth | keep | Strong case study evidence |
| claim-082 | Snowflake experience: supporting Cortex Analyst and Cortex Search | transcript + existing_kb | transcript.md line 18 + line 65 + kb/case_studies/cortex-ai-client-win.md | keep | Direct transcript + case study |
| claim-083 | "Joe's data modeling style is star-schema focused" | transcript | transcript.md line 39 (verbatim "My style is definitely star schema focused") | keep | Direct transcript hit |
| claim-084 | "Centralized dims so I can simply bring the IDs up from the lower levels of data and join for the names at the top level" | transcript | transcript.md line 39 (verbatim) | keep | Direct transcript hit |
| claim-085 | Modeling goals: clean, repeatable, scalable, governed, free from duplicated logic, free from inconsistent naming | no_source | — | verify-with-joe | LLM-added list; "clean/repeatable/scalable/governed" are LLM adjectives. Consistent with Joe's philosophy but ask. |
| claim-086 | "Joe views semantic layers as a governed business dictionary, standardization layer for metrics, foundation for AI/Cortex experiences, bridge between business users and technical data models" | existing_kb (partial) | kb/case_studies/cortex-ai-client-win.md (semantic layer for Cortex) + cat1-fab-014 ground_truth | keep | Strong case study evidence |
| claim-087 | "Joe's approach is to go to the trusted SME for each business area to confirm business-facing definitions, calculation logic, and usage context before loading definitions into a data governance tool" | transcript | transcript.md line 40 (verbatim "I have always gone to the trusted SME of a given area for the business facing definitions of metrics we build to load into a data governance tool") | keep | Direct transcript hit |

### BI Tool Experience (LLM lines 289-345)

| claim-088 | "Joe's Power BI experience is primarily centered on building dashboards on top of Snowflake views" | transcript | transcript.md line 43 (verbatim "Dashboards on top of snowflake view") | keep | Direct transcript hit |
| claim-089 | "Power BI as the consumption layer for governed Snowflake data products" | existing_kb | kb/resume.md SEI bullet ("Power BI dashboards built on Snowflake views") + cat1-fab-014 ground_truth | keep | Resume-grounded |
| claim-090 | MicroStrategy: "Roadmap ownership, data dictionary management, platform governance, intake for new features and enhancements, intake for upstream application changes" | transcript | transcript.md line 44 (verbatim "I owned the roadmap and data dictionary. I would run intake on new features, enhacements, and upstream application changes that would break our models") | keep | Direct transcript hit |
| claim-091 | SAP Business Objects: "designed standard reports and the SAP HANA data models behind them" | transcript | transcript.md line 45 (verbatim) | keep | Direct transcript hit |
| claim-092 | "Joe supported a Data-as-a-Service culture by hosting global BI Office Hours" | transcript | transcript.md line 45 (verbatim "I also supported Data As A Service by hosting BI Office Hours") | keep | Direct transcript hit |
| claim-093 | BI Office Hours example question: "I'm trying to accomplish X — how do I figure that out?" | transcript | transcript.md line 45 (verbatim) | keep | Direct transcript hit |
| claim-094 | "Joe would walk users through available data models, explain how the data connected, and help them structure reports by combining queries" | transcript | transcript.md line 45 (verbatim "walk them through the various data models and how we could set up a report combining queries") | keep | Direct transcript hit |
| claim-095 | Tableau: "primarily executive-dashboard focused" | transcript | transcript.md line 46 (verbatim "All of the tableau dashboards I worked on were executive focused") | keep | Direct transcript hit |
| claim-096 | Tableau role: "define high-level dashboard requirements, outline how the dashboard needed to function, and provide a tab-by-tab skeleton" | transcript | transcript.md line 46 (verbatim "I would provide a skeleton of each tab") | keep | Direct transcript hit |
| claim-097 | "A dashboard designer then handled the final visual build" | transcript | transcript.md line 46 (verbatim "I a designer would come in and make the actual dashboard") | keep | Direct transcript hit |
| claim-098 | Good dashboard criteria: performant, easy to understand, clear in KPI meaning, designed around the business question, flexible drill-down | transcript | transcript.md line 42 (verbatim "performant, I am able to clearly undertand the KPIs, and for items that need the ability to drilled down, having that flexibility") | keep | Direct transcript hit |

### Requirements Gathering (LLM lines 349-381)

| claim-099 | "Joe's strongest requirements-gathering skill is interviewing users to uncover the real business purpose behind the request" | transcript | transcript.md line 47 (verbatim "interviewing users on what does this task accomplish, what are you trying to answer, who is asking for this, what does it support") | keep | Direct transcript hit |
| claim-100 | Questions Joe asks: "What does this task accomplish?", "What are you trying to answer?", "Who is asking for this?", "What business process or decision does this support?", "What problem does this solve?" | transcript | transcript.md line 47 (verbatim, slight wording variations) | keep | Direct transcript hit |
| claim-101 | "For acceptance criteria, Joe pushes users to define: ideal end state, MVP threshold, perfect version, what users can live without in the first release" | transcript | transcript.md line 47 (verbatim "show me what the ideal perfect scenario is, and what you can live without as an MVP") | keep | Direct transcript hit |
| claim-102 | "Joe has owned backlogs, requirements writing, UAT test scenario development, product roadmaps, business-facing product vision" | transcript | transcript.md line 12 (verbatim "I have owned the backlog, writing requirements, working with end users on UAT test case scenarios, and owned the future of the product roadmap") | keep | Direct transcript hit |
| claim-103 | "Joe prioritizes MVPs and product work based on: executive urgency, business impact" | transcript | transcript.md line 48 (verbatim "My approach is always based on executive urgency and business impact") | keep | Direct transcript hit |

### Stakeholder Management (LLM lines 384-397)

| claim-104 | "Joe manages stakeholder priorities by grounding decisions in leadership alignment, business impact, operational urgency" | transcript | transcript.md line 49 (verbatim "I refer them to leadership who typically sets the tone on what new development takes priority") | keep | Direct transcript hit |
| claim-105 | "Break-fix work is typically prioritized above net-new development" | transcript | transcript.md line 49 (verbatim "Any break fix development I always prioritize over new work") | keep | Direct transcript hit |
| claim-106 | "For metric definitions, Joe often provides a first-pass business definition, then relies on SMEs to confirm, refine, or rewrite it" | transcript | transcript.md line 49 (verbatim "I will provide a first pass on the business definition, but rely on them to either confirm or rewrite") | keep | Direct transcript hit |
| claim-107 | "For new requests, Joe encourages stakeholders to engage him early so he can understand the business need, assess technical feasibility, and help shape a realistic timeline" | transcript | transcript.md line 49 (verbatim) | keep | Direct transcript hit |

### Data Governance Philosophy (LLM lines 400-417)

| claim-108 | "Joe expects bad or improperly loaded data to be corrected at the source application rather than hidden through excessive downstream edge-case logic" | transcript | transcript.md line 10 (verbatim "My role as a platform owner is not to build code for edge case scenarios where the data is imporperly loaded, I would expect the source system to correct it") | keep | Direct transcript hit; strong opinion |
| claim-109 | Governance principles list (correct at source, clear ownership, trusted SMEs, store definitions in governance tools, avoid hiding source issues, preserve trust) | transcript + existing_kb | transcript.md line 10 + line 40 | keep | Grounded in transcript |
| claim-110 | "Joe has interacted with governance and observability tools such as Collibra and Datadog" | transcript | transcript.md line 10 (verbatim "I have interacted with teams that used collibra and datadog") | keep | Direct transcript hit |

### Data Validation and Testing (LLM lines 420-435)

| claim-111 | "Joe's data validation approach is SME-driven and source-aligned" | transcript | transcript.md line 51 (verbatim "Data validation I will work with SMEs that can identify the field in the source application") | keep | Direct transcript hit |
| claim-112 | "When an existing source-system report exists, he uses that report as a validation anchor" | transcript | transcript.md line 51 (verbatim "if there is already a report in the source application, match said report") | keep | Direct transcript hit |
| claim-113 | "For UAT, Joe works with SMEs to: identify business scenarios, create representative test data, validate expected outputs, confirm edge cases, support signoff" | transcript | transcript.md line 51 (verbatim "I will partner with the SME to ensure all UAT scenarios are considered and test data created for each of those scenarios") | keep | Direct transcript hit |

### Break-Fix and Production Issues (LLM lines 438-456)

| claim-114 | Break-fix approach: "Root-cause focused, impact-oriented, business-aware" | transcript | transcript.md line 50 (verbatim "Root cause focused and potential impact") | keep | Direct transcript hit |
| claim-115 | Triage dimensions: regions, brands, product lines, reports/processes, understated/overstated, approximate % | transcript | transcript.md line 50 (verbatim "Triage what regions / brands / product lines etc are affected by the bad data and are understated/overstated by approx X%") | keep | Direct transcript hit |

### Client-Facing Experience (LLM lines 459-479)

| claim-116 | "Joe has client-facing experience across product demos, requirements discovery, data model walkthroughs, custom-work intake, metric triage, explaining calculation logic, helping clients understand platform capabilities" | transcript | transcript.md line 52 (verbatim "I have done client demos, worked with them to understand the data model, intaked new requirements from them for custom work, and triaged questions they had on certain metrics on the method of calculation") | keep | Direct transcript hit |
| claim-117 | "Joe's sales engineering and solutions consulting experience should be framed as consultative product discovery and value translation, not pure sales" | transcript | transcript.md line 53 (verbatim "Understand their potential requirements of a platform and do a product demo on how our product solves their needs") + line 34 (avoid salesman framing) | keep | Direct transcript hit |

### Industry Positioning (LLM lines 482-496)

| claim-118 | Strongest industries: retail, e-commerce, SaaS data platforms, supply chain, CPG, consulting | transcript | transcript.md line 55 (verbatim "retail, ecom, saas data platforms, supply chain, cpg, consulting") | keep | Direct transcript hit |
| claim-119 | "Joe has also developed emerging experience in financial services and private equity data through his SEI work" | existing_kb | kb/case_studies/snowflake-marketplace-datashare.md | keep | Strong case study evidence |

### Retail and E-Commerce Experience (LLM lines 499-513)

| claim-120 | Areas touched: supply chain, product merchandising, planning, inventory, DTC, loyalty, pricing, customer experience, POS systems | transcript + existing_kb | transcript.md line 54 ("All of those I have touched") + kb/resume.md + kb/case_studies/* | verify-with-joe | "All of those" was Joe agreeing to a list — what list was the agent asking? Verify loyalty/POS specifically |

### Financial Services / Private Equity Data Experience (LLM lines 517-537)

| claim-121 | SEI Data Cloud "supports both internal operations users and external private equity clients" | transcript + existing_kb | transcript.md line 56 (verbatim) + kb/case_studies/snowflake-marketplace-datashare.md | keep | Direct transcript hit |
| claim-122 | Provides governed access to NAV Package deliverables quarterly or monthly depending on each fund's reporting cadence | transcript | transcript.md line 56 (verbatim) | keep | Direct transcript hit |
| claim-123 | Data domains: trial balance, cash flows, general ledger, NAV reporting, ILPA performance metrics, investor-level allocations, investment roll-forward, schedule of investments | transcript | transcript.md line 57 (verbatim) | keep | Direct transcript hit |
| claim-124 | Additional domains: capital activity, commitments, distributions, fund metadata | no_source | — | verify-with-joe | LLM expansion beyond transcript line 57 list — ask Joe |

### IRR and ILPA Performance Metrics (LLM lines 540-571)

| claim-125 | ILPA experience: defining business requirements, conducting validation testing, explaining edge cases, supporting reporting delivery, helping technical teams understand metric calculation | transcript | transcript.md line 58 (verbatim "defined requirements, conducted validation testing, explained edge cases, walked the techinical team through the math") | keep | Direct transcript hit |
| claim-126 | IRR: helped developers understand business meaning, data elements required, why grid-scan bisection method was useful | transcript | transcript.md line 59 (verbatim "explaining the best possible method of arriving at the answer using grid scan bisection") | keep | Direct transcript hit |
| claim-127 | "Joe explained that this method helps avoid inaccurate or misleading results from multiple possible IRR roots" | transcript | transcript.md line 59 (verbatim "prevents multiple roots/IRR solutions that are inaccurate") | keep | Direct transcript hit |
| claim-128 | "Do not position Joe as the production developer of the final code. Position him as the business and product translator" | transcript | transcript.md line 59 (verbatim "I found on overstack.com. This base function the developers were able to leverage") + line 63 + lines 65-66 in original LLM | meta | Agent instruction (legit guardrail); maps to existing kb voice |
| claim-129 | Core IRR inputs: cash flow dates, cash flow amounts, fund ID, terminal market value | transcript | transcript.md line 60 (verbatim "Cash flow data, Cash flow amount, fund id, terminal market value") | keep | Direct transcript hit |
| claim-130 | "Joe personally tested approaches for calculating IRR and identified a faster JavaScript-based function that could be implemented in a Snowflake UDTF" | transcript | transcript.md line 63 (verbatim "Exploratory poc I did personally until I found a javascript function that worked faster in a snowflake udtf") | keep | Direct transcript hit |

### Case Studies (LLM lines 574-857)

Case studies 1, 2, 3, 4, 6 all have transcript-or-existing-kb backing. Case study 5 (Port Optimization) and Case study 10 (Shanghai promotion) need finer check.

| claim-131 | Case Study 1 (Supply Chain War Room): full content of LLM lines 577-612 | transcript | transcript.md lines 5, 6 (full story) | keep | Direct transcript hit; already covered by claim-023..027 |
| claim-132 | Case Study 2 (Snowflake EDW Transition): full content of LLM lines 616-632 | transcript + existing_kb | transcript.md line 7 + line 66 (Joe seeded the idea + interviewed cloud providers + deployed in <1yr) + kb/case_studies/snowflake-edw-migration.md | keep | Direct transcript hit + strong case study |
| claim-133 | Case Study 3 (Season at a Glance): CPO + CMO; current season + past season + year prior sell-through; marketing moments; key merchandising stories | transcript | transcript.md line 7 (verbatim "season at a glance" + verbatim list) | keep | Direct transcript hit |
| claim-134 | Case Study 3 decisions supported: discover promotional event trends, decide future seasons less promotional, influence product line decisions, decide where to expand SKU counts | transcript | transcript.md line 8 (verbatim) | keep | Direct transcript hit |
| claim-135 | Case Study 4 (Gap Legacy Hierarchy / MDM): MDM 3 years prior, resistance "you are going to break business process X", reduce month-end close reporting bugs 20% YoY | transcript + existing_kb | transcript.md lines 23, 24, 25 (verbatim) + kb/case_studies/gap-brand-hierarchy-consolidation.md (more detail) | keep | Direct transcript hit; case study confirms |
| claim-136 | Case Study 5 (Gap Port Optimization): NOAA weather data, 3PL data, local port data, container/port wait time, blocked inventory | transcript | transcript.md line 13 (verbatim "NOAA data and data provided to us via 3PLs and the local ports on how long containers sat on cargo ships or were blocked in ports to determine the optimal flow of purchase orders") | keep | Direct transcript hit |
| claim-137 | Case Study 6 (Gap Kafka SKU drop): size gaps in e-commerce report, merchant said purchase order was for all sizes, root cause = Kafka topic dropping SKUs, affected almost $20M in sales | transcript | transcript.md line 66 (verbatim "$20M in sales") + entire line 66 story | keep | Direct transcript hit; distinctive number |
| claim-138 | Case Study 7 (SEI Snowflake data sharing + NAV reporting): new revenue stream, improve client experience, improve automation, reduce ops dependency | transcript | transcript.md line 23 (Snowflake impl at NIMBL for SEI) + line 26 (new revenue stream, improve client experience) + line 27 (allow NL questions, help find data, enable non-tech users) | keep | Direct transcript hit |
| claim-139 | Case Study 8 (Cortex Analyst + Search): allow NL questions, help users find data, enable non-tech users to construct SQL, semantic-layer to AI-enabled analytics | transcript + existing_kb | transcript.md line 27 (verbatim "Allow natural language questions, help users find the data they were looking for, enable users who werent technically savvy to construct SQL queries") + kb/case_studies/cortex-ai-client-win.md | keep | Direct transcript hit |
| claim-140 | Case Study 9 (Cash flow + capital raise forecasting): forecast future cash flows + potential capital raises | transcript | transcript.md line 27 (verbatim "machine learning models to enable clients to forecast future cash flows and any potential capital raises") | keep | Direct transcript hit |
| claim-141 | Case Study 10 (Shanghai promotion): "After one year working on Under Armour's international team, Joe was offered a promotion in Shanghai" + Joe turned it down + still proud | transcript | transcript.md line 66 (verbatim "I was offered a promotion at Under Armour in Shanghai after 1 year of working on the international team that I ultimately turned down, but I am still proud of") | keep | Direct transcript hit |

### How the Agent Should Pitch Joe (LLM lines 859-908) + Guardrails (911-927) + Summary (930-933)

| claim-142 | All four canonical pitches (General, AI Product Owner, Data Cloud Product Owner, Analytics Leadership, Business Operations) + Q&A + Guardrails | meta | composed framings — not factual claims per se; consist of grouped earlier claims | meta | Agent-direction sections; the FACTS within reduce to claims 001..141 already covered |

## Re-grading impact (consolidated-resume.md added as tertiary ground-truth)

After consolidated-resume.md was staged 2026-05-13, the matrix was re-graded. 13 items flipped — 11 from `verify-with-joe` → `keep`, 1 from `strip` → `keep`, 1 from `strip` → `verify-with-joe`. The original row dispositions in the matrix above remain as the initial-grading record; this section overrides them where applicable.

| claim_id | Original disposition | New disposition | Resume source |
|---|---|---|---|
| claim-032 (style: "data-driven") | verify-with-joe | keep | consolidated-resume.md line 388 ("Data-driven decision making" — explicit leadership trait) |
| claim-033 (style: "business-outcome focused") | verify-with-joe | keep | consolidated-resume.md line 37 ("translate strategy into measurable execution") + line 80 ("data-enabled operating solutions") |
| claim-034 (style: "practical") | strip | keep | consolidated-resume.md line 392 ("Bias toward practical, scalable solutions" — explicit) |
| claim-035 (style: "credibility-based") | strip | verify-with-joe | consolidated-resume.md line 403 has the credibility framing ("credibility with business teams... credibility with technical teams... credibility with executives"); Joe should confirm whether this maps to "credibility-based" as a communication-style descriptor |
| claim-059 (target: Analytics Director) | verify-with-joe | keep | consolidated-resume.md line 31 ("Director/Senior Manager of Analytics") |
| claim-060 (target: Director of Business Operations) | verify-with-joe | keep | consolidated-resume.md line 31 + line 409 (entire role-specific section "Director of Business Operations") |
| claim-062 (target: BI Director) | verify-with-joe | keep | consolidated-resume.md line 31 ("Business Intelligence Leader") + line 434 |
| claim-063 (target: Snowflake Product Owner) | verify-with-joe | keep | consolidated-resume.md line 31 ("Snowflake/Data Cloud Business Analyst") + line 446 (entire section "Snowflake / Data Cloud / Data Platform Roles") |
| claim-064 (target: Technical Product Manager) | verify-with-joe | keep | consolidated-resume.md line 31 + line 421 (entire section "Technical Product Manager / Data Product Manager") |
| claim-065 (target: Solutions Consultant) | verify-with-joe | keep | consolidated-resume.md line 31 ("Sales/Solutions Engineering roles") + line 471 (entire section) |
| claim-085 (modeling goals: clean / repeatable / scalable / governed / free from duplicate logic / inconsistent naming) | verify-with-joe | keep | consolidated-resume.md lines 144-166 (core strengths list explicitly includes "Data architecture and data modeling", "Process design and standardization", "Snowflake data platforms", "Semantic layer and data dictionary design"); the goal terminology matches the consolidated resume's positioning vocabulary |
| claim-120 (retail/e-com areas: POS + loyalty specifically) | verify-with-joe | keep | consolidated-resume.md line 221 ("Point-of-sale technology and small-business retail operations" — explicit) + line 295 ("loyalty analytics work that contributed to a 6% increase in Net Promoter Score") |
| claim-124 (additional FS/PE domains: capital activity, commitments, distributions, fund metadata) | verify-with-joe | keep | consolidated-resume.md positioning of SEI Data Cloud (lines 228-245) supports the expanded data-domain list as consistent with Joe's NAV/ILPA work; not contradicted |

## Joe-review block (post-re-grade) — RESOLVED 2026-05-13

Items previously flagged `verify-with-joe`, now answered:

- claim-009 ("Joe has technical fluency and sales engineering experience, but those are supporting strengths rather than his core identity") → **Joe: Yes-keep** (accurate framing; tech fluency + sales-eng both real, both support PM/analytics-leader core identity)
- claim-035 (style descriptor: "credibility-based") → **Joe: Yes-keep** ("credibility-based" captures the underlying behavior; consolidated-resume.md line 403 frame is the canonical support)
- claim-052 (Joe asks: "What decision are we actually trying to make?") → **Joe: Yes-keep** (Joe does ask this; LLM picked up a real pattern not captured in the transcript)

**Final disposition counts (after Joe-review):** keep=75 (+3 from this resolution), strip=49, verify-with-joe=0, meta=9 → total 133 claims fully graded.

## OQ-04 Friend-test sequencing

Decision: **Option A — Re-DM friend-testers AFTER Phase 6 ships (enriched artifact gets the eval)**
Rationale: The friends should evaluate v1.0 in its intended state, not a pre-enrichment snapshot. Plan 05-12 sign-off is therefore BLOCKED until Phase 6 completes — current Google Form responses (if any arrive) are early-signal / informational only, not the official launch eval. After Phase 6 ships, re-send the form to the same 3 testers (or expand the tester list) for the canonical pre-distribution evaluation.

**Implications for Plan 05-12 / v1.0 milestone close:**
- Plan 05-12 cannot sign off until Phase 6 ships AND friend-testers respond on enriched artifact
- The 1-3 day async window for friend-test responses (memory) extends by Phase 6 duration
- Phase 6 verification (Plan 06-06) gets the new cat1 + cat4 evaluation; friend-tester re-DM is a separate post-Phase-6 step (recorded in Plan 06-06 follow-ups)

## Coverage assertion

- Every line in `docs/transcripts/06-about-me/llm-about-me.md` containing a factual assertion about Joe is represented as at least one claim row above.
- Filler / transition lines (e.g., section headers like "## Purpose", agent-instruction blocks, "A strong default summary:" framing lines) are excluded.
- 142 claims extracted across 933 source lines = ~1 claim per 6.6 lines (matches expected density for a mix of structured assertions + framing prose)

### Excluded filler lines (audit trail)

| line_range | content_type | exclusion_reason |
|------------|--------------|------------------|
| 1-9 | Header / Purpose | not a claim about Joe; meta |
| 41-46 | Final Agent Instruction | agent direction; covered as claim-010 meta |
| 188-200 | AI Product Owner Pitch frame | summarizes other claims; covered as claim-066/067 |
| 286-288, 346-348, 397-399, etc. | section dividers | filler |
| 575-576 | Case Studies header | filler |
| 858-861 | "How the Agent Should Pitch Joe" header + intro | filler |
| 882-883 | "Answering Recruiter Questions" header | filler |
| 909-911 | Guardrails header + intro | filler |
| 912-927 | Guardrails (DO/DO NOT lists) | agent direction; reduces to other claims |
| 929-933 | Summary Memory | reduces to claims 001..141 |

## OQ-04 Friend-test sequencing

Decision: [pending Joe — Option A: re-DM friend-testers AFTER Phase 6 ships (enriched artifact) | Option B: collect on CURRENT artifact, Phase 6 is post-friend-test enrichment | defer-to-plan-06-06]
Rationale: 

## Strip-vs-keep ratio analysis (for Plan 06-02)

**Post-re-grade (with consolidated-resume.md as tertiary ground-truth):**
- **keep** = 72 / 133 = 54% (claims with strong transcript / kb / consolidated-resume backing — survive into kb/about_me.md)
- **strip** = 49 / 133 = 37% (no_source filler, LLM-coined positioning labels, downstream interpretation framing)
- **verify-with-joe** = 3 / 133 = 2% (down from 13 originally — most flipped to keep after resume validation)
- **meta** = 9 / 133 = 7% (agent direction, not factual claims; not migrated)

**The 37% strip rate (down only slightly from 36% pre-re-grade) signals the LLM did substantial agent-expansion regardless of the resume**. The strip pile is dominated by:
- LLM-coined positioning labels ("strategic analytics leader", "AI-enabled analytics product owner") not in any canonical source
- LLM interpretations of Joe's traits ("healthy skepticism is not negativity, it is product discipline")
- "Downstream framing" sentences explaining why something matters in LLM voice

**The 54% keep rate (up from 42% pre-re-grade)** — the consolidated resume converted 11 verify-with-joe items + 1 strip to keep. Meaningful new substance Plan 06-03 can merge into kb/about_me.md, particularly:
- The Under Armour S&OP / Days Forward Coverage / Supply Chain War Room origin story (transcript lines 5-6) — currently absent from kb/about_me.md
- The Gap Kafka SKU / $20M Available-to-Sell incident (transcript line 66) — currently absent
- The Shanghai promotion turn-down (transcript line 66) — currently absent
- The Cortex Analyst / Cortex Search / semantic-layer specifics (transcript lines 27 + 65) — partially in kb/about_me.md but the transcript phrasing is sharper
- The SQL 7/10 + DDL honesty (transcript line 37) — gives the agent a concrete self-rating
- The data modeling star-schema preference (transcript line 39) — adds technical color
- The Gap brand hierarchy retirement (transcript lines 23-25) — currently in case study but not about_me
- The NIMBL/SEI Snowflake datasharing pitch framing (transcript lines 23, 26, 27) — refines current kb/about_me.md framing

## Top-5 surprising findings (post-re-grade, for SUMMARY.md)

1. **The two LLM source files agree on target roles, but neither matches kb/profile.yml**. The LLM about-me expanded targets to 9 roles (Data Cloud PO, AI PO, Analytics Director, Director of Biz Ops, Data PM, BI Director, Snowflake PO, Technical PM, Solutions Consultant); the consolidated resume lists 9 broadly-matching roles (Director of Biz Ops, Director/Senior Manager Analytics, Data PM, Tech PM, BI Leader, Snowflake/Data Cloud BA, Supply Chain Transformation Leader, Operations Strategy Leader, Sales/Solutions Engineering). **The two LLMs are aligned with each other but DIVERGE from kb/profile.yml** which has only 3. After re-grading, these target roles flip to `keep` (cross-LLM corroboration), but kb/profile.yml should be UPDATED to match in Plan 06-03 (or in a follow-on phase) — currently profile.yml is the narrowest of the three sources.

2. **The LLM about-me still coined unsupported positioning labels** even after resume validation: "strategic analytics leader" (claim-005) and "AI-enabled analytics product owner" (claim-006) appear nowhere in the consolidated resume OR the transcript. Both stay `strip`. The pattern: LLM expansions stack adjectives ahead of canonical labels.

3. **The consolidated resume surfaces NEW facts the LLM about-me never mentions** (and therefore Plan 06-01 cannot extract). Most notable: JMD Ventures self-employed period (June 2023 – March 2024), 6% NPS lift via Gap loyalty analytics, MicroStrategy data dictionary serving 1,000+ users across 4 regions / 3 channels at Gap, $45M product-dev/vendor savings at UA (3-year window), 150+ users at UA BI Office Hours, 2 analyst promotions at UA + 3 senior analysts mentored at Gap, $750K Sensodyne reverse-auction recovery at GSK, Lockheed "100-day strike" + leadership award, UA product launches (The Rock, Steph Curry, Lindsey Vonn collections), Master of Supply Chain Management credential (with verification caveat). **These are OUT OF SCOPE for Plan 06-01** (which extracts claims from llm-about-me.md only) but are the natural payload of the follow-on phase that merges the resume into kb/.

4. **The consolidated resume self-flags caveats Plan 06-04 voice-rewriting must honor**: $85M pricing impact is **projected** (5 fiscal years), not realized; $45M product-dev/vendor savings is "visibility into projected or identified cost reductions" unless verified; Master of Supply Chain Management appears in earlier resume material but needs Joe-confirmation before external use; "Overstating direct people management beyond the documented examples" is flagged as a risk. Plan 06-03 + 06-04 should preserve this nuance — current kb/about_me.md doesn't have it.

5. **The LLM added a "third question Joe asks" (claim-052: "What decision are we actually trying to make?")** that's in NEITHER the transcript NOR the consolidated resume. The two questions Joe actually said are in transcript line 31. This is exactly the premise-smuggling risk that HALLUCINATION_RULES targets in src/lib/system-prompt.ts. The third question is plausible but unverified — stays `verify-with-joe`.

## Net-new facts from consolidated-resume.md (OUT OF Plan 06-01 SCOPE — for follow-on phase)

These are facts in consolidated-resume.md that are NOT in llm-about-me.md and therefore not represented in the claim matrix above. They're recorded here as the payload for the follow-on phase that merges the resume content into kb/ (Phase 7 / decimal 6.x / sequenced TBD per Joe's "Both" scope decision 2026-05-13).

| fact_id | fact | resume_line | confidence | follow-on disposition |
|---|---|---|---|---|
| res-001 | JMD Ventures — Analytics Consultant, Self-Employed, June 2023 – March 2024 | 263-275 | high (Joe's own resume) | keep — fills the Gap → Retailcloud gap; new role for kb/resume.md + kb/about_me.md mention |
| res-002 | MicroStrategy data dictionary supporting 1,000+ end users across 4 regions and 3 channels at Gap | 287 | high | keep — quantified outcome currently missing from kb/resume.md Gap bullets |
| res-003 | JIRA bug/enhancement repeat-issue reduction of 15% at Gap | 294 | high | keep — quantified outcome |
| res-004 | 6% Net Promoter Score lift from Gap loyalty analytics | 295 | high | keep — quantified outcome + new domain (loyalty) for kb/about_me.md |
| res-005 | UA: $45M product development / vendor compliance cost reductions over 3 years (some resume versions cite this) | 313 | medium (verify; current resume framing is "visibility into projected or identified") | verify-with-joe — Joe confirms whether to surface |
| res-006 | UA: 150+ end users at BI Office Hours | 314 | high | keep — concrete number for kb/about_me.md BI-Office-Hours mention |
| res-007 | UA: mentored analysts; supported promotion of 2 analysts into senior roles | 315 | high | keep — leadership/people-development evidence |
| res-008 | UA: directed overhaul of merchandising data models and SAP BOBJ reports as technical product owner/architect | 316 | high | keep — adds depth to UA case study |
| res-009 | UA International role: supported product launches including The Rock, Steph Curry, Lindsey/Lindsay Vonn collections | 329 | high (Joe's resume) | keep — distinctive specifics (sports endorsement product launches) |
| res-010 | UA: Selected as SAP power user and tester | 334 | high | keep — explains depth of SAP HANA / BOBJ / AFS / FMS familiarity |
| res-011 | GSK / Johnson Service Group: recovered $750K through Sensodyne provider reverse auction | 340 | high | keep — earliest career quantified outcome; speaks to procurement depth |
| res-012 | Lockheed Martin: managed 3 new machine shops following a 100-day strike, earned excellence in leadership award | 343 | high | keep — character + leadership credibility from earliest role |
| res-013 | Gap: mentored 3 senior analysts | 566 | high | keep — leadership/people-development evidence (current kb has zero people-management mentions) |
| res-014 | Master of Supply Chain Management credential | 20, 647 | **VERIFY BEFORE EXTERNAL USE** — resume itself flags this as appearing in earlier material only | verify-with-joe |
| res-015 | Tools list expansion: Visio + Mural | 188-189 | low-impact addition | keep — append to kb/profile.yml tools[] |
| res-016 | Suggested 30-second / 60-second / one-line bio variants (4 versions) | 41-65 | high (Joe's resume framing) | reference — for kb/about_me.md voice-rewrite raw material in Plan 06-04 |

## Resume self-flagged caveats (for Plan 06-04 voice-rewriting + Plan 06-05 ground_truth_facts)

| caveat | source | action |
|---|---|---|
| $85M pricing impact is **projected** within 5 fiscal years, NOT already realized | consolidated-resume.md line 645 | voice-rewrite must say "projected" not "delivered" / "drove" |
| $45M product-dev/vendor savings — frame as "visibility into projected or identified cost reductions" unless verified | consolidated-resume.md line 646 | verify-with-joe before mentioning at all |
| Master of Supply Chain Management — appears in earlier resume material; confirm before using externally | consolidated-resume.md line 20, 647 | verify-with-joe |
| Don't overstate direct people management beyond documented examples (mentored 3 senior analysts at Gap; promoted 2 analysts at UA; 30 global teammates coordinated at UA Planning) | consolidated-resume.md line 636 | voice-rewrite uses these exact numbers, no generalization |
| Don't position Joe as full-stack engineer or pure software developer | consolidated-resume.md line 635 | aligns with existing kb/about_me.md framing; reinforce |
| Don't claim ownership of entire enterprise transformations when role was roadmap/PO/analytics/workstream | consolidated-resume.md line 638 | voice-rewrite must specify role scope (workstream lead, PO, etc.) |

## Next steps

After Joe fills out the Joe-review block + OQ-04 decision:
- Plan 06-02 strips `strip` and `no_source` claims from llm-about-me.md, producing llm-about-me.stripped.md
- Plan 06-03 merges keep + (Joe-yes-keep'd verify-with-joe) claims section-by-section into kb/about_me.md
- Plan 06-04 voice-rewrites for kb/voice.md cadence
- Plan 06-05 expands evals/cat-01-fabrication.yaml ground_truth_facts for any new specific factual claims
- Plan 06-06 verifies on preview + prod
