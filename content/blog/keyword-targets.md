# Runvax SEO — Content Strategy & Keyword Target List

*Last updated: 2026-07-10*
*Research grounded in live web search — see "Research findings" section below.*

This file is the master plan for the blog content initiative: 86 new posts across 7 pillars, on top of the 18 already published, bringing the total to ~104 posts.

---

## Research findings (grounds this whole plan)

**GEO/AEO (2026 AI-search reality):** AI answer engines (ChatGPT, Perplexity, Google AI Overviews) now cite pages differently than Google ranks them — overlap between top Google results and AI-cited sources has dropped below 20%. Every post must answer the primary query directly in the first ~150 words (TLDR-first, no throat-clearing), and lean on specific numbers/data over keyword density — that's what gets quoted by AI systems.

**Long-tail cluster math:** ~40 pages × 6-8 low-volume queries (30-80 searches/mo each) → 8,000-12,000 monthly sessions per topic cluster. This is why we're building pillar+cluster architecture, not isolated posts.

**Citable stats to weave into relevant posts (use naturally, don't force into every post):**
- Cold outbound reply rates: 2026 average 6-9%, top performers 14-18%, below 4% signals broken targeting/deliverability
- Personalized subject lines lift reply rates 30.5% (Martal Group 2025 B2B research)
- Optimal follow-up cadence: 4-5 touches over 21 days; more touches degrade reply rate
- Multi-channel lead gen generates 287% more leads than single-channel
- Shifting from lead volume to lead quality can cut acquisition cost 33% while producing 50% more sales-ready opportunities
- "Side hustles 2026" search volume ~60K/month, up ~48% quarter-over-quarter
- 39% of working Americans have a side hustle (~80M people)

**Competitor content patterns worth emulating:**
- Apollo.io targets keyword mix across informational/navigational/commercial-investigational/transactional intent; 90% of their keywords mirror their top 3-5 competitors' targets
- Hunter.io built a 511-template directory as a single massive linkable asset; publishes an "AI cold email guide" as a pillar page
- Both use long-form guides that rank for dozens of related long-tail terms simultaneously

---

## Content architecture: 7 pillars

Each pillar has one **HUB** post (comprehensive, high-level, targets the broad head keyword) and several **CLUSTER** posts (specific, long-tail, each targeting one narrow query). Every cluster post links back to its hub. This is the proven pillar-cluster SEO model.

### Interlinking rule (apply to every post, new and old)

1. Link to your pillar's HUB post once, contextually (not just in a link dump).
2. Link to 2 "sibling" posts in the same pillar — the post immediately before and after yours in the list below (chain interlinking, so the whole pillar forms a connected path).
3. Link to 1 post in a *different* pillar where it's contextually relevant (cross-pillar links are listed as suggestions below each pillar; use judgment if a better fit exists among posts you can see).
4. Where a page already exists for the topic (e.g. `/vs-apollo`, `/vs-fiverr`, `/vs-upwork`, `/pricing`, `/faq`), link to that live app page instead of duplicating it in a blog post.
5. Every post ends with a CTA section linking to `https://runvax.com` (or relative `/` for the search tool) — follow the existing footer pattern already in `blog/[slug]/page.tsx`, don't hand-roll a new one in-content unless the natural CTA sentence calls for an inline link too.
6. Use relative links for other blog posts: `[anchor text](/blog/slug-here)`. Use absolute `https://runvax.com` only for the primary product mention/CTA link, matching existing published posts.

### Writing style (match existing published posts exactly)

- Open with a 1-2 sentence direct answer to the core query (GEO requirement) — no throat-clearing intro paragraphs.
- H2 section headers, occasional H3 for sub-points.
- Tables where comparing options/numbers (existing posts use markdown tables freely — MDX renders them styled).
- Short paragraphs (2-4 sentences). Bullet lists for scannable steps.
- Concrete numbers over vague claims — use the stats above where genuinely relevant, cite them naturally ("2026 averages for B2B cold outbound are 6-9%" not "reply rates are generally low").
- Runvax is mentioned as the tool/solution in a dedicated section, not shoehorned into every paragraph. One clear product section + one footer CTA is enough.
- Tone: direct, practical, numbers-driven — like a smart operator explaining what actually works, not marketing fluff. No em-dashes-as-commas overuse; vary sentence length.
- Length: 900-1600 words. Long enough for depth (GEO reward), not padded.
- Frontmatter schema (exact — copy this shape):

```yaml
---
title: "Exact Title Here"
description: "150-160 char meta description, includes the target keyword naturally."
date: "2026-07-10"
category: "Lead Gen"
tags: ["target keyword", "related term", "related term", "related term"]
---
```

Valid `category` values (reuse existing where it fits, or use the new ones added for this initiative): `Guide`, `Strategy`, `Cold Email`, `Tutorial`, `Tools`, `Templates`, `Resources`, `Lead Gen`, `Make Money`, `AI Tools`, `Comparison`.

Stagger `date` values across **2026-07-10 through 2026-10-15** in the order posts are listed within each pillar (roughly 1-2 days apart) so the blog doesn't look like it was published in one dump — this matters for both crawl pacing and reader trust signals.

---

## PILLAR A — Lead Generation & Prospecting (general, geography-agnostic)

Cross-pillar link suggestion: link into Pillar B (Cold Outreach) hub and Pillar F (AI Tools) hub where relevant.

1. **HUB** `lead-generation-for-small-business-complete-guide` — "Lead Generation for Small Business: The Complete 2026 Guide" — kw: lead generation for small business
2. `why-your-business-has-no-leads` — "Why Your Business Has No Leads (And How to Fix It)" — kw: why am I not getting leads
3. `multi-channel-lead-generation-strategy` — "Multi-Channel Lead Generation: Why One Channel Isn't Enough in 2026" — kw: multi-channel lead generation
4. `lead-quality-vs-lead-quantity` — "Lead Quality vs. Lead Quantity: Which Actually Grows Revenue" — kw: lead quality vs quantity
5. `how-to-build-a-lead-generation-engine` — "How to Build a Lead Generation Engine That Runs Without You" — kw: lead generation engine
6. `b2b-lead-generation-strategies-2026` — "B2B Lead Generation Strategies That Work in 2026" — kw: b2b lead generation strategies
7. `local-lead-generation-guide` — "Local Lead Generation: How to Find Nearby Customers Who Need You" — kw: local lead generation
8. `lead-generation-for-agencies` — "Lead Generation for Agencies: Filling Your Own Pipeline" — kw: lead generation for agencies
9. `inconsistent-leads-how-to-fix-feast-or-famine-pipeline` — "Fixing the Feast-or-Famine Pipeline: Why Your Leads Are So Inconsistent" — kw: inconsistent leads small business
10. `how-to-track-lead-sources-without-a-crm` — "How to Track Lead Sources Without an Expensive CRM" — kw: track lead sources
11. `lead-generation-tools-comparison-2026` — "Lead Generation Tools Compared: Free, Cheap, and Premium Options in 2026" — kw: lead generation tools
12. `free-lead-generation-strategies-no-budget` — "Free Lead Generation Strategies for When You Have Zero Budget" — kw: free lead generation

## PILLAR B — Cold Outreach & Cold Email Mastery

Cross-pillar link suggestion: link into Pillar A hub and Pillar E (Make Money) where relevant.

1. **HUB** `cold-outreach-complete-guide-2026` — "Cold Outreach in 2026: The Complete Guide" — kw: cold outreach guide
2. `cold-email-subject-lines-that-get-replies` — "47 Cold Email Subject Lines That Actually Get Replies" — kw: cold email subject lines
3. `cold-email-follow-up-sequence-that-works` — "The Cold Email Follow-Up Sequence That Actually Works" — kw: cold email follow up sequence
4. `cold-email-reply-rate-benchmarks-2026` — "Cold Email Reply Rate Benchmarks: What's Normal in 2026" — kw: cold email reply rate benchmarks
5. `how-to-handle-price-objections-in-cold-email` — "How to Handle Price Objections in Cold Email (With Scripts)" — kw: price objection cold email
6. `cold-calling-vs-cold-email-which-works-better` — "Cold Calling vs. Cold Email: Which Actually Works Better in 2026" — kw: cold calling vs cold email
7. `whatsapp-cold-outreach-guide` — "WhatsApp Cold Outreach: A Complete Guide for 2026" — kw: whatsapp outreach
8. `cold-email-deliverability-guide` — "Cold Email Deliverability: Why Your Emails Land in Spam" — kw: cold email deliverability
9. `how-to-personalize-cold-emails-at-scale` — "How to Personalize Cold Emails at Scale (Without Faking It)" — kw: personalize cold emails at scale
10. `cold-email-mistakes-killing-your-reply-rate` — "9 Cold Email Mistakes Killing Your Reply Rate" — kw: cold email mistakes
11. `best-time-to-send-cold-emails` — "The Best Time to Send Cold Emails (Backed by Data)" — kw: best time to send cold email
12. `how-many-follow-ups-before-giving-up` — "How Many Follow-Ups Before You Give Up on a Lead?" — kw: cold email follow up how many
13. `cold-outreach-scripts-for-local-business-pitches` — "Cold Outreach Scripts for Pitching Local Businesses" — kw: cold outreach scripts

## PILLAR C — Web Design Client Acquisition (geo expansion of existing proven niche)

Cross-pillar link suggestion: link into Pillar B hub (cold outreach) and Pillar D (pricing/proposal posts).

1. `web-design-clients-ibadan` — "How to Find Web Design Clients in Ibadan" — kw: web design clients Ibadan
2. `web-design-clients-kano` — "How to Find Web Design Clients in Kano" — kw: web design clients Kano
3. `web-design-clients-enugu` — "How to Find Web Design Clients in Enugu" — kw: web design clients Enugu
4. `web-design-clients-benin-city` — "How to Find Web Design Clients in Benin City" — kw: web design clients Benin City
5. `web-design-clients-jos` — "How to Find Web Design Clients in Jos" — kw: web design clients Jos
6. `web-design-clients-manchester` — "How to Find Web Design Clients in Manchester" — kw: web design clients Manchester
7. `web-design-clients-birmingham` — "How to Find Web Design Clients in Birmingham" — kw: web design clients Birmingham
8. `web-design-clients-london` — "How to Find Web Design Clients in London" — kw: web design clients London
9. `web-design-clients-toronto` — "How to Find Web Design Clients in Toronto" — kw: web design clients Toronto
10. `web-design-clients-vancouver` — "How to Find Web Design Clients in Vancouver" — kw: web design clients Vancouver
11. `web-design-clients-new-york` — "How to Find Web Design Clients in New York" — kw: web design clients New York
12. `web-design-clients-los-angeles` — "How to Find Web Design Clients in Los Angeles" — kw: web design clients Los Angeles
13. `web-design-clients-johannesburg` — "How to Find Web Design Clients in Johannesburg" — kw: web design clients Johannesburg
14. `website-cost-nigeria-2026` — "How Much Does a Website Cost in Nigeria in 2026?" — kw: website cost Nigeria
15. `web-design-agency-nigeria-how-to-start` — "How to Start a Web Design Agency in Nigeria (Beyond Solo Freelancing)" — kw: web design agency Nigeria

## PILLAR D — Freelance & Agency Business Growth

Cross-pillar link suggestion: link into Pillar C posts (geo-specific) and Pillar E (make money).

1. **HUB** `how-to-price-web-design-projects` — "How to Price Web Design Projects (A Global Framework)" — kw: how to price web design projects
2. `web-design-proposal-that-wins-clients` — "How to Write a Web Design Proposal That Wins Clients" — kw: web design proposal template
3. `freelance-web-designer-salary-2026` — "Freelance Web Designer Salary in 2026: Real Numbers" — kw: web designer salary 2026
4. `how-to-scale-from-freelancer-to-agency` — "How to Scale From Solo Freelancer to Agency" — kw: scale freelancer to agency
5. `web-design-contract-essentials` — "Web Design Contract Essentials (What to Include, What to Avoid)" — kw: web design contract
6. `how-to-niche-down-as-a-web-designer` — "How to Niche Down as a Web Designer (And Why It Gets You More Clients)" — kw: niche down web designer
7. `portfolio-that-gets-clients-web-design` — "Building a Portfolio That Actually Gets You Clients" — kw: web design portfolio that gets clients
8. `how-to-handle-scope-creep-web-design-clients` — "How to Handle Scope Creep With Web Design Clients" — kw: scope creep web design
9. `web-design-client-onboarding-checklist` — "The Web Design Client Onboarding Checklist" — kw: web design client onboarding
10. `how-to-get-referrals-web-design-business` — "How to Get More Referrals for Your Web Design Business" — kw: get referrals web design
11. `web-design-retainer-model-recurring-revenue` — "The Web Design Retainer Model: Turning Projects Into Recurring Revenue" — kw: web design retainer model
12. `tools-every-freelance-web-designer-needs-2026` — "Tools Every Freelance Web Designer Needs in 2026" — kw: tools freelance web designer
13. `web-design-business-mistakes-to-avoid` — "10 Web Design Business Mistakes That Kill Growth" — kw: web design business mistakes

## PILLAR E — Make Money / Side Hustle (2026 trend-anchored)

Cross-pillar link suggestion: link into Pillar D hub and Pillar F (AI tools).

1. **HUB** `how-much-can-you-make-freelance-web-design-2026` — "How Much Can You Actually Make in Freelance Web Design in 2026?" — kw: how much do freelance web designers make
2. `best-side-hustles-for-designers-2026` — "Best Side Hustles for Designers in 2026" — kw: best side hustles for designers
3. `ai-enhanced-freelancing-2026-guide` — "AI-Enhanced Freelancing: The 2026 Guide to Working Smarter" — kw: AI enhanced freelancing
4. `how-to-make-500-a-month-freelancing` — "How to Make an Extra $500 a Month Freelancing" — kw: make $500 a month freelancing
5. `how-to-make-5000-a-month-web-design` — "How to Make $5,000+ a Month From Web Design" — kw: make $5000 a month web design
6. `freelance-income-diversification-web-designers` — "Income Diversification for Web Designers: Beyond One-Off Projects" — kw: diversify freelance income
7. `passive-income-ideas-for-web-designers` — "Passive Income Ideas for Web Designers (Templates, Courses, and More)" — kw: passive income web designers
8. `how-to-quit-your-job-and-freelance-full-time` — "How to Quit Your Job and Freelance Full-Time (Without the Panic)" — kw: quit job freelance full time
9. `web-design-side-hustle-while-working-full-time` — "Running a Web Design Side Hustle While Working Full-Time" — kw: web design side hustle
10. `digital-products-web-designers-can-sell` — "Digital Products Web Designers Can Sell for Passive Income" — kw: digital products web designers sell
11. `is-web-design-still-profitable-in-2026` — "Is Web Design Still Profitable in 2026?" — kw: is web design still profitable

## PILLAR F — AI Tools & Automation for Sales/Outreach

Cross-pillar link suggestion: link into Pillar A hub and Pillar B (cold email) posts.

1. **HUB** `ai-tools-for-lead-generation-2026` — "The Best AI Tools for Lead Generation in 2026" — kw: AI tools for lead generation
2. `ai-cold-email-writing-guide-2026` — "How to Use AI to Write Cold Emails That Get Replies (2026 Guide)" — kw: AI cold email writing
3. `best-ai-sales-prospecting-tools-2026` — "Best AI Sales Prospecting Tools in 2026" — kw: AI sales prospecting tools
4. `how-ai-finds-businesses-without-websites` — "How AI Finds Businesses Without a Website (The Tech Behind It)" — kw: how AI finds businesses without website
5. `ai-vs-manual-lead-generation-which-is-faster` — "AI vs. Manual Lead Generation: A Real Time Comparison" — kw: AI vs manual lead generation
6. `automating-cold-outreach-without-sounding-robotic` — "Automating Cold Outreach Without Sounding Robotic" — kw: automate cold outreach
7. `ai-proposal-generator-guide` — "How AI Proposal Generators Work (And When to Use One)" — kw: AI proposal generator
8. `chatgpt-for-freelancers-practical-use-cases` — "ChatGPT for Freelancers: 12 Practical Use Cases" — kw: ChatGPT for freelancers
9. `best-ai-tools-for-solo-agencies-2026` — "Best AI Tools for Solo Agencies in 2026" — kw: AI tools for solo agencies
10. `ai-lead-scoring-explained` — "AI Lead Scoring Explained: How It Works and Why It Matters" — kw: AI lead scoring
11. `how-to-use-ai-to-find-your-first-10-clients` — "How to Use AI to Find Your First 10 Clients" — kw: AI find first clients

## PILLAR G — Comparisons & Alternatives

Cross-pillar link suggestion: link to the live `/vs-apollo`, `/vs-fiverr`, `/vs-upwork` app pages (not duplicate content), and into Pillar F hub.

1. **HUB** `best-lead-generation-tools-2026` — "The Best Lead Generation Tools in 2026 (Compared)" — kw: best lead generation tools
2. `best-cold-email-tools-2026` — "Best Cold Email Tools in 2026" — kw: best cold email tools
3. `best-crm-for-freelancers-2026` — "Best CRM for Freelancers in 2026 (Free and Paid)" — kw: best CRM for freelancers
4. `hunter-io-alternatives` — "Best Hunter.io Alternatives in 2026" — kw: Hunter.io alternatives
5. `apollo-io-alternatives` — "Best Apollo.io Alternatives in 2026" — kw: Apollo.io alternatives
6. `best-free-lead-generation-tools` — "Best Free Lead Generation Tools in 2026" — kw: free lead generation tools
7. `upwork-vs-cold-outreach-which-gets-better-clients` — "Upwork vs. Cold Outreach: Which Gets You Better Clients?" — kw: Upwork vs cold outreach
8. `fiverr-vs-building-your-own-client-pipeline` — "Fiverr vs. Building Your Own Client Pipeline" — kw: Fiverr vs own client pipeline
9. `best-whatsapp-business-tools-for-outreach` — "Best WhatsApp Business Tools for Outreach in 2026" — kw: WhatsApp business tools outreach
10. `snov-io-vs-hunter-vs-runvax-comparison` — "Snov.io vs. Hunter.io vs. Runvax: Which Fits Your Workflow?" — kw: Snov.io vs Hunter.io
11. `best-tools-for-finding-businesses-without-websites` — "Best Tools for Finding Businesses Without a Website" — kw: tools find businesses without website
12. `runvax-alternative` — "Best Runvax Alternatives for Finding No-Website Businesses" — kw: Runvax alternative

---

## Batch assignments (for parallel content generation agents)

| Agent | Pillar(s) | Post count |
|---|---|---|
| 1 | A — Lead Generation & Prospecting | 12 |
| 2 | B — Cold Outreach & Cold Email | 13 |
| 3 | C — Web Design Geo Expansion | 15 |
| 4 | D — Freelance & Agency Growth | 13 |
| 5 | E — Make Money / Side Hustle | 11 |
| 6 | F — AI Tools & Automation | 11 |
| 7 | G — Comparisons & Alternatives | 12 |

**Total new posts: 87. Existing: 18. Grand total: 105.**

---

## Existing published posts (for interlinking reference — do not duplicate these topics)

- how-to-make-money-web-design-nigeria
- how-to-find-web-design-clients-in-nigeria
- web-design-clients-lagos
- web-design-course-nigeria-2026
- freelance-web-designer-nigeria-guide
- ai-tools-for-web-designers-nigeria-2026
- web-design-clients-abuja
- web-design-clients-port-harcourt
- build-websites-with-ai-nigeria
- web-design-proposal-template-nigeria
- how-to-start-web-design-business-nigeria
- how-to-price-website-design-in-nigeria
- cold-email-templates-web-designers-2025
- how-to-find-businesses-without-a-website
- cold-outreach-for-web-designers-what-works-2026
- how-to-find-web-design-clients-in-ghana
- how-to-find-web-design-clients-in-kenya
- how-to-get-web-design-clients-uk

---

## PHASE 2 — Feature-mapped pillars (2026-07-11 addition)

The 7 pillars above are mostly top-of-funnel ("how do I get clients"). This phase maps content directly to product features — proposals, pipeline tracking, and website delivery quality — to reach searchers much closer to the point of using Runvax. Same rigor: real research, GEO-first opening, full interlinking, 900-1600 words.

**Research findings for this phase:**
- Halo effect: a polished first impression on a proposal makes prospects assume the same quality applies to the work itself
- Three-tier pricing converts ~1.4x better than two-tier; four-plus tiers convert worse
- 60% of proposals go silent, but 42.5% of closed-won deals close within 24 hours of the client opening the proposal — speed of follow-up matters more than most freelancers think
- Day 1 after sending, a prospect is ~80% ready to move forward; by day 7 they're reconsidering whether they need the service at all
- "Just checking in" is the lowest-performing follow-up opener; adding new value (case study, resource) works far better
- Booking a walkthrough call *before* sending the proposal makes ghosting structurally harder — they'd have to cancel a meeting, not just ignore an email
- 36% of freelancer time goes to admin tasks that connected tools could automate
- Modern lead tracking has moved beyond contact lists into full-lifecycle pipelines (contact → proposal → contract → delivery)
- 53% of mobile users abandon a site that takes longer than 3 seconds to load; each additional second of load time can cut conversions up to 7%; a 1-second mobile delay can cut conversions up to 20%
- Over 60% of global web traffic is mobile — Google's ranking signals now evaluate the mobile version of a site as primary
- Core Web Vitals (LCP, FID/INP, CLS) are the standard framework for measuring the speed/stability that drives both rankings and conversions

**Product grounding — use these exact mechanics, don't invent generic ones:**
- Runvax's pipeline has exactly 6 stages: **Found → Contacted → Interested → Proposal → Won / Lost**. "Interested" has sub-states (asked price, requested info, requested a call, said "okay thanks", said "I'll think about it"). Prospects untouched for 3+ days show a "needs follow-up" flag. There's a reminder/overdue system and a running total of pipeline value + won value.
- Runvax's AI proposal generator takes business name, industry, location, your name/phone/website, a price range, and a timeline, and produces a formal proposal — plus can email it directly to the prospect.

### PILLAR H — AI Proposal Generation & Winning Deals (10 posts)

Cross-pillar links: into Pillar D hub (`how-to-price-web-design-projects`) and Pillar B (cold email follow-up post).

1. **HUB** `web-design-proposal-psychology-that-wins` — "The Psychology of Web Design Proposals That Win" — kw: web design proposal psychology
2. `how-to-follow-up-after-sending-a-proposal` — "How to Follow Up After Sending a Proposal (Without Sounding Desperate)" — kw: follow up after sending proposal
3. `why-clients-ghost-after-a-proposal` — "Why Clients Ghost After a Proposal — And How to Prevent It" — kw: client ghosted after proposal
4. `three-tier-pricing-for-web-design-proposals` — "Three-Tier Pricing for Web Design Proposals (Why It Converts Better)" — kw: three tier pricing web design
5. `value-based-pricing-vs-hourly-web-design` — "Value-Based Pricing vs. Hourly: Which Wins More Web Design Clients" — kw: value based pricing web design
6. `how-ai-proposals-close-more-deals` — "How AI-Generated Proposals Close More Deals, Faster" — kw: AI proposal generator close deals (ground this in Runvax's actual proposal generator mechanics)
7. `proposal-mistakes-that-lose-clients` — "8 Proposal Mistakes That Lose You the Client" — kw: proposal mistakes web design
8. `how-to-price-a-website-project-proposal` — "How to Present Price in a Website Project Proposal" — kw: price website project proposal (differentiate clearly from `/blog/how-to-price-web-design-projects`, which is the general pricing framework — this one is specifically about *presenting* price inside the proposal document itself: anchoring, tier order, where price sits on the page)
9. `proposal-to-contract-what-happens-after-they-say-yes` — "Proposal to Contract: What Happens After They Say Yes" — kw: proposal to contract web design
10. `how-fast-should-you-send-a-proposal` — "How Fast Should You Send a Proposal After First Contact?" — kw: how fast send proposal after inquiry

### PILLAR I — Lead & Pipeline Tracking (10 posts)

Cross-pillar links: into Pillar A hub (`lead-generation-for-small-business-complete-guide`) and Pillar E (make-money income posts).

1. **HUB** `how-to-track-web-design-leads-without-a-spreadsheet` — "How to Track Web Design Leads Without a Spreadsheet" — kw: track web design leads without spreadsheet
2. `free-crm-alternatives-for-freelance-web-designers` — "Free CRM Alternatives for Freelance Web Designers" — kw: free CRM freelance web designers
3. `pipeline-stages-every-web-designer-should-track` — "The Pipeline Stages Every Web Designer Should Track" — kw: sales pipeline stages web design (use Runvax's real 6 stages as the model)
4. `how-often-to-follow-up-with-leads-before-giving-up` — "How Often Should You Follow Up With a Lead Before Giving Up?" — kw: how often follow up with leads (pipeline-wide cadence — differentiate from the Pillar B post which is specifically about cold email follow-up sequences)
5. `calculating-your-web-design-close-rate` — "How to Calculate (and Improve) Your Web Design Close Rate" — kw: web design close rate
6. `why-leads-go-cold-and-how-to-revive-them` — "Why Leads Go Cold — And How to Revive Them" — kw: revive cold leads
7. `how-to-forecast-monthly-revenue-from-your-pipeline` — "How to Forecast Monthly Revenue From Your Pipeline" — kw: forecast revenue from pipeline
8. `kanban-vs-spreadsheet-for-tracking-clients` — "Kanban vs. Spreadsheet for Tracking Web Design Clients" — kw: kanban vs spreadsheet client tracking
9. `reminders-and-follow-up-systems-for-freelancers` — "Reminders and Follow-Up Systems Every Freelancer Needs" — kw: follow up reminder system freelancer
10. `how-much-pipeline-value-do-you-need-to-hit-your-income-goal` — "How Much Pipeline Value Do You Need to Hit Your Income Goal?" — kw: pipeline value income goal

### PILLAR J — Building Client-Winning Websites (12 posts)

**Important framing:** this is NOT generic "how to code a website" content (impossible to rank against freeCodeCamp/MDN/W3Schools). Every post ties design/technical quality back to a business outcome — closing the deal, keeping the client, getting referred. Audience is working freelancers/agencies who want to level up delivery quality, not beginners learning to code.

Cross-pillar links: into Pillar D (freelance/agency growth) and Pillar H (proposals) posts.

1. **HUB** `how-to-build-websites-that-win-and-keep-clients` — "How to Build Websites That Win and Keep Clients" — kw: build websites that win clients
2. `mobile-first-design-that-converts-local-business-visitors` — "Mobile-First Design That Converts Local Business Visitors" — kw: mobile first design conversion
3. `website-speed-and-why-it-costs-you-clients` — "Website Speed: Why a Slow Site Costs You Clients" — kw: website speed loses clients
4. `core-web-vitals-explained-for-freelance-designers` — "Core Web Vitals Explained for Freelance Designers" — kw: core web vitals freelancers
5. `what-makes-a-website-look-professional-vs-amateur` — "What Makes a Website Look Professional vs. Amateur" — kw: professional vs amateur website design
6. `website-must-have-features-small-business-clients-expect` — "Website Features Every Small Business Client Expects" — kw: website features small business expect
7. `how-to-present-website-work-to-a-non-technical-client` — "How to Present Website Work to a Non-Technical Client" — kw: present website work to client
8. `portfolio-quality-website-checklist-before-delivery` — "The Portfolio-Quality Website Checklist Before Delivery" — kw: website delivery checklist
9. `how-long-should-it-take-to-build-a-small-business-website` — "How Long Should It Take to Build a Small Business Website?" — kw: how long to build small business website
10. `website-accessibility-basics-every-designer-should-know` — "Website Accessibility Basics Every Designer Should Know" — kw: website accessibility basics
11. `common-website-mistakes-that-make-businesses-look-untrustworthy` — "Website Mistakes That Make a Business Look Untrustworthy" — kw: website mistakes untrustworthy
12. `how-to-turn-one-website-client-into-five-referrals` — "How to Turn One Website Client Into Five Referrals" — kw: turn client into referrals

### Batch assignments — Phase 2

| Agent | Pillar | Posts |
|---|---|---|
| 8 | H — AI Proposal Generation | 10 |
| 9 | I — Lead & Pipeline Tracking | 10 |
| 10 | J — Building Client-Winning Websites | 12 |

**Phase 2 total: 32 new posts. Combined grand total: 137 posts.**

---

## PHASE 3 — Industry vertical playbooks (2026-07-11 addition)

Rationale: at 137 posts, more generic pillar content (more cities, more general lead-gen advice) risks reading as thin/templated to Google. The genuinely untapped keyword space is industry-specific pitch content — one post per industry Runvax already searches, each with real, differentiated pain points, objections, and pricing expectations for that vertical. This is NOT a template swap exercise — each post must contain something a generic "how to pitch any business" post couldn't say.

**Domain status as of this phase:** runvax.com and www.runvax.com are both live and DNS-verified. Once this batch ships, submit to Google Search Console.

### PILLAR K — Industry Vertical Playbooks (23 posts: 1 hub + 22 verticals)

The 22 verticals map exactly to Runvax's real industry categories (see `src/app/layout.tsx` JSON-LD `featureList` / industries list for the canonical list — do not invent industries outside this set).

Cross-pillar links: into Pillar B (cold outreach scripts), Pillar H (proposal pricing/psychology), and Pillar D (pricing framework).

1. **HUB** `best-industries-to-pitch-for-web-design` — "The Best Industries to Pitch for Web Design (Ranked by Opportunity)" — kw: best industries for web design clients. Include a table ranking industries by no-website rate, average deal size, and pitch difficulty; link out to all 22 vertical posts below.

2. `pitching-restaurants-for-web-design` — "How to Pitch Restaurants for a Website (What They Actually Care About)" — kw: web design for restaurants
3. `pitching-beauty-salons-for-web-design` — "How to Pitch Beauty Salons and Spas for a Website" — kw: web design for beauty salons
4. `pitching-barbershops-for-web-design` — "How to Pitch Barbershops and Hair Salons for a Website" — kw: web design for barbershops
5. `pitching-schools-for-web-design` — "How to Pitch Schools and Private Tutors for a Website" — kw: web design for schools
6. `pitching-clinics-for-web-design` — "How to Pitch Clinics and Hospitals for a Website" — kw: web design for clinics
7. `pitching-pharmacies-for-web-design` — "How to Pitch Pharmacies for a Website" — kw: web design for pharmacies
8. `pitching-real-estate-agencies-for-web-design` — "How to Pitch Real Estate Agencies for a Website" — kw: web design for real estate agents
9. `pitching-hotels-for-web-design` — "How to Pitch Hotels and Guesthouses for a Website" — kw: web design for hotels
10. `pitching-event-centers-for-web-design` — "How to Pitch Event Centers and Halls for a Website" — kw: web design for event centers
11. `pitching-law-firms-for-web-design` — "How to Pitch Law Firms for a Website" — kw: web design for law firms
12. `pitching-auto-workshops-for-web-design` — "How to Pitch Auto Workshops and Mechanics for a Website" — kw: web design for auto repair shops
13. `pitching-fashion-boutiques-for-web-design` — "How to Pitch Fashion Boutiques for a Website" — kw: web design for boutiques
14. `pitching-photographers-for-web-design` — "How to Pitch Photography Studios for a Website" — kw: web design for photographers
15. `pitching-gyms-for-web-design` — "How to Pitch Gyms and Fitness Centers for a Website" — kw: web design for gyms
16. `pitching-contractors-for-web-design` — "How to Pitch Construction and Contractors for a Website" — kw: web design for contractors
17. `pitching-caterers-for-web-design` — "How to Pitch Catering Services for a Website" — kw: web design for caterers
18. `pitching-churches-for-web-design` — "How to Pitch Churches and Ministries for a Website" — kw: web design for churches
19. `pitching-travel-agencies-for-web-design` — "How to Pitch Travel and Tour Agencies for a Website" — kw: web design for travel agencies
20. `pitching-local-stores-for-web-design` — "How to Pitch Supermarkets and Local Stores for a Website" — kw: web design for retail stores
21. `pitching-laundry-businesses-for-web-design` — "How to Pitch Laundry and Dry Cleaning Businesses for a Website" — kw: web design for laundry businesses
22. `pitching-print-shops-for-web-design` — "How to Pitch Printing and Design Shops for a Website" — kw: web design for print shops
23. `pitching-accounting-firms-for-web-design` — "How to Pitch Accounting and Tax Firms for a Website" — kw: web design for accounting firms

**What must differ per post (non-negotiable — this is what separates this from thin/templated content):**
- The real objection that industry raises most ("my customers just call me," "I get everything from referrals," "I don't have time to update a website," etc.) — must be genuinely specific to how that industry actually operates, verified via web search if not obvious
- Realistic price expectations/budget sensitivity for that specific industry (a law firm and a barbershop have very different budgets and expectations)
- What that industry's website actually needs to include (a restaurant needs a menu + photos + hours; a law firm needs credibility signals + practice areas + consultation booking; a real estate agency needs listings; a gym needs class schedules + membership signup)
- Where to actually find these businesses (which search terms, which platforms — e.g. photographers live on Instagram as much as Google Maps)

**Interlinking rule for this pillar:** every vertical post links to the HUB, links to 2 sibling verticals (chain, in list order above), and 1 cross-pillar link into a Pillar B, D, or H post as fits the topic.

**Frontmatter:** category `"Guide"`, dates staggered 2026-10-08 through 2026-11-15 in list order.

### Batch assignment — Phase 3

| Agent | Scope | Posts |
|---|---|---|
| 11 | HUB + verticals 1–11 (restaurants through auto workshops) | 12 |
| 12 | Verticals 12–22 (fashion boutiques through accounting firms) | 11 |

**Phase 3 total: 23 new posts. Combined grand total: 160 posts.**

---

## PHASE 4 — AI skills monetization (2026-07-12 addition)

Founder clarified the real audience: not just web designers — anyone who has learned an AI-powered skill (AI web design, AI video, AI content, automation/chatbots) and needs businesses willing to pay for it. "How to make money with AI" is one of the hottest 2026 search trends. This pillar targets that directly.

### PILLAR L — AI Skills Monetization (15 posts: 1 hub + 14 cluster)

Category: "Make Money" or "AI Tools" as fits. Grounded in real 2026 freelance AI earnings data (chatbot dev $40-100/hr, AI audits $5-20K, full implementations $25-150K, ongoing retainers $2.5-15K/mo; AI video $12-18/clip entry to $1,200-3,000/mo productized retainers; AI data analytics $80-150/hr).

1. **HUB** `how-to-make-money-with-ai-skills-2026`
2. `how-to-sell-ai-web-design-services-to-local-businesses`
3. `how-to-start-an-ai-video-editing-side-hustle`
4. `ai-video-services-businesses-will-pay-for`
5. `best-ai-skills-to-learn-for-freelancing-2026`
6. `how-to-find-clients-for-ai-services`
7. `how-much-can-you-charge-for-ai-web-design`
8. `ai-freelancing-vs-traditional-freelancing-which-pays-more`
9. `how-to-pitch-ai-powered-services-to-skeptical-business-owners`
10. `ai-video-marketing-services-for-small-business`
11. `building-an-ai-services-agency-from-scratch`
12. `no-code-ai-tools-to-offer-as-a-service-2026`
13. `how-to-package-ai-skills-into-a-sellable-service`
14. `ai-skills-that-are-actually-in-demand-right-now`
15. `ai-services-pricing-guide-2026`

Interlinking: chain siblings within pillar, all link to hub, cross-pillar links into Pillar A/F (lead gen, AI tools) posts. Footer CTA reframed around "finding businesses with gaps" (no website, no booking, no automation) rather than narrowly "web design clients."

**Phase 4 total: 15 new posts.**

---

## Post-launch checklist (after all agents finish)

1. Verify no duplicate slugs, all frontmatter parses.
2. `npm run build` to confirm MDX compiles and sitemap picks up every post.
3. Spot-check interlinks resolve to real slugs (no 404s).
4. Submit updated sitemap.xml to Google Search Console once deployed.
5. Update `llms.txt` to reflect the expanded content scope for AI answer engines.

---

## PHASE 5 — AI Client Acquisition for Builders & Developers (2026-09-01 addition)

Rationale: the product now has a second offer (`ai_system` — AI enquiry/booking/automation
systems, see `src/lib/opportunity/`) alongside the website pitch, but all existing SEO
positions Runvax as "for web *designers* finding no-website businesses". Three high-intent
spaces the product serves have zero coverage:

1. **"AI for client acquisition"** — the emerging category head term.
2. **AI agent / automation-agency owners looking for clients** — rising query, thin SERPs.
3. **Web *developers*** (broader deliverable than designers) building a pipeline.

**Research findings (live web search, 2026-09-01):**
- "AI client acquisition tools" results are dominated by SyncGTM (~$99/mo), Clay ($149+/mo),
  Apollo ($49/mo), ZoomInfo — all **list-enrichment / enterprise B2B**, no local-SMB or
  no-website angle. Positioning gap: *"they enrich a list you bring; Runvax builds the list
  and detects the gap."*
- AI-automation-agency client acquisition: LinkedIn outbound → first meeting 1–2 weeks
  (15–25 msgs/day); cold email → first reply 3–4 weeks; partnerships 4–8 weeks to establish.
  "We do AI automation" as a tagline is invisible — buyers act on a **named operational pain**.
  Fastest-ROI verticals: e-commerce ops, B2B SaaS sales ops, HR/recruitment, support;
  local services (dental, legal, real estate, hospitality) are slower per deal but far less
  contested.

### Landing pages (hand-coded routes, `/vs-apollo` pattern — in `src/app/`, sitemap, JSON-LD)

| Route | Primary kw | Type |
|---|---|---|
| `/ai-for-client-acquisition` | "AI for client acquisition" | Category-definition + FAQPage |
| `/for-ai-agent-builders` | "find clients for AI automation agency" | Audience + FAQPage |
| `/for-web-developers` | "how web developers find clients" | Audience + FAQPage |
| `/vs-clay` | "Clay alternative" | Comparison + FAQPage |

Cross-linked to each other and from `/vs-apollo`, `/vs-fiverr`, `/vs-upwork` (Related line).

### PILLAR M — AI Client Acquisition for Builders & Developers (12 posts)

All 12 dated 2026-09-01 (honest publish date — this batch was written together; do NOT
back/forward-date to fake an organic cadence). Chain-interlink siblings, all link the HUB,
1 cross-pillar link each into Pillar A/B/F/L hubs. Money-page CTAs use absolute
`https://runvax.com/<page>`.

**Deploy guidance:** drip the 12 posts + 4 pages out over 2–3 weeks via staged deploys
(real cadence, not fake dates). Do not publish all 16 URLs in one push.

1. **HUB** `ai-for-client-acquisition-guide` — "AI for Client Acquisition: The Complete 2026 Guide" — *AI for client acquisition*
2. `how-ai-automation-agencies-find-clients` — *how to find clients for AI automation agency*
3. `how-to-find-clients-for-an-ai-agent-business` — *clients for AI agent business*
4. `finding-businesses-that-need-ai-automation` — *businesses that need AI automation*
5. `lead-generation-for-ai-agencies` — *lead generation for AI agency*
6. `best-ai-client-acquisition-tools-2026` — *best AI client acquisition tools* (Clay/Apollo/SyncGTM/Runvax, honestly placed)
7. `how-web-developers-find-clients-2026` — *how do web developers find clients*
8. `cold-outreach-for-ai-automation-agencies` — *cold outreach AI automation agency* (scripts + cadence)
9. `where-to-find-ai-automation-clients` — *where to find AI automation clients* (11 sources ranked)
10. `signals-a-local-business-needs-an-ai-agent` — *signs a business needs AI automation* (grounded in `src/lib/opportunity/signals.ts`)
11. `ai-agency-client-acquisition-playbook` — *AI agency client acquisition* (weekly system)
12. `web-developer-vs-web-designer-finding-clients` — *web developer vs web designer clients* (bridge into Pillar C)

Deliberately does NOT overlap existing `how-to-find-clients-for-ai-services`,
`building-an-ai-services-agency-from-scratch`,
`how-to-pitch-ai-powered-services-to-skeptical-business-owners` — links to them instead.

### Infra changes shipped with this phase
- `src/lib/seo.ts` — `SITE_DESCRIPTION` rewritten to lead with "AI for client acquisition"
  and name the three offers (website / booking / AI automation). 160 chars.
- `src/app/layout.tsx` — 4 head terms added to `keywords` (the meta tag is a non-signal
  for Google; kept minimal deliberately — do not stuff this array further).
- `src/app/sitemap.ts` — 4 new routes added.
- `src/app/llms.txt/route.ts` — intro, "Who Uses Runvax", "Why Runvax vs", "Key Pages",
  "Blog & Content Library" (12th topic area), "Common Questions" all expanded; count 190+.
- `content/blog/ai-tools-for-lead-generation-2026.mdx` + `how-to-make-money-with-ai-skills-2026.mdx`
  — one contextual link each into the new HUB.

**Phase 5 total: 12 new posts + 4 landing pages.**

---

## PHASE 6 — Technical SEO Layer (2026-09-27 addition)

Rationale: Phases 1-5 covered topical authority (content). They did not cover technical
health — crawlability, indexation, canonical correctness, structured data, internal-link
graph integrity, Core Web Vitals, or AI-crawler discoverability. A site can have excellent
content and still lose visibility to orphaned pages, broken canonicals, or crawl waste.
This phase adds that layer as a **standing audit checklist**, run whenever new content
ships or on request — not a one-time pass.

### The 22-agent conceptual framework (how to think about technical SEO here)

Organize technical SEO checks into named responsibilities, mapped to a single closed loop:
`DETECT → PRIORITIZE → EXECUTE → VALIDATE → VERIFY → MONITOR`. The "agents" are checklists,
not separate running processes — one session runs through them:

1. **Crawlability/Indexability** — robots.txt syntax, sitemap validity, accidental noindex/nofollow, redirect chains, 404/5xx.
2. **Sitemap** — `src/app/sitemap.ts` stays in sync with actual indexable routes; split into multiple sitemaps only once volume justifies it (not yet — 190ish URLs is fine as one).
3. **Robots.txt** — never let an automated change block production without a human check first. Any robots.txt edit is a P0-risk change requiring explicit confirmation before deploy.
4. **Canonical** — every indexable page self-canonicalizes; canonical target must resolve 200, not redirect/404/noindex.
5. **Metadata** — no missing/duplicate titles or descriptions; titles describe search intent, not generic labels ("Home | Runvax").
6. **Heading structure** — semantic clarity over rigid one-H1 rules; check for skipped hierarchy or keyword-stuffed headings.
7. **Internal Link Execution / Orphan Pages** — the highest-value recurring check. Every new post must (a) receive links from 2-3 topically related existing posts and (b) link out to the hub + siblings. Run the orphan check (comm of referenced vs. actual slugs) after every content batch.
8. **Schema/Structured Data** — Organization/WebSite on layout, Article/BlogPosting on posts, FAQPage only where genuine FAQs exist, BreadcrumbList where useful. Never fabricate ratings, reviews, or authorship.
9. **JS rendering** — Next.js SSG/SSR pages are crawler-safe by default; spot-check only if a page moves to client-only rendering.
10. **Core Web Vitals/Performance** — `next.config.js` already has avif/webp, compression, image caching. Don't chase a perfect score; prioritize real UX regressions.
11. **Mobile parity** — content/metadata/schema must match desktop; nothing hidden mobile-only.
12. **Image SEO** — descriptive filenames/alt text, modern formats, no oversized images.
13. **API/app health** — dynamic routes (`/demo/[slug]`, `/blog/[slug]`) must not 500 or silently return empty on bad params.
14. **Status codes** — classify by severity: important page 5xx = critical, important page 404 = high, redirect chain = medium, old redirect = low. Not every 404 is an emergency.
15. **Duplicate content** — near-identical programmatic pages (city/industry pages) need genuinely unique data per page, not templated filler.
16. **AI crawler discoverability** — `robots.txt` already allows GPTBot/ClaudeBot/PerplexityBot/etc.; `llms.txt` is the AI-facing summary — keep it current with new pillars.

Priority tiers for any finding: 🔴 Critical (site down, important page 5xx, robots blocking prod, sitemap broken, sitewide noindex) → 🟠 High (important page unindexed, canonical errors, broken internal links, major duplicate content) → 🟡 Medium (missing metadata, weak internal linking, image optimization) → 🟢 Low (minor metadata polish, image naming).

### 2026-09-27 audit results (first run)

Checked: robots.txt, sitemap.ts coverage, metadataBase/canonical setup, noindex occurrences,
JSON-LD coverage (15 pages), duplicate titles/descriptions (187 posts), missing frontmatter,
internal link graph (848 blog-to-blog links + landing-page links).

**Clean:** robots.txt, sitemap coverage, canonical setup, zero accidental noindex, schema
coverage, zero duplicate metadata, zero broken internal links.

**Found (🟠 High): 11 orphan pages** — zero inbound internal links despite being indexed via
sitemap, including two load-bearing hub pages (`freelance-web-designer-nigeria-guide`,
`how-to-get-web-design-clients-uk`). Full list was: `ai-tools-for-web-designers-nigeria-2026`,
`b2b-lead-generation-strategies-2026`, `build-websites-with-ai-nigeria`,
`cold-email-templates-web-designers-2025`, `cold-outreach-for-web-designers-what-works-2026`,
`freelance-web-designer-nigeria-guide`, `how-to-find-web-design-clients-in-ghana`,
`how-to-find-web-design-clients-in-kenya`, `how-to-find-web-design-clients-in-nigeria`,
`how-to-get-web-design-clients-uk`, `web-design-course-nigeria-2026`.

**Fixed same session:** added contextual backlinks from topically-related existing posts
(city guides → country hub, hub → AI-tools/course sub-pages, cold-outreach hub → its two
missing sub-guides, `lead-generation-for-agencies` → the B2B post, London/Manchester →
UK hub). Verified zero orphans and zero broken links remain; `npm run build` passed (187
posts, all routes).

**Not testable without live infra** (no GSC/crawler access in this environment): actual
indexation counts, Core Web Vitals field data, rendered-vs-raw-HTML diffs, AI-visibility
question-set tracking. Re-run this checklist manually until those integrations exist.

### 2026-09-27 content-depth finding (thin-content check) — PILLAR M

The thin-content check surfaced a pillar-wide quality problem, not a per-post one. Site word-count
distribution across 187 posts: min 578, p10 899, **median 1100**, p90 1238, max 1598. **11 of the 12
PILLAR M (Phase 5) posts sat below the site p10** — the newest and most commercially important pillar
was also the thinnest content on the site, targeting the hardest SERPs (Clay/Apollo/SyncGTM et al.).

Diagnosis: the Phase 5 batch is **table-shaped**. Structure, answer-first openers and interlinking are
all good (keep them), but the tables carry the substance and the prose around them doesn't deliver
enough for a reader to act. Several titles under-delivered on their own promise — "11 Sources, Ranked"
gave depth on 3 of 11; the playbook's five "fixed decisions" got one line each.

Deepened this session (3 of 4 sub-600w posts), all verified against real sources — no invented stats:
- `signals-a-local-business-needs-an-ai-agent` 578 → 1422w. Grounded in the actual product code as
  Phase 5 intended but never did: the strength-gate-before-opportunity-gate rule and the
  "dormant business looks like a perfect opportunity" trap (`src/lib/opportunity/rank.ts`), the
  fact-vs-interpretation/evidence-string discipline, the five review-friction complaint clusters, and
  the `info_gap` → **website not agent** fork (`src/lib/opportunity/signals.ts`). This is genuine
  first-party E-E-A-T material competitors structurally cannot copy — **prefer this source for future
  PILLAR M depth over generic research.**
- `where-to-find-ai-automation-clients` 594 → 1216w. Added a "time to first result" column and
  mechanics for sources 4–7, using the Phase 5 recorded research (LinkedIn 1–2 wks to first meeting at
  15–25/day; cold email 3–4 wks to first reply; partnerships 4–8 wks to establish; named-operational-pain
  positioning; fast-ROI vs less-contested verticals).
- `ai-agency-client-acquisition-playbook` 599 → 1468w. Added the pain-sentence formula
  (event + consequence + frequency) with per-vertical examples, the demo-first close mechanics
  (build against public info, show the handoff boundary), an eight-week ramp table explaining why
  weeks 1–2 look like failure, and per-metric diagnosis.

**Still thin — next content action** (updated 2026-09-29): `web-developer-vs-web-designer-finding-clients`
(593w), `lead-generation-for-ai-agencies` (616), `how-web-developers-find-clients-2026` (621),
`how-to-find-clients-for-an-ai-agent-business` (670), `cold-outreach-for-ai-automation-agencies` (746),
`how-ai-automation-agencies-find-clients` (837). Done: `signals-…` (1422), `where-to-find-…` (1216),
`ai-agency-…-playbook` (1468), `best-ai-client-acquisition-tools-2026` (1229),
`finding-businesses-that-need-ai-automation` (1249).

**Process rule going forward:** deepening the newest commercial pillar beats publishing post #188.
Per the role spec — one article that answers the question better than ten generic ones. Add the
word-count distribution check to every content-batch QA pass.

### 2026-09-29 — citation-freshness finding (NEW standing check)

Deepening `best-ai-client-acquisition-tools-2026` surfaced a problem class the technical checklist
did not cover: **posts making factual claims about third parties go stale silently, and a comparison
page is the worst place for that.** Every competitor entry price in that post was wrong:

| Claimed | Actual (verified 2026-09-29) |
|---|---|
| Clay ~$149/mo | Starter $149 was **retired for new customers in the March 2026 pricing change** — legacy only. Paid now starts ~$167–185/mo depending on billing term; free tier exists. |
| Apollo $49/mo | ~$49–59 **per user** per month (annual vs monthly). Per-seat, which the table never flagged. Free-forever Starter tier exists. |
| SyncGTM ~$99/mo | $99 is the Growth tier, not entry. Entry is ~$44–49/mo. **No** free plan (trial only). |

Note the Clay figure was already stale when Phase 5 recorded it on 2026-09-01 — the change predated
that research by six months. So this is a sourcing-rigour failure, not just decay.

**Rules adopted:**
- Verify third-party facts against the **vendor's own page**, not competitor blogs — "Clay alternative"
  content has an obvious incentive to misstate Clay's pricing.
- Where a vendor page renders prices client-side (Apollo does), say so and mark those figures
  approximate rather than implying primary verification. Never cite a URL not actually fetched.
- Carry a visible "checked <date>" line plus source links on any post quoting third-party prices.
- Re-verify comparison posts quarterly. Currently in scope: `best-ai-client-acquisition-tools-2026`,
  `/vs-clay`, `/vs-apollo`, `/vs-fiverr`, `/vs-upwork`, `lead-generation-tools-comparison-2026`,
  `apollo-io-alternatives`, `hunter-io-alternatives`, `snov-io-vs-hunter-vs-runvax-comparison`,
  `best-cold-email-tools-2026`, `best-lead-generation-tools-2026`.

**The same stale figures were on the money pages, including inside structured data.** A sweep found
`/vs-clay` repeating the retired Clay pricing twice — once in the comparison table and once in an
**FAQPage JSON-LD answer**, which is the copy Google may surface directly as a rich result. Misstating
a named competitor's price inside schema markup is the worst version of this problem. Both fixed, plus
`/vs-apollo`, which quoted Apollo's range without flagging that it is **per seat** — materially
understating cost for any team above one person. A repo-wide grep now shows no retired Clay tiers left.
**Whenever a price is corrected in a post, grep the landing pages and JSON-LD for the same number.**

Also added to that post: a "**When Runvax Is the Wrong Choice**" section. A comparison that never says
this reads as an advert; naming the four cases where a competitor is the right answer is both honest
and better for lead quality.

**Shipped (was deferred):** the `updated` frontmatter field now exists — `src/lib/blog.ts`
(`updated?: string`), Article `dateModified`, OpenGraph `modifiedTime`, sitemap `lastModified`, and a
visible "Updated <date>" line on the post. **Deliberately excluded from `getAllPosts()` ordering** so a
refreshed post cannot jump the blog index. Publish dates are never bumped to fake freshness — set
`updated` instead, and only for a substantive revision.

### 2026-09-30 — 🔴 CRITICAL: `public/llms.txt` was shadowing the dynamic route

The single worst finding of the Phase 6 audit, and it had been live since Phase 5.

`public/llms.txt` (committed 2026-07-04, 5.3KB) and `src/app/llms.txt/route.ts` (9.4KB, expanded in
Phase 5) both claimed `/llms.txt`. **In Next.js, static files in `public/` are served ahead of an App
Router route at the same path** — so the stale July file won. Verified empirically against a production
server, not assumed:

```
GET /llms.txt  →  "# ProspectAI"
ProspectAI: 13 hits   Runvax: 0 hits
```

The live site was describing itself to every AI crawler under **the pre-rename product name**, with the
old "lead generation for web designers" positioning. Every llms.txt change Phase 5 made — the rewritten
intro, "Who Uses Runvax", "Why Runvax vs", "Key Pages", "Blog & Content Library", "Common Questions",
the 190+ post count — **was never served to anyone.** llms.txt is the one file AI answer engines read
to learn what the product is, so this silently undercut the entire GEO effort while every other check
(robots, sitemap, schema, canonicals) passed clean.

Fixed by `git rm public/llms.txt` so the maintained route serves. Re-verified: `# Runvax`, 25 Runvax
hits, 0 ProspectAI. Recoverable from commit `c99a06a` if ever needed.

**Why no earlier check caught it:** every check to that point read the *repo*, and in the repo both
files look correct in isolation. Nothing compared them for URL collision, and nothing fetched the
served bytes.

**Rules adopted:**
- **Fetch the served bytes for critical text endpoints** — `/llms.txt`, `/robots.txt`, `/sitemap.xml` —
  against a real server. Reading the source file is not verification.
- Grep `public/` against `src/app/` route names on every audit; a shadow is silent and total.
- Grep the repo for pre-rename strings (`ProspectAI`) after any rebrand — one survived 3 months.

**Left alone, flagged:** `public/logo-preview.html` is an unreferenced dev artifact, publicly crawlable
at `/logo-preview.html` and not blocked by robots.txt — thin indexable junk. Low priority; deleting it
is a judgement call for whoever made it.

### How to re-run this audit
```
# orphan/broken-link check
ls content/blog/*.mdx | xargs -n1 basename | sed 's/\.mdx$//' | sort > actual_slugs.txt
{ grep -rhoE '/blog/[a-z0-9-]+' content/blog/*.mdx; grep -rhoE '/blog/[a-z0-9-]+' src/app --include="*.tsx" -r; } \
  | sed 's#/blog/##' | sort -u > referenced_slugs.txt
comm -23 referenced_slugs.txt actual_slugs.txt   # broken links (should be empty)
comm -23 actual_slugs.txt referenced_slugs.txt   # orphans (should be empty)

# duplicate metadata check
grep -h '^title:' content/blog/*.mdx | sort | uniq -d
grep -h '^description:' content/blog/*.mdx | sort | uniq -d
```
Run after every content batch, before considering it "shipped."
