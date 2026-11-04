# Runvax

**Find your next customers, then put an AI workforce to work approaching, engaging and winning them.**

Runvax (runvax.com) is a Next.js web app for web designers, freelancers, agencies and small B2B teams. It finds businesses that need what you sell, finds the decision-maker, writes the outreach, runs the follow-ups, handles replies and tracks each lead through to a won client.

Product background lives in [DOCUMENTATION.md](DOCUMENTATION.md) (product), [TECHNICAL_DOCS.md](TECHNICAL_DOCS.md) (architecture) and [USER_DOCS.md](USER_DOCS.md) (end-user guide).

## Two products in one codebase

| | What it is | Where |
|---|---|---|
| **V1: Prospecting** | Search local businesses (Google Places), enrich with email, score, AI proposals and outreach, simple CRM. Frozen: bug fixes only. | `/dashboard`, `/pipeline`, `/demo` |
| **V2: Client Acquisition** | Campaign builder, five-touch email sequences, a six-agent workforce, reply ingestion, a 7-stage pipeline, saved campaign templates, guided setup and a prospect finder. | `/client-acquisition/*` |

Also in the repo: the marketing site and SEO landing pages, the blog (`content/blog`, MDX), the free-trial claim flow (`/claim-pro`), Paystack billing, the admin ops area, and a parked, admin-only **Industry Acquisition Engine** (`/acquisition`, off by default, see [docs/industry-acquisition.md](docs/industry-acquisition.md)).

## Stack

- Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- MySQL with Prisma 5
- NextAuth (credentials, Google, passkeys via SimpleWebAuthn)
- AI providers: OpenAI (default), Gemini, Groq, routed by `AI_PROVIDER_*`
- Email: Resend, with SMTP as the fallback; IMAP for reply ingestion
- Paystack for billing, Sentry for errors, Vercel for hosting and crons
- Vitest for tests

## Getting started

Requirements: Node 20+ and a MySQL database.

```bash
npm install
cp .env.example .env.local     # then fill it in
npx prisma generate
npm run dev                    # http://localhost:3000
```

### Use a throwaway database locally

> **Warning:** the real `.env` and `.env.local` files can point at the **production** database, and Prisma and Next.js load them automatically. For any `prisma` command, migration or script, set `DATABASE_URL` explicitly in the shell, pointing at a disposable local database. A shell variable wins over the `.env` files. See [docs/database-migrations.md](docs/database-migrations.md) for the full runbook.

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/runvax_dev" npx prisma migrate deploy
```

## Environment variables

`.env.example` lists everything with comments. The ones that matter:

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | MySQL connection (required) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Sessions (required) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, OG tags |
| `GOOGLE_PLACES_API_KEY` | Business search |
| `OPENAI_API_KEY` (or `GEMINI_API_KEY`, `GROQ_API_KEY`) | AI outreach, proposals, briefs |
| `RESEND_API_KEY` or `SMTP_*` | Sending email |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_*_PLAN_CODE` | Billing |
| `CRON_SECRET` | Authorising the cron routes |
| `ADMIN_EMAILS` | Who can open admin pages |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (the button only works when both are set) |
| `HUNTER_API_KEY`, `APOLLO_API_KEY`, `APIFY_TOKEN`, `BRAVE_SEARCH_KEY` | Optional decision-maker and email lookup |
| `INDUSTRY_ACQUISITION_ENABLED` | Parked Industry Acquisition module (leave unset) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate && next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests |
| `npm run lint` | Next.js lint |

## Project layout

```
src/app/                 routes: marketing pages, /client-acquisition, /dashboard, /admin, /api
src/components/          UI, including components/acq/ for Client Acquisition
src/lib/                 business logic (AI, email, campaigns, templates, billing, auth, finders)
src/lib/acquisition/     parked Industry Acquisition engine
prisma/schema.prisma     data model
prisma/migrations/       numbered SQL migrations (0 is the baseline)
content/blog/            MDX posts
scripts/                 migration, backup and one-off scripts
tests/                   Vitest suites
docs/                    runbooks, reports and design notes
```

## Database migrations

Migrations are numbered folders in `prisma/migrations/`. Production was originally built with `db push`, so `0_init` is a baseline that must **never be executed** against production, only marked as applied. Client Acquisition migrations 5, 6 and 7 are additive and are applied with:

```bash
./scripts/apply-v2-migration.sh        # skips any already applied; safe to run twice
```

It connects to whatever `DATABASE_URL` is loaded from `.env`, so check that first.

## Scheduled jobs

`vercel.json` runs these daily on Vercel (all authorised by `CRON_SECRET`): plan expiry, lifecycle emails, lead triggers, auto-prospecting, campaign runs, draft preparation, agent tasks, outreach campaigns and an admin daily brief, plus a weekly blog post.

## Deploying

Hosted on Vercel (project `a--prospect-finder`, domain runvax.com). Every deployment is checked against the Vercel plan's rules on who may deploy; on the Hobby plan the commit author must be the account owner.

```bash
npm test && npm run typecheck && npm run build
vercel --prod
```

Apply any new migration to the database **before** the code that needs it goes live.

## Safety rules

- Outreach send routes are guarded by the pipeline and quality checks. The quality gate detects problems; it does not rewrite messages.
- Keep secrets out of the repo. Test fixtures that look like API keys will trigger secret scanners, so build fake values at runtime.
- Never run Prisma or the build against the production `DATABASE_URL` without meaning to.
