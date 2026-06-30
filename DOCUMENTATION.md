# ProspectAI — Product Documentation

> **Find businesses that need a website. Pitch them with AI. Win them as clients.**
> An AI-powered prospecting, outreach, and CRM platform for web designers, freelancers, and digital agencies.

*Operated by BeamAI · Built for Nigeria & emerging markets, now expanding to the US, UK & Canada.*

---

## 1. The Problem

Millions of real, operating local businesses — salons, clinics, law firms, real-estate agencies, restaurants, schools — have **no website** or only a weak social-media presence. They are losing customers to competitors who *are* online.

At the same time, there's a huge population of **web designers, freelancers, and small agencies** who can build those websites — but they struggle with the hardest part of the business: **finding qualified clients and convincing them to buy.**

The typical freelancer's day looks like this:
- Manually scrolling Google Maps looking for businesses without websites.
- Guessing which ones are worth contacting.
- Writing cold messages from scratch, one at a time.
- Having no system to track who they contacted, who replied, or who to follow up with.
- No idea what to charge, or how to handle "I already have Instagram."

It's slow, unstructured, demoralising, and most give up before they close a deal.

## 2. The Solution

**ProspectAI turns that entire manual grind into a guided, AI-assisted workflow** — a single tool that takes a freelancer from *"I need clients"* to *"I just closed a deal."*

It does three things end-to-end:

1. **Find** — Surface real local businesses that have no website (or a weak one), scored and price-estimated, in any industry and any city.
2. **Pitch** — Generate tailored cold outreach, proposals, website-weakness reports, and digital-presence audits with AI — in seconds, in the right tone, with local context.
3. **Win** — Track every prospect through a sales pipeline, automate follow-ups, log conversations, and measure conversion — so deals don't slip through the cracks.

### Why it's built this way
Generic lead tools (Apollo, ZoomInfo, BuiltWith) are built for US enterprise sales and ignore the realities of local-business selling in emerging markets: WhatsApp-first communication, local currencies, local pricing, and the specific objections ("I have Facebook already") that local SMBs raise. ProspectAI is **purpose-built for the person selling websites to local businesses** — the whole loop, in one place.

## 3. Who It's For

- **Freelance web designers** looking for a steady stream of qualified leads.
- **Small digital agencies** that want a repeatable client-acquisition system.
- **Side-hustlers** entering web design who need structure and confidence.
- Anyone selling **websites, digital presence, or online-growth services** to local businesses.

## 4. How It Works — The Core Loop

```
   SEARCH                 QUALIFY                PITCH                  CLOSE
┌────────────┐        ┌────────────┐        ┌────────────┐        ┌────────────┐
│ Industry + │  ──▶   │ Lead score │  ──▶   │ AI cold    │  ──▶   │ Pipeline + │
│ city/area  │        │ + price    │        │ message,   │        │ follow-ups │
│ on Google  │        │ estimate + │        │ proposal,  │        │ + convo log│
│ Maps       │        │ no-website │        │ audit      │        │ + dashboard│
└────────────┘        │ detection  │        └────────────┘        └────────────┘
                      └────────────┘
```

---

## 5. Complete Feature List

### 5.1 Prospect Discovery

- **Industry + location search** powered by the Google Places API — search any business type ("Beauty Salons", "Law Firms", "Real Estate") in any city or area.
- **Multi-country support:** Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon — plus **United States, United Kingdom, Canada**.
- **Curated, tiered area suggestions** per country, classified as **🏆 High-ticket / 💼 Mid-range / 💰 Budget**, each with realistic local-currency price ranges (e.g. Ikoyi Lagos ₦800k–₦3M; Mayfair London £6k–£25k; Manhattan $8k–$30k). Dozens of pre-loaded neighborhoods across Lagos, Abuja, Accra, Nairobi, New York, London, Toronto and more — or type any custom area.
- **GPS "near me" search** using the browser's geolocation.
- **"No Website" detection** — instantly flags businesses with no website (the hottest prospects) and separates social-only presences.
- **Smart industry quick-picks** and **recent-search history** (the last 5) for one-tap repeat searches.
- **"Best time to send" indicator** — shows whether it's a good moment to reach out, computed in the **selected country's local timezone** (green = great, amber = decent, red = low response time, with an alerting animation).
- **Market Intelligence Brief** — an AI-generated daily market snapshot (opportunities, pricing realities, best industries) for the chosen market.
- **Guest mode** — visitors get one free preview search before signing up.

### 5.2 Lead Intelligence & Qualification

- **AI Lead Score (0–10)** computed from: no-website status (biggest factor), Google rating, review count, presence of phone/email, operating status, category value, and incomplete listings. Labelled **🔥 Hot / ✅ Good / 👀 Warm / 🔵 Cold**.
- **Automatic price estimation** — suggests a website project price range based on the business's industry (e.g. real estate ₦500k–₦1.5M, salons ₦150k–₦250k), so users know what to quote.
- **Rich business detail drawer** — address, phone (national + international), website status, Google rating & review count, real customer reviews, opening hours, category, and a "What they're missing without a website" breakdown.
- **Competitor detection** — finds nearby businesses in the same category that *do* have websites (social proof for the pitch).
- **Powerful filters & sorting:** No-Website only, New (unsaved), Phone-only (WhatsApp-ready), Reviewed-only, and "Hot first" sorting by score. A pinned **"Hottest Leads"** strip surfaces score-8+ prospects.
- **Email enrichment & verification** — attempts to find and validate a business email.

### 5.3 AI Outreach Suite

All generation is powered by OpenAI models with **local market context** (naira pricing, WhatsApp CTAs, cultural relevance, and the specific objections local SMBs raise).

- **Cold Outreach Messages in 8 proven copywriting frameworks:** PAS, AIDA, Hook-Story-Offer (HSO), SPIN, 4Ps, FAB, BAB, and Story — pick the angle that fits the prospect.
- **AI Reply Assistant** — generates the right response to common situations: interested, asked-for-price, and objection handling ("I have Instagram", "we get customers by referral", "too expensive", "no time"), plus follow-ups for non-responders.
- **Full Project Proposals** — a polished one-page proposal with scope and pricing, ready to send.
- **Website Weakness Report** — an AI analysis of what's wrong with a prospect's existing site (when they have one).
- **Digital Presence Audit** — a shareable audit showing exactly what the business is missing online.
- **Lovable.dev build prompts** — generates a detailed website-build brief (React + Tailwind) so the designer can spin up the actual site fast.
- **Demo Website Preview** *(built, currently hidden behind a feature flag)* — generates a complete, live one-page website from the prospect's own Google data (name, reviews, hours, map) for a "here's your website" pitch. Parked pending a decision on positioning.

### 5.4 Outreach Execution

- **One-click WhatsApp outreach** — opens WhatsApp (app on mobile, Web on desktop) with a pre-written, personalised message. No WhatsApp Business API approval required.
- **Quick-Fire Mode** — rapidly send WhatsApp messages to many no-website prospects one after another (built for momentum).
- **Bulk WhatsApp Outreach** — select multiple prospects on the pipeline, then work through them in a queue or open-all-tabs flow, auto-marking each as contacted.
- **Bulk Email Blast** — email no-website / social-only prospects in batch.
- **Email sending via SMTP** — send through the user's own SMTP (custom from-address) with a platform fallback; includes an SMTP test tool.

### 5.5 CRM & Sales Pipeline

- **Kanban pipeline** with drag-and-drop across stages: **Found → Contacted → Interested → Proposal → Won / Lost**.
- **Conversation log** — every sent message and reply is recorded per prospect, with channel and framework used.
- **Follow-up sequences** — a structured 3-step drip (Day 1 / Day 3 / Day 7 across WhatsApp + email) with due-today and overdue tracking.
- **Notes & reminders** per prospect, with browser notifications when a follow-up is due.
- **"Due today" badges** on the pipeline and a **notifications bell** in the top bar that counts pending follow-ups.
- **CSV export** of the full pipeline (name, category, contact, stage, score, estimated value, notes, dates).
- **Manual prospect entry** — add a business that wasn't found via search.

### 5.6 Dashboard & Analytics

- **Headline stats:** total prospects, hot leads, won deals (with value), active pipeline value.
- **Pipeline funnel breakdown** by stage with counts and value.
- **Daily outreach tracker** — set a daily goal, log outreach, and build a **streak**.
- **Revenue projection** — projects monthly revenue from contacts × close-rate × average deal value (all configurable).
- **Best-performing industries** — ranks industries by no-website hit rate from the user's own search history.
- **Outreach queue** — surfaces unsent, high-score, phone-ready prospects to contact next.
- **Upcoming follow-ups** list with overdue highlighting.

### 5.7 Accounts, Plans & Billing

- **Email/password auth** (NextAuth, JWT sessions) with **email verification**, **forgot/reset password**, and resend-verification.
- **Three plans** — Free, Pro, Agency (details below), enforced via daily quotas on searches and AI calls and a cap on saved prospects.
- **Paystack billing** — initialize, verify, and webhook-driven subscription management.
- **Searches-left quota** shown live in the top bar.
- **Settings** — Profile (name, agency, WhatsApp, reply email, city, tagline used in proposals & signatures), Email & SMTP config, Bank & Payment details, and Goals (daily goal, average deal value, close rate).
- **Onboarding wizard** for new users.

### 5.8 Admin Panel

- **Admin dashboard** with total users, revenue, and recent payments.
- **User management** (view/edit users and plans).
- **Dynamic plan configuration** — create, edit, and delete plans (limits, pricing) from the admin UI, backed by the database.

### 5.9 Platform & UX

- **Collapsible desktop sidebar** (Search, Pipeline, Dashboard, Settings, Add Prospect, pipeline stats widget) with persistent collapsed state.
- **Desktop top bar** — searches-left quota, follow-up notifications, profile avatar; Log in / Sign up for guests.
- **Light & dark themes** — **light is the default**, fully themed across the app, with the sidebar kept permanently dark for contrast. Carefully tuned for readability.
- **Mobile-first responsive design** with a bottom tab bar and native-app feel; installable as a **PWA** ("Add to Home Screen").
- **Subtle animated backgrounds** and polished micro-interactions.

---

## 6. Plans & Pricing

| | **Free** | **Pro — ₦9,999/mo** | **Agency — ₦24,999/mo** |
|---|---|---|---|
| Searches / day | 5 | 20 | Unlimited |
| Results / search | 20 | 60 (20 at a time, paginated) | Unlimited |
| AI generations / day | 15 | 200 | Unlimited |
| Saved prospects | 30 | Unlimited | Unlimited |
| Pipeline, AI outreach, dashboard | ✓ | ✓ | ✓ |

*Plan limits are configurable from the admin panel.*

---

## 7. Technology & Architecture

- **Framework:** Next.js 14 (App Router), React 18, TypeScript.
- **Styling:** Tailwind CSS, Lucide icons.
- **Auth:** NextAuth v4 (JWT strategy) + Prisma adapter; bcrypt password hashing.
- **Database:** MySQL via Prisma ORM.
- **AI:** OpenAI (`gpt-4o` for outreach/proposals/audits/briefs; `gpt-4o-mini` for the demo generator). Anthropic SDK also available.
- **Data source:** Google Places API (search + place details + photos/reviews/hours).
- **Email:** Nodemailer (user SMTP with platform fallback).
- **Payments:** Paystack (init / verify / webhook).
- **Quotas:** per-user daily usage records enforced server-side.

### Key data models
`User`, `Prospect` (with stage, notes, reminders, follow-up sequence), `Conversation`, `UserSettings`, `DailyLog`, `UsageRecord`, `Payment`, `SearchHistory`, `PlanConfig`, `DemoSite`, plus auth tables (Account, Session, verification & reset tokens).

---

## 8. What Makes It Stand Out (The Moat)

ProspectAI isn't "another AI writer." Its defensibility compounds:

1. **The full loop in one tool** — find → qualify → pitch → close. Competitors do one slice; ProspectAI owns the whole freelancer workflow.
2. **Emerging-markets first** — WhatsApp-native outreach, local currencies, local pricing intelligence, tiered neighborhoods, and objection handling tuned to local SMBs. Western tools ignore this enormous, underserved market.
3. **A proprietary conversion dataset (in the making)** — every search, outcome, price band, and reply is logged. Over time this becomes data no competitor has: *which businesses convert, at what price, with which message, at what time, by industry and area.*
4. **Built-in distribution** — shareable audits and demo previews carry the brand, creating a viral loop.
5. **Outcome-oriented expansion path** — from "find website prospects" toward an autonomous agent and a full local-business growth OS (Google Business optimization, reviews, ads, booking) — multiplying the TAM.

---

## 9. The Pitch (Summary)

**Elevator pitch:**
> ProspectAI is the all-in-one platform that helps web designers and agencies find local businesses that need a website, pitch them with AI, and close them — purpose-built for WhatsApp-first, emerging markets that global sales tools ignore.

**The problem:** Millions of local businesses have no website; thousands of freelancers can build them but can't find or close clients. The middle is broken.

**The solution:** One guided workflow — AI-scored prospect discovery, AI outreach in proven frameworks, and a follow-up CRM — that turns a freelancer's hustle into a repeatable client-acquisition machine.

**The market:** Every un-digitized local business in Africa, then Asia and LatAm, then the West (US/UK/Canada already supported) — the digitization of the next billion small businesses.

**Why now / why us:** AI makes personalised outreach instant and cheap; WhatsApp makes distribution frictionless; and no incumbent is purpose-built for the local-web-designer buyer in these markets.

---

*Document generated for internal reference and pitching. Last updated: 2026.*
