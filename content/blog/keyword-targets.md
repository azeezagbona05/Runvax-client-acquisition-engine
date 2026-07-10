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

## Post-launch checklist (after all agents finish)

1. Verify no duplicate slugs, all frontmatter parses.
2. `npm run build` to confirm MDX compiles and sitemap picks up every post.
3. Spot-check interlinks resolve to real slugs (no 404s).
4. Submit updated sitemap.xml to Google Search Console once deployed.
5. Update `llms.txt` to reflect the expanded content scope for AI answer engines.
