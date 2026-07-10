# Runvax — Technical Documentation

> Last updated: 2026-06-30  
> Stack: Next.js 14 App Router · TypeScript · Prisma ORM · MySQL · NextAuth.js v4 · Tailwind CSS

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Database Schema](#3-database-schema)
4. [Authentication System](#4-authentication-system)
5. [API Routes Reference](#5-api-routes-reference)
6. [Page Routes Reference](#6-page-routes-reference)
7. [Core Library Modules](#7-core-library-modules)
8. [Components Reference](#8-components-reference)
9. [Plans & Usage System](#9-plans--usage-system)
10. [Payment Integration (Paystack)](#10-payment-integration-paystack)
11. [WhatsApp Business API](#11-whatsapp-business-api)
12. [Google Places Integration](#12-google-places-integration)
13. [AI Integration](#13-ai-integration)
14. [Email System](#14-email-system)
15. [Rate Limiting](#15-rate-limiting)
16. [Admin System](#16-admin-system)
17. [Cron Jobs](#17-cron-jobs)
18. [Security](#18-security)
19. [Error Monitoring (Sentry)](#19-error-monitoring-sentry)
20. [Database Backup & Restore](#20-database-backup--restore)
21. [Deployment](#21-deployment)
22. [Blog & SEO System](#22-blog--seo-system)

---

## 1. Architecture Overview

Runvax is a full-stack B2B SaaS application built on **Next.js 14 App Router**. Every API route is a Next.js Route Handler (`route.ts`) co-located alongside pages in the `src/app/` directory.

```
src/
├── app/                    # All pages + API routes (App Router)
│   ├── api/                # Route handlers
│   ├── auth/               # Auth pages
│   ├── admin/              # Admin dashboard
│   ├── dashboard/          # Analytics dashboard
│   ├── pipeline/           # Prospect pipeline
│   ├── settings/           # Account settings
│   └── blog/               # MDX blog
├── components/             # Shared React components
├── lib/                    # Business logic utilities
├── types/                  # TypeScript type definitions
└── middleware.ts            # Edge-level route protection
```

**Key design decisions:**

- **Server Components by default** — pages fetch data on the server; client interactivity is `'use client'` islands
- **JWT sessions** — NextAuth uses JWT strategy; `isAdmin` flag is embedded in the token itself, checked at edge by middleware
- **Dark mode** — Tailwind `darkMode: 'class'`, toggled via `html.dark` class; admin page forces dark mode unconditionally
- **AI providers** — Both Anthropic Claude and OpenAI GPT-4o are available; routes choose based on task type
- **Africa-first** — Naira (₦) denomination, WhatsApp-centric outreach, Nigerian/West African geo-data

---

## 2. Environment Variables

All variables in `.env.example`. Copy to `.env.local` for local development.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string: `mysql://USER:PASS@HOST:3306/DBNAME` |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full origin URL (e.g. `https://yourapp.com`) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical URL for sitemap, OG tags, canonical links |
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API (New) — business search |
| `OPENAI_API_KEY` | Yes | OpenAI GPT-4o for outreach generation, proposals, briefs |
| `SMTP_HOST` | Yes | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | Yes | SMTP port (587 for STARTTLS) |
| `SMTP_USER` | Yes | SMTP login username |
| `SMTP_PASS` | Yes | SMTP password or app password |
| `SMTP_FROM` | Yes | From address for platform emails |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret key for server-side API calls + webhook verification |
| `PAYSTACK_PUBLIC_KEY` | Yes | Paystack public key (exposed to client via `/api/plans`) |
| `PAYSTACK_PRO_PLAN_CODE` | Yes | Plan code from Paystack dashboard for Pro tier |
| `PAYSTACK_AGENCY_PLAN_CODE` | Yes | Plan code from Paystack dashboard for Agency tier |
| `ADMIN_EMAILS` | Yes | Comma-separated emails with admin access: `a@b.com,c@d.com` |
| `CRON_SECRET` | Yes | Token for Vercel Cron Authorization header. Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Sentry DSN for error tracking |
| `SENTRY_ORG` | Recommended | Sentry organization slug (for source map upload) |
| `SENTRY_PROJECT` | Recommended | Sentry project name |
| `SENTRY_AUTH_TOKEN` | Recommended | Sentry auth token (only needed for source map upload at build time) |
| `GOOGLE_CSE_ID` | Optional | Google Custom Search Engine ID (email discovery, currently dormant) |
| `GOOGLE_CSE_KEY` | Optional | Google Custom Search API key |
| `BRAVE_SEARCH_KEY` | Optional | Brave Search API for web-wide email discovery |
| `GEMINI_API_KEY` | Optional | Google Gemini API — enables Gemini as an alternative AI provider. Market Briefs can use Gemini's live Search grounding when `AI_PROVIDER_BRIEF=gemini` is set |
| `AI_PROVIDER_DEFAULT` | Optional | Set to `"gemini"` to use Gemini globally instead of OpenAI |
| `AI_PROVIDER_BRIEF` | Optional | Set to `"gemini"` to use Gemini with live Search grounding for market briefs only |

---

## 3. Database Schema

**ORM:** Prisma 5. **Engine:** MySQL 8.  
Schema file: `prisma/schema.prisma`

### Users & Auth

#### `User`
Core user record.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `email` | String? | Unique, nullable for OAuth-only users |
| `password` | String? | bcrypt hash (12 rounds); null for OAuth users |
| `name` | String? | Display name |
| `image` | String? | Profile photo URL |
| `plan` | String | `"free"` \| `"pro"` \| `"agency"` |
| `emailVerified` | DateTime? | Set when email verification token is consumed |
| `paystackCustomerCode` | String? | Paystack customer code, stored after first payment |
| `paystackSubscriptionCode` | String? | Paystack subscription code, stored after `subscription.create` webhook |
| `planExpiresAt` | DateTime? | When the current paid plan expires; null for free tier |
| `searchLimitOverride` | Int? | Admin-set per-user search override; null = use plan default |
| `blockedLocations` | String? | JSON `string[]` of location keywords this user cannot search |
| `blockedCountries` | String? | JSON `string[]` of country codes blocked for this user (e.g. `["NG","GH"]`) |
| `registrationIp` | String? | IP address captured at signup |
| `lastSeenIp` | String? | IP address from most recent sign-in (fire-and-forget update) |
| `isSuspended` | Boolean | Blocks sign-in and all API access when true |
| `createdAt` | DateTime | Account creation timestamp |

#### `Account`
OAuth provider linkage (Google, GitHub).

#### `Session`
Database sessions (used alongside JWT — Prisma adapter requirement).

#### `VerificationToken`, `PasswordResetToken`, `EmailVerificationToken`
Short-lived tokens for email flows.

#### `WebAuthnCredential`
Biometric / passkey credentials (Face ID, fingerprint) linked to a user.

### Prospect Management

#### `Prospect`
A business saved to a user's pipeline.

| Field | Type | Notes |
|---|---|---|
| `id` | String | Primary key |
| `userId` | String | FK → User |
| `businessId` | String | Google Places `place_id` (unique per user) |
| `businessName` | String | Denormalized for fast display |
| `businessData` | Json | Full `Business` snapshot at save time |
| `stage` | String | `found` → `contacted` → `interested` → `proposal` → `won` \| `lost` |
| `score` | Int? | Lead score 0–100 from scoring algorithm |
| `estimatedPriceMin` | Int? | Lower bound of user's deal value estimate (in ₦) |
| `estimatedPriceMax` | Int? | Upper bound of user's deal value estimate (in ₦) |
| `notes` | String? | Free-text notes |
| `reminderDate` | String? | ISO date string for follow-up reminder |
| `reminderNote` | String? | Note attached to the reminder |
| `outreachSentAt` | DateTime? | Timestamp of first outreach message |
| `followUpSequence` | Json? | Array of `FollowUpStep` objects |
| `source` | String? | `"manual"` \| `"auto-prospect"` — how this prospect was added |

#### `Conversation`
A message or note attached to a prospect.

| Field | Type | Notes |
|---|---|---|
| `channel` | String | `whatsapp` \| `email` \| `call` \| `note` |
| `type` | String | `sent` \| `received` \| `ai_response` \| `note` |
| `content` | String | Message body |
| `replyType` | String? | One of 16 reply categories: `interested`, `asked_price`, `asked_examples`, `said_think_about_it`, `said_okay_thanks`, `said_send_info`, `said_call_me`, `objection_instagram`, `objection_referrals`, `objection_expensive`, `objection_no_time`, `objection_already_has_website`, `objection_who_are_you`, `not_interested`, `no_reply`, `custom` |
| `framework` | String? | Outreach framework tag |

### User Configuration

#### `UserSettings`
All per-user configuration in one row (one-to-one with User). Fields are stored as flat columns, not JSON blobs (except `rateCard` and `portfolio`).

| Field | Purpose |
|---|---|
| `dailyGoal` | Daily outreach message target (default 10) |
| `avgDealValue` | Average deal size in ₦ (default 300,000) — used for revenue projections |
| `closeRatePct` | Estimated close rate % (default 10) — used in dashboard projections |
| `senderName` | Name used in outreach messages |
| `businessName` | Web design agency name |
| `tagline` | Short pitch tagline |
| `whatsapp` | Their personal WhatsApp number |
| `replyEmail` | Email address prospects should reply to |
| `city` | City for local context in outreach |
| `jobTitle` | Role label (Freelancer, Creative Director, etc.) |
| `website` | Portfolio site URL — included in outreach and proposals |
| `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpFrom` | Custom SMTP config — overrides platform SMTP |
| `bankName`, `bankAccount`, `bankAcctName` | Bank account for proposal payment section |
| `paymentLink` | Optional payment link (Paystack storefront, Flutterwave, etc.) |
| `rateCard` | Json — packages, maintenance plans, add-ons, payment terms |
| `portfolio` | Json — array of portfolio pieces (url, description) |
| `onboardingDone` | Boolean — hides onboarding wizard once set |
| `waPhoneNumberId` | WhatsApp Business API phone number ID |
| `waAccessToken` | WhatsApp Business API access token (masked in GET response) |
| `waTemplateName` | Name of the approved WhatsApp message template |
| `wabaId` | WhatsApp Business Account ID |
| `waDisplayPhone` | Human-readable phone number for display |
| `waTemplateStatus` | Template approval status from Meta |

### Usage & Analytics

#### `DailyLog`
One row per user per date — counts outreach messages sent that day.

#### `UsageRecord`
One row per user per date — counts AI API calls, searches, and per-provider token spend for cost tracking.

| Field | Notes |
|---|---|
| `aiCalls` | Total AI generation calls today |
| `searchCount` | Total Google Places searches today |
| `openaiInputTokens` | GPT-4o prompt tokens used today |
| `openaiOutputTokens` | GPT-4o completion tokens used today |
| `geminiInputTokens` | Gemini 2.0 Flash input tokens used today |
| `geminiOutputTokens` | Gemini 2.0 Flash output tokens used today |
| `googlePlacesReqs` | Number of Google Places API requests today |

Admin cost calculation rates: GPT-4o input $2.50/M, output $10/M; Gemini $0.10/$0.40/M; Places $0.032/req.

#### `SearchHistory`
Every search query with result metadata (total businesses found, how many had no website).

### Search & Cache

#### `SearchCache`
Full Google Places search result sets, keyed by query hash. TTL: 7 days.

#### `CachedBusiness`
Individual business enrichment data (reviews, PageSpeed, website status). TTL: 90 days (lazily purged per Google Places ToS).

### Payments & Plans

#### `Payment`
Paystack payment records. Also used for webhook idempotency tracking.

| Field | Notes |
|---|---|
| `reference` | Paystack transaction reference OR idempotency key (`"${event}::${ref}"`) |
| `plan` | Plan name granted, or `"system"` for idempotency records |
| `amount` | Amount in kobo |
| `status` | `"success"` \| `"webhook_processed"` |

#### `PlanConfig`
Admin-managed plan definitions. Stored in DB; overrides hard-coded defaults from `src/lib/plans.ts`. Cached in-memory for 60 seconds to avoid per-request DB round-trips.

| Field | Notes |
|---|---|
| `planId` | `"free"` \| `"pro"` \| `"agency"` |
| `name` | Display name |
| `price` | Price string (e.g. `"₦9,999"`) |
| `priceNote` | Billing period label |
| `searchesPerDay` | Max Google Places searches per 24h (-1 = unlimited) |
| `resultsPerSearch` | Max businesses returned per search (-1 = unlimited) |
| `aiCallsPerDay` | Max AI generation requests per 24h (-1 = unlimited) |
| `maxProspects` | Max saved prospects (-1 = unlimited) |
| `features` | Comma-separated `FeatureId` values: `emailBlast,proposals,marketBrief,weaknessAnalysis` |
| `allowedLocations` | JSON `string[]` of allowed location keywords; null = all locations |
| `allowedCountries` | JSON `string[]` of allowed country codes; null = all countries |

### Other

#### `DemoSite`
Public portfolio showcase pages generated from prospects.

---

## 4. Authentication System

**Library:** NextAuth.js v4 with Prisma adapter and JWT strategy.

**Config file:** `src/lib/auth.ts`

### Sign-in Flow

1. User submits email + password to `POST /api/auth/[...nextauth]` (credentials provider)
2. `authorize()` checks: rate limit (5 attempts / email+IP / 15 min), user exists, not suspended, password matches bcrypt hash
3. On success, NextAuth creates a JWT containing: `id`, `plan`, `emailVerified`, `isAdmin`
4. `isAdmin` is computed from `ADMIN_EMAILS` env var — never stored in the database
5. Every subsequent request carries the JWT in an httpOnly cookie

### JWT Contents (after login)

```typescript
{
  id: string,          // DB user.id
  sub: string,         // same as id (NextAuth standard)
  plan: string,        // "free" | "pro" | "agency"
  emailVerified: Date | null,
  isAdmin: boolean
}
```

### Session Refresh

On every token refresh (when `emailVerified` is null in the token), the JWT callback queries the database to check if verification has since occurred. This lets the "please verify your email" banner disappear without requiring sign-out.

### Admin Auth

- **Edge middleware** (`src/middleware.ts`): Every request to `/admin/*` (except `/admin/login`) runs `getToken()` from `next-auth/jwt` at the Vercel Edge. If `token.isAdmin` is false or token is absent, request is redirected to `/admin/login`.
- **API routes**: Each `/api/admin/*` handler independently calls `getServerSession(authOptions)` and checks `session.user.isAdmin`.

### WebAuthn (Biometric Login)

- Registration: `POST /api/auth/webauthn/register`
- Authentication: `POST /api/auth/webauthn/authenticate`
- Credentials list/delete: `GET/DELETE /api/auth/webauthn/credentials`
- Library: `@simplewebauthn/server` + `@simplewebauthn/browser`
- Credentials stored in `WebAuthnCredential` table

### Password Reset Flow

1. `POST /api/auth/forgot-password` — creates `PasswordResetToken`, sends email
2. `POST /api/auth/reset-password` — validates token, updates hashed password, deletes token

### Email Verification Flow

1. On register, `EmailVerificationToken` is created and email is sent
2. `POST /api/auth/verify-email` — validates token, sets `user.emailVerified`
3. `POST /api/auth/resend-verification` — resends verification email

---

## 5. API Routes Reference

All routes live under `src/app/api/`. Auth requirements: **Public** = no session needed, **Auth** = valid JWT session, **Admin** = `isAdmin: true` in JWT.

---

### Search & Discovery

#### `POST /api/search`
**Auth:** Required  
**Purpose:** Search for local businesses using Google Places API.

**Request body:**
```json
{
  "query": "restaurants",
  "location": "Lagos, Nigeria",
  "radius": 5000,
  "country": "NG",
  "lat": 6.5244,
  "lng": 3.3792
}
```

**Behavior:**
- Checks daily search quota from `UsageRecord` (per plan limits)
- Checks 7-day `SearchCache` keyed by query hash before hitting Google Places
- Returns businesses scored 0–100 by lead scoring algorithm
- Lazily purges `CachedBusiness` records older than 90 days (Google ToS compliance)
- Saves search to `SearchHistory`

**Response:** Array of `Business` objects with score, website presence, phone, reviews.

---

#### `POST /api/details`
**Auth:** Required  
**Purpose:** Fetch enriched details for a single business (reviews, competitors, PageSpeed score, website status).

#### `POST /api/enhance`
**Auth:** Required  
**Purpose:** Enrich a business record with additional AI-generated context.

#### `POST /api/scrape-meta`
**Auth:** Required  
**Purpose:** Scrape a website URL for title, description, favicon, and OG tags.

#### `POST /api/pagespeed`
**Auth:** Required  
**Purpose:** Fetch Google PageSpeed Insights data for a given URL.

---

### Prospect Management

#### `GET /api/prospects`
**Auth:** Required  
**Purpose:** List all saved prospects for the authenticated user.

#### `POST /api/prospects`
**Auth:** Required  
**Purpose:** Save a business to the user's pipeline.

**Request body:**
```json
{
  "businessId": "ChIJ...",
  "businessSnapshot": { /* Business object */ },
  "stage": "found"
}
```

#### `GET /api/prospects/[id]`
**Auth:** Required  
**Purpose:** Get a single prospect by ID.

#### `PATCH /api/prospects/[id]`
**Auth:** Required  
**Purpose:** Update prospect fields: stage, notes, priceEstimate, reminder, followUpSequence.

#### `DELETE /api/prospects/[id]`
**Auth:** Required  
**Purpose:** Remove a prospect from the pipeline.

#### `GET /api/prospects/[id]/conversations`
**Auth:** Required  
**Purpose:** Get conversation history for a prospect.

#### `POST /api/prospects/[id]/sequence`
**Auth:** Required  
**Purpose:** Create or retrieve a follow-up sequence for a prospect. Returns an array of `FollowUpStep` objects.

#### `POST /api/prospects/auto-search`
**Auth:** Required  
**Purpose:** Automated prospecting agent — searches for businesses matching user criteria and queues them for review.

#### `GET /api/prospects/queue-count`
**Auth:** Required  
**Purpose:** Returns count of auto-prospected businesses awaiting review.

---

### AI Generation

#### `POST /api/generate`
**Auth:** Required  
**Purpose:** Generate a detailed website build prompt (what to build for this specific business).  
Uses OpenAI GPT-4o. Consumes 1 AI call from daily quota.

**Request body:** `{ businessName, category, city, website?: string }`

#### `POST /api/outreach`
**Auth:** Required  
**Purpose:** Generate outreach message (WhatsApp or email) personalized to a specific business.  
Uses the outreach engine in `src/lib/outreach/`.

**Request body:**
```json
{
  "business": { /* Business object */ },
  "channel": "whatsapp" | "email",
  "tone": "professional" | "casual",
  "senderName": "John Doe",
  "businessName": "Ace Digital"
}
```

#### `POST /api/reply`
**Auth:** Required  
**Purpose:** Generate AI reply suggestion based on a prospect's response.

#### `POST /api/reply-intelligence`
**Auth:** Required  
**Purpose:** Advanced analysis of a prospect's reply — detects sentiment, intent, objection type, and recommends next action.

#### `POST /api/proposal`
**Auth:** Required  
**Purpose:** Generate a personalized PDF proposal. Uses user's rate card, bank details, and portfolio from `UserSettings`.

#### `POST /api/proposal/send-email`
**Auth:** Required  
**Purpose:** Email a generated proposal directly to a prospect.

#### `POST /api/weakness`
**Auth:** Required  
**Purpose:** Generate a website weakness analysis report (performance gaps, UX issues, SEO problems) for a business's website.

#### `POST /api/brief`
**Auth:** Required  
**Purpose:** Generate an AI market brief for an industry + location (industry overview, client pain points, opportunity sizing).

#### `POST /api/seo-analysis`
**Auth:** Required  
**Purpose:** Full SEO audit combining PageSpeed Insights + AI analysis.

#### `POST /api/agents`
**Auth:** Required  
**Purpose:** Run a named AI agent (researcher, strategist, marketer, copywriter, builder).

#### `POST /api/seo-agents`
**Auth:** Required  
**Purpose:** Run SEO-focused analysis agents.

#### `POST /api/audit`
**Auth:** Required  
**Purpose:** Run a comprehensive website audit (full report across SEO, performance, UX).

---

### WhatsApp Business API

All routes require valid WhatsApp Business API credentials saved in `UserSettings.whatsappConfig`.

#### `POST /api/whatsapp/connect`
**Auth:** Required  
Detect WhatsApp Business phone numbers associated with a given access token.

#### `POST /api/whatsapp/test`
**Auth:** Required  
Test connection and verify credentials work.

#### `POST /api/whatsapp/create-template`
**Auth:** Required  
Create and submit an outreach message template to Meta for approval.

#### `GET /api/whatsapp/template-status`
**Auth:** Required  
Check whether a submitted template has been approved/rejected by Meta.

#### `POST /api/whatsapp/send`
**Auth:** Required  
Send a WhatsApp message via the Business API to a prospect.

---

### Payments

#### `POST /api/payments/initialize`
**Auth:** Required  
Initialize a Paystack payment session for upgrading to Pro or Agency.

**Request body:** `{ plan: "pro" | "agency" }`

**Response:** `{ authorizationUrl, reference }` — redirect user to `authorizationUrl`.

#### `GET /api/payments/verify`
**Public** (Paystack redirect target)  
After Paystack checkout, Paystack redirects to `/api/payments/verify?reference=xxx`. Verifies transaction via Paystack API and activates the plan. On success redirects to `/dashboard`; on failure redirects to `/pricing?error=...`.

#### `POST /api/payments/webhook`
**Public** (verified by HMAC-SHA512 signature)  
Paystack webhook handler. Handles `charge.success` events.

**Events handled:**
| Event | Action |
|---|---|
| `charge.success` | Activate/renew plan (+35 days); send payment confirmation email |
| `subscription.disable` | Downgrade to free; send downgrade notification email |
| `invoice.payment_failed` | Downgrade to free; send downgrade notification email |
| `subscription.create` | Store `paystackSubscriptionCode` on user for future subscription management |

**Security:**
- Validates `x-paystack-signature` header using HMAC-SHA512 with `timingSafeEqual` comparison
- Rejects if `PAYSTACK_SECRET_KEY` is unset (would otherwise compute HMAC against empty string)
- Idempotency: upserts a `Payment` record with `reference = "${event}::${ref}"` and `status = "webhook_processed"` — duplicate webhook deliveries are no-ops
- Returns HTTP 200 even on handler errors (so Paystack doesn't retry endlessly)

---

### User Settings & Profile

#### `GET /api/user/settings`
**Auth:** Required  
Returns full `UserSettings` for the authenticated user.

#### `PATCH /api/user/settings`
**Auth:** Required  
Update any field(s) in `UserSettings`. Partial update — only provided fields are changed.

#### `GET /api/user/plan`
**Auth:** Required  
Returns current plan limits and feature availability.

#### `POST /api/user/smtp-test`
**Auth:** Required  
Send a test email using the user's custom SMTP configuration.

#### `GET /api/user/usage`
**Auth:** Required  
Returns today's `UsageRecord` (searches used, AI calls used, token spend).

#### `GET /api/user/daily-log`
**Auth:** Required  
Returns the last 30 days of outreach activity from `DailyLog`.

#### `POST /api/user/daily-log`
**Auth:** Required  
Increment today's outreach counter.

#### `GET /api/user/search-history`
**Auth:** Required  
Returns the user's past search queries with hit rate stats.

---

### Admin Routes

All require `isAdmin: true` in the JWT session. Protected at both edge middleware and handler level.

#### `GET /api/admin/stats`
Returns comprehensive platform data: full user list (with prospect count, last 5 searches, IPs, plan), recent payments, revenue total, plan distribution, and per-user AI/API cost breakdown since a configurable date.

**Query params:** `?costSince=YYYY-MM-DD` — date from which to aggregate costs (defaults to today).

Cost rates applied: GPT-4o input $2.50/M tokens, output $10/M; Gemini 2.0 Flash $0.10/$0.40/M; Google Places $0.032/request.

#### `GET /api/admin/analytics`
Prospecting funnel analytics with time-range filtering. Returns: prospect conversion funnel by industry (saved → contacted → won), pipeline value, search popularity by industry and location, and top search term combinations.

**Query params:** `?range=week|month|year|all`

#### `GET /api/admin/plans`
List all `PlanConfig` records, auto-seeding defaults for built-in plans if missing from DB.

#### `POST /api/admin/plans`
Create or update a plan configuration.

#### `PATCH /api/admin/plans/[planId]`
Update an existing plan's limits or features.

#### `PATCH /api/admin/users/[id]`
Admin update for a user: change plan, set `searchLimitOverride`, set `blockedLocations`, set `blockedCountries`, toggle `isSuspended`. Setting `plan` also updates `planExpiresAt` (+35 days for paid plans, null for free).

---

### Auth Routes (NextAuth + custom)

#### `[...nextauth] — /api/auth/[...nextauth]`
Standard NextAuth handler. Handles sign-in, sign-out, session, CSRF.

#### `POST /api/auth/register`
**Public** (rate-limited: 10 registrations / IP / hour)  
Register a new user account.

**Request body:** `{ email, password, name }`

On success: creates `User`, sends verification email, returns session.

**Errors:** 400 if email taken, 429 if rate limited.

#### `POST /api/auth/verify-email`
**Public**  
Consume an email verification token.

#### `POST /api/auth/resend-verification`
**Public**  
Resend the verification email.

#### `POST /api/auth/forgot-password`
**Public**  
Request a password reset link.

#### `POST /api/auth/reset-password`
**Public**  
Reset password using a valid token.

#### `POST /api/auth/webauthn/register`
**Auth** — Register a biometric credential.

#### `POST /api/auth/webauthn/authenticate`
**Public** — Authenticate with a registered biometric credential.

#### `GET /api/auth/webauthn/credentials`
**Auth** — List registered biometric devices.

#### `DELETE /api/auth/webauthn/credentials`
**Auth** — Remove a biometric device.

---

### Cron

#### `GET /api/cron/onboarding-emails`
**Cron** (Bearer token: `CRON_SECRET`)  
Runs daily at 08:00 WAT (07:00 UTC). Sends automated onboarding emails to new users:
- Day 3: Pipeline check-in
- Day 7: Proposal prompt
- Day 14: Re-engagement

---

### Miscellaneous

#### `POST /api/demo`
**Auth** — Generate a public portfolio demo site from a prospect.

#### `POST /api/enrich-email`
**Auth** — Verify and enrich an email address.

#### `POST /api/verify-email`
**Auth** — SMTP-level email verification. Does a real DNS MX lookup + SMTP handshake (`RCPT TO`) to verify whether an email address exists, without sending an email. Returns `{ result: "valid" | "invalid" | "unknown" }`. Blocks known disposable domains. Used to pre-validate prospect email addresses before cold outreach.

#### `GET /api/plans`
**Public** — List available plans with pricing (used by pricing page).

#### `POST /api/test-cse`
**Auth** — Test Google Custom Search Engine configuration.

#### `POST /api/send-email`
**Auth** — Send a direct email via the user's configured SMTP.

---

## 6. Page Routes Reference

### Public Pages (no auth required)

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Home / landing page. Search form, hero, feature highlights |
| `/pricing` | `app/pricing/page.tsx` | Plan comparison with Paystack checkout |
| `/blog` | `app/blog/page.tsx` | Blog listing — category filters, reading time, excerpts |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | MDX blog post renderer |
| `/faq` | `app/faq/page.tsx` | Frequently asked questions |
| `/growth` | `app/growth/page.tsx` | SEO growth hub / market intelligence |
| `/growth/seo` | `app/growth/seo/page.tsx` | PageSpeed-powered SEO analysis tool |
| `/market-brief` | `app/market-brief/page.tsx` | AI market brief generator |
| `/terms` | `app/terms/page.tsx` | Terms of service |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/vs-apollo` | `app/vs-apollo/page.tsx` | Comparison: Runvax vs Apollo |
| `/vs-fiverr` | `app/vs-fiverr/page.tsx` | Comparison: Runvax vs Fiverr |
| `/vs-upwork` | `app/vs-upwork/page.tsx` | Comparison: Runvax vs Upwork |
| `/web-design-clients-lagos` | `app/web-design-clients-lagos/page.tsx` | Lagos geo-targeted landing page |
| `/web-design-clients-abuja` | `app/web-design-clients-abuja/page.tsx` | Abuja geo-targeted landing page |
| `/web-design-clients-port-harcourt` | `app/web-design-clients-port-harcourt/page.tsx` | Port Harcourt landing page |
| `/web-design-clients-accra` | `app/web-design-clients-accra/page.tsx` | Accra, Ghana landing page |
| `/web-design-clients-nairobi` | `app/web-design-clients-nairobi/page.tsx` | Nairobi, Kenya landing page |
| `/demo/[slug]` | `app/demo/[slug]/page.tsx` | Public portfolio demo site |

### Auth Pages

| Route | Purpose |
|---|---|
| `/auth/signin` | Email/password login + OAuth |
| `/auth/signup` | New account registration |
| `/auth/verify-email` | Email verification landing page |
| `/auth/forgot-password` | Password reset request form |
| `/auth/reset-password` | New password form (requires token in URL) |

### Authenticated Pages (redirect to `/auth/signin` if unauthenticated)

Auth is enforced client-side via `useSession()` — these routes have no edge-level middleware protection (only `/admin/*` does).

| Route | Purpose |
|---|---|
| `/dashboard` | Analytics dashboard — pipeline stats, revenue projection, outreach funnel |
| `/pipeline` | Kanban prospect board — drag-drop stages, bulk outreach, CSV export |
| `/settings` | Account settings — 8 tabs covering all configuration |

### Admin Pages (redirect to `/admin/login` if not admin)

| Route | Purpose |
|---|---|
| `/admin` | Admin dashboard — user management, plan config, analytics |
| `/admin/login` | Admin login page |

---

## 7. Core Library Modules

All in `src/lib/`.

### `prisma.ts`
Prisma client singleton. Prevents connection pool exhaustion in Next.js dev (hot reload creates new instances without this).

### `auth.ts`
NextAuth options object exported as `authOptions`. Contains credentials provider, JWT + session callbacks, rate limiting on login. See [Authentication System](#4-authentication-system).

### `plans.ts`
Hard-coded plan defaults for `free`, `pro`, `agency`. Admin `PlanConfig` DB records override these at runtime.

```typescript
getPlanLimits(plan: string): PlanLimits
isFeatureEnabled(plan: string, featureId: string): boolean
```

### `usage.ts`
Track and enforce per-user daily API quotas.

```typescript
checkSearchQuota(userId: string): Promise<{ allowed: boolean; remaining: number }>
checkAiQuota(userId: string): Promise<{ allowed: boolean }>
incrementSearch(userId: string): Promise<void>
incrementAiCall(userId: string): Promise<void>
```

### `rateLimiter.ts`
In-memory sliding window rate limiter. Used for auth endpoints.  
**Note:** On Vercel, each cold start gets a fresh in-memory store. For hard guarantees, replace with Redis (Upstash).

```typescript
rateLimit(key: string, opts: { maxRequests: number; windowMs: number }): { ok: true } | { ok: false; retryAfter: number }
getIp(req: Request): string
```

### `email.ts`
Nodemailer transporter factory. Uses `SMTP_*` env vars. Returns a configured transporter for `sendMail()`.

### `paystack.ts`
Paystack API wrapper.

```typescript
verifyWebhookSignature(body: string, signature: string): boolean
initializePayment(email: string, amount: number, planCode: string): Promise<{ authorizationUrl, reference }>
verifyPayment(reference: string): Promise<PaystackTransaction>
```

`verifyWebhookSignature` uses HMAC-SHA512 with `crypto.timingSafeEqual`. Returns `false` if `PAYSTACK_SECRET_KEY` is unset.

### `google-places.ts`
Google Places API (New) integration.

```typescript
searchBusinesses(query: string, location: LatLng, radius: number): Promise<Business[]>
getBusinessDetails(placeId: string): Promise<BusinessDetails>
```

### `scoring.ts`
Lead scoring algorithm. Returns 0–100 score based on:
- No website → high score (good prospect)
- Low rating → higher opportunity
- Few reviews → less competition for web presence
- High-opportunity industries → score boost
- Phone number present → required for WhatsApp outreach

### `userProfile.ts`
Parse and validate `UserSettings` JSON fields (rateCard, portfolio, bankDetails, whatsappConfig).

### `outreach/composer.ts`
Core outreach message composer. Constructs personalized messages using a layered prompt system:
1. Context layer: business name, city, category, website status
2. Persona layer: sender name, agency name, tagline
3. CTA layer: specific call-to-action based on channel
4. Quality gate: validates output meets length/format requirements

### `outreach/types.ts`
TypeScript types for the outreach engine.

### `outreach/assets.ts`
Template library: case study snippets, social proof lines, local references.

### `blog.ts`
```typescript
getAllPosts(): BlogPost[]
getPostBySlug(slug: string): BlogPost | null
```
Reads MDX files from `content/blog/`, parses gray-matter frontmatter, computes reading time.

### `seo.ts`
SEO utilities: canonical URL generation, meta title/description templates.

### `features.ts`
Feature flag evaluation. Checks plan limits and overrides from `PlanConfig`.

---

## 8. Components Reference

All in `src/components/`.

### Layout

| Component | Purpose |
|---|---|
| `Nav.tsx` | Top navigation bar |
| `ConditionalNav.tsx` | Shows/hides Nav based on current route |
| `Sidebar.tsx` | Left sidebar with pipeline, dashboard, settings links |
| `TopBar.tsx` | Mobile-friendly top action bar |
| `AuthProvider.tsx` | NextAuth `SessionProvider` wrapper |

### Search & Results

| Component | Purpose |
|---|---|
| `SearchForm.tsx` | Main search form — industry, location, radius inputs |
| `BusinessGrid.tsx` | Grid of prospect cards |
| `BusinessCard.tsx` | Single prospect card with score badge and quick actions |
| `SkeletonCard.tsx` | Loading placeholder |

### Modals

| Component | Purpose |
|---|---|
| `BusinessDrawer.tsx` | Slide-out panel — full business details |
| `ProspectDetailModal.tsx` | Full prospect view — conversations, notes, stage, reminders |
| `OutreachModal.tsx` | Generate + send WhatsApp / email outreach |
| `BulkOutreachModal.tsx` | Send WhatsApp to multiple prospects with rate limiting |
| `BulkEmailModal.tsx` | Email blast to no-website businesses |
| `ProposalModal.tsx` | Generate + preview AI proposal PDF |
| `FollowUpSequenceModal.tsx` | Create/edit follow-up step sequences |
| `WeaknessModal.tsx` | Website weakness analysis report |
| `DailyBriefModal.tsx` | AI market brief for a searched industry |
| `PromptModal.tsx` | Show generated build prompt with copy/regenerate |
| `QuickFireModal.tsx` | Quick contact buttons for social-only / phone businesses |
| `ManualProspectModal.tsx` | Add prospect manually (no search required) |
| `UpgradeModal.tsx` | Plan upgrade prompt when quota is hit |

### Pipeline & Onboarding

| Component | Purpose |
|---|---|
| `QuestTracker.tsx` | Onboarding checklist (set profile, photo, email, portfolio) |
| `OnboardingWizard.tsx` | Multi-step setup wizard for new users |
| `OnboardingGate.tsx` | Gate content until required setup steps are done |
| `RateCardTab.tsx` | Rate card editor in settings |
| `ConversationPanel.tsx` | View and log conversations with a prospect |
| `ReplyPanel.tsx` | AI reply suggestions for prospect messages |
| `EditablePitch.tsx` | Inline pitch text editor |
| `AITeamPanel.tsx` | Display AI agent status |
| `WaDailyCounter.tsx` | WhatsApp API daily send counter |

### UI Utilities

| Component | Purpose |
|---|---|
| `Toast.tsx` | Toast notification system |
| `CoachHint.tsx` | Contextual help tooltips |
| `InstallBanner.tsx` | PWA install prompt |

---

## 9. Plans & Usage System

### Plan Tiers

Defaults are hard-coded in `src/lib/plans.ts`. Admins can override any value at runtime via `/api/admin/plans`. DB values take precedence; -1 in DB = unlimited.

| Feature | Free | Pro (₦9,999/mo) | Agency (₦24,999/mo) |
|---|---|---|---|
| Searches / day | 5 | 20 | Unlimited |
| Results / search | 20 | 60 | Unlimited |
| AI calls / day | 15 | 200 | Unlimited |
| Max saved prospects | 30 | Unlimited | Unlimited |
| Email Blast | No | Yes | Yes |
| AI Proposals | No | Yes | Yes |
| Market Intelligence Briefs | No | Yes | Yes |
| Website Weakness Analysis | No | Yes | Yes |

**Note:** WhatsApp API, custom SMTP, rate card, and portfolio are available on all plans — they are profile/settings features, not gated features. The four gated `FeatureId` values are: `emailBlast`, `proposals`, `marketBrief`, `weaknessAnalysis`.

### Quota Enforcement

Every search and AI call runs through `src/lib/usage.ts`:
1. Fetch `UsageRecord` for today (create if missing)
2. Compare `count` to plan limit
3. If exceeded → return 429 with quota error
4. On success → `increment` the record

---

## 10. Payment Integration (Paystack)

### Upgrade Flow

1. User clicks upgrade on `/pricing` or `UpgradeModal`
2. Frontend calls `POST /api/payments/initialize` with target plan
3. Backend creates Paystack transaction, returns `authorizationUrl` + `reference`
4. User is redirected to Paystack-hosted checkout page
5. After payment, Paystack GET-redirects to `/api/payments/verify?reference=...`
6. Backend calls Paystack verify API to confirm transaction status
7. On success: `user.plan` and `planExpiresAt` (+35 days) updated in DB; redirect to `/dashboard`
8. On failure: redirect to `/pricing?error=payment_failed`

### Webhook (Canonical Confirmation Path)

Paystack also sends a server-to-server `POST /api/payments/webhook`. This is the authoritative path — the redirect may fail if the user closes the browser. Four events are handled: `charge.success`, `subscription.disable`, `invoice.payment_failed`, `subscription.create`.

The webhook sends a payment confirmation email on `charge.success` and a downgrade notification on `subscription.disable` / `invoice.payment_failed`.

### Adding Plan Codes

1. Create subscription plans in Paystack dashboard → Products → Subscriptions → Plans
2. Copy the plan codes into `.env`: `PAYSTACK_PRO_PLAN_CODE`, `PAYSTACK_AGENCY_PLAN_CODE`

---

## 11. WhatsApp Business API

Runvax supports the Meta WhatsApp Business API (not the unofficial WhatsApp Web automation).

### Setup (per user)

1. User creates a Meta Business account and WhatsApp Business API app
2. In Settings → WhatsApp, user pastes their Access Token and selects their phone number
3. Backend stores credentials in `UserSettings.whatsappConfig`

### Sending Messages

Two paths:
1. **Template messages** — for first contact with new prospects (Meta-approved template required)
2. **Free-form messages** — within 24h of a user-initiated conversation

Templates are created via `POST /api/whatsapp/create-template` and must be approved by Meta (check status via `GET /api/whatsapp/template-status`).

### Rate Limits

`src/lib/waRateLimit.ts` enforces per-user message rate limits to stay within Meta's API limits.

---

## 12. Google Places Integration

**API Used:** Google Places API (New)  
**Endpoint:** `https://places.googleapis.com/v1/places:searchText`

### Caching Strategy

Two-tier cache to minimize API costs:

| Cache | Table | TTL | Key |
|---|---|---|---|
| Search results | `SearchCache` | 7 days | MD5 of query + location + radius |
| Business enrichment | `CachedBusiness` | 90 days | Google `place_id` |

The 90-day limit on `CachedBusiness` is required by Google Places Terms of Service. Cleanup is lazy — triggered on every cache-miss search request, runs fire-and-forget via `void prisma.cachedBusiness.deleteMany(...).catch(() => {})`.

### Location Restriction

Search results are geo-restricted. The `country` field in the search request is used as a component restriction in the Places API call.

---

## 13. AI Integration

Runvax uses two AI providers with a runtime-switchable provider system (`src/lib/ai.ts`):

| Provider | Model | Env Var |
|---|---|---|
| OpenAI | GPT-4o | `OPENAI_API_KEY` |
| Google Gemini | gemini-2.0-flash | `GEMINI_API_KEY` |

**Note:** `@anthropic-ai/sdk` is installed as a dependency but Anthropic Claude is not currently used in active API routes. OpenAI is the default for all features.

### Provider Selection

The `resolveProvider(feature)` function in `src/lib/ai.ts` picks the AI provider per request:
1. Per-feature env override wins: `AI_PROVIDER_<FEATURE>=gemini` (e.g. `AI_PROVIDER_BRIEF=gemini`)
2. Global default override: `AI_PROVIDER_DEFAULT=gemini`
3. Falls back to OpenAI

**Gemini advantage:** Market Briefs benefit from Gemini's live Google Search grounding — setting `AI_PROVIDER_BRIEF=gemini` enables real-time web data in briefs.

Add `GEMINI_API_KEY` to `.env` to enable Gemini. It is optional; all features work with OpenAI alone.

### Outreach Engine

The outreach composer (`src/lib/outreach/composer.ts`) uses a layered prompt strategy:
1. **Base layer** — Task instruction and format requirements
2. **Context layer** — Business-specific data (name, city, category, website presence)
3. **Persona layer** — Sender identity (name, agency, tagline, portfolio URL)
4. **Framework layer** — Persuasion technique (AIDA, PAS, story-based, objection-handling)
5. **Localization layer** — Language/culture adaptation

Quality gate (`src/lib/outreach/quality-gate.ts`) validates the output against length, format, and spam heuristics before returning it.

---

## 14. Email System

Platform emails (verification, password reset, onboarding sequences) are sent via **Nodemailer** using the `SMTP_*` env vars.

Users can also configure **custom SMTP** credentials in Settings → Email, which are stored in `UserSettings.smtpConfig` and used when sending emails to prospects.

The `POST /api/user/smtp-test` endpoint sends a test email using the user's custom SMTP to verify configuration before enabling it.

---

## 15. Rate Limiting

**File:** `src/lib/rateLimiter.ts`

Implementation: In-memory sliding window using a `Map<key, { count, resetAt }>`. Cleanup runs every 5 minutes via `setInterval`.

**Current limits:**
- Registration: 10 requests / IP / 1 hour
- Login: 5 attempts / email+IP / 15 minutes

**Caveat:** Vercel serverless functions don't share memory between instances. Each cold start gets a fresh store. Rate limiting is best-effort — not a hard guarantee. For production hardening, replace the store with Upstash Redis.

---

## 16. Admin System

### Access

Any email listed in the `ADMIN_EMAILS` environment variable gets admin access. `isAdmin` is computed at sign-in and stored in the JWT — never in the database.

### Edge Protection

`src/middleware.ts` runs at the Vercel Edge (before any Lambda is invoked) and blocks `/admin/*` for unauthenticated or non-admin requests. This ensures admin routes cannot be accessed even if API route handlers have a bug.

### Admin Dashboard (`/admin`)

- User table with plan, created date, usage stats, suspend action
- Plan configuration editor (override limits without code deployment)
- Platform analytics (signups trend, revenue, active user count)

---

## 17. Cron Jobs

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/onboarding-emails",
      "schedule": "0 7 * * *"
    }
  ]
}
```

`0 7 * * *` = 07:00 UTC = 08:00 WAT (West Africa Time).

### Onboarding Email Sequence

Targets users with verified emails who registered exactly N days ago (±0.5 day window):

| Day | Subject | Content |
|---|---|---|
| 3 | "How's your pipeline looking?" | Search reminder, 10-minute daily habit |
| 7 | "Have you sent your first proposal?" | Proposal feature walkthrough |
| 14 | "Still looking for your first client?" | Re-engagement with feedback ask |

The cron handler is guarded by `Authorization: Bearer ${CRON_SECRET}`. Vercel injects this header automatically.

---

## 18. Security

### Key Hardening Measures (implemented)

| Concern | Implementation |
|---|---|
| Admin route protection | Edge middleware (`src/middleware.ts`) redirects non-admins before Lambda runs |
| Paystack webhook forgery | HMAC-SHA512 with `timingSafeEqual`; rejects if `PAYSTACK_SECRET_KEY` unset |
| Login brute force | In-memory rate limit: 5 attempts / email+IP / 15 min |
| Registration spam | Rate limit: 10 / IP / hour + 429 with Retry-After header |
| Session security | JWT stored in httpOnly cookie; no session data in localStorage |
| Google Places ToS | `CachedBusiness` records auto-purged after 90 days |
| Cron endpoint | Bearer token guard; Vercel only calls with correct secret |
| Password storage | bcrypt (salt rounds: 10) |
| Suspended accounts | `isSuspended` check blocks login at `authorize()` |

### Known Gaps (not yet implemented)

- Rate limiting is in-memory — not distributed across Vercel instances
- No CSRF protection beyond NextAuth's built-in token for its own routes
- No WAF / DDoS protection (handled by Vercel's edge by default)
- No audit log for admin actions

---

## 19. Error Monitoring (Sentry)

**Package:** `@sentry/nextjs` v10

**Config files:**
- `sentry.client.config.ts` — Browser SDK, replays on error
- `sentry.server.config.ts` — Node.js Lambda SDK
- `sentry.edge.config.ts` — Edge runtime SDK

**Active when:** `NEXT_PUBLIC_SENTRY_DSN` is set. Safe to omit in development — Sentry is a no-op when DSN is absent.

**Settings:**
- `tracesSampleRate: 0.1` — 10% of requests traced (performance)
- `replaysOnErrorSampleRate: 1.0` — Full session replay captured on every error
- Ignored errors: ResizeObserver loops, non-Error promise rejections, network failures

Source maps are uploaded to Sentry at build time when `SENTRY_AUTH_TOKEN` is set.

---

## 20. Database Backup & Restore

### Backup

```bash
./scripts/backup-db.sh
```

- Parses `DATABASE_URL` to extract connection details
- Runs `mysqldump --single-transaction` (non-blocking, safe for production)
- Compresses with gzip → `.backups/runvax_YYYY-MM-DDTHH-MM-SS.sql.gz`
- Rotates files older than `KEEP_DAYS` (default: 30)
- Hooks for S3/GCS/R2 upload are commented in the script

**Recommended cron:**
```
0 2 * * * /path/to/project/scripts/backup-db.sh
```

### Restore

```bash
./scripts/restore-db.sh .backups/runvax_DATE.sql.gz
```

Requires typing `yes` at the confirmation prompt. Decompresses and pipes to `mysql`.

---

## 21. Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import repo in Vercel dashboard
3. Set all environment variables from `.env.example`
4. Database: provision a MySQL 8 database (PlanetScale, Railway, Aiven, or self-hosted)
5. Run: `npx prisma migrate deploy` after first deploy
6. Vercel automatically runs cron jobs from `vercel.json`

### Database Migration

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy

# Reset (destructive — dev only)
npx prisma migrate reset
```

### Build

```bash
npm run build
```

Sentry source maps upload automatically if `SENTRY_AUTH_TOKEN` is set.

---

## 22. Blog & SEO System

### MDX Blog

Blog posts live in `content/blog/*.mdx`. Each file requires this frontmatter:

```yaml
---
title: "Post Title"
excerpt: "One-line summary for blog listing"
date: "2026-01-15"
category: "Guide"
readingTime: "8 min read"
---
```

Available categories: `Guide`, `Cold Email`, `Lead Gen`, `Strategy`, `Tools`, `Tutorial`, `Templates`, `Resources`

### Blog Rendering

`src/app/blog/[slug]/page.tsx` uses `next-mdx-remote/rsc` with custom MDX components for:
- `table`, `thead`, `tbody`, `tr`, `th`, `td` — Tailwind-styled responsive tables
- `pre` — Code block container
- `code` — Inline code

### SEO Infrastructure

- `src/app/sitemap.ts` — Dynamic sitemap including all blog posts
- `src/app/robots.ts` — Robots.txt (allows all, points to sitemap)
- `src/app/llms.txt/` — LLM-crawlable index of site structure
- `src/lib/seo.ts` — Meta tag generation utilities
- OG tags on all key pages

### Keyword Strategy

- `keyword-generator.mjs` — Generates 1,751+ keywords, exports CSV
- `content/blog/keyword-targets.md` — 8-week content calendar with difficulty scores

Run: `node keyword-generator.mjs` or `node keyword-generator.mjs "seed term"`
