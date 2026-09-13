// Runvax knowledge base — the source of truth the support agent answers from.
//
// Every article is a self-contained answer to a cluster of related questions.
// The retriever (./retrieve) picks the few most relevant ones per question and
// the route stuffs them into the prompt, so each body must stand alone: no
// "as mentioned above", no cross-article pronouns.
//
// Plan numbers are NOT written out here — they come from PLAN_DEFAULTS via
// pricingArticle() so the agent can never quote a stale limit or price.

import { PLAN_DEFAULTS, PlanId } from '@/lib/planDefaults';

export interface KbArticle {
  id: string;
  title: string;
  category: string;
  /** Extra search terms — synonyms and the words users actually type. */
  tags: string[];
  body: string;
  /** In-app route this article is about, offered to the user as a next step. */
  href?: string;
}

export const SUPPORT_EMAIL = 'softlineazeez123@gmail.com';

function fmtLimit(n: number): string {
  return n === Infinity ? 'unlimited' : String(n);
}

/** Built from PLAN_DEFAULTS so prices and limits always match what the app enforces. */
function pricingArticle(): KbArticle {
  const row = (id: PlanId) => {
    const p = PLAN_DEFAULTS[id];
    return `**${p.name}** — ${p.price ?? 'Free'} ${p.price ? p.priceNote : `(${p.priceNote})`}
- ${fmtLimit(p.searchesPerDay)} searches per day
- ${fmtLimit(p.resultsPerSearch)} results per search
- ${fmtLimit(p.aiCallsPerDay)} AI calls per day (outreach, proposals, briefs, reply suggestions)
- ${fmtLimit(p.maxProspects)} saved prospects`;
  };

  return {
    id: 'pricing-plans',
    title: 'Plans, pricing and limits',
    category: 'Billing',
    tags: [
      'price', 'pricing', 'cost', 'how much', 'plan', 'plans', 'free', 'pro', 'agency',
      'upgrade', 'subscription', 'limit', 'limits', 'quota', 'naira', 'billing', 'tier',
    ],
    href: '/pricing',
    body: `Runvax has three plans:

${row('free')}

${row('pro')}

${row('agency')}

Free does not include the paid features: AI Proposals, Market Intelligence Briefs, Website Weakness Analysis, and Email Blast. Pro and Agency include all four.

All limits reset daily at midnight UTC. Payment is handled by Paystack (card or bank transfer) — Runvax never stores card details. After paying you are redirected back and the plan activates immediately.

An admin can also set a custom per-account search limit, which overrides the plan limit in either direction.`,
  };
}

const ARTICLES: KbArticle[] = [
  {
    id: 'what-is-runvax',
    title: 'What Runvax is and who it is for',
    category: 'Overview',
    tags: ['what is', 'about', 'overview', 'purpose', 'runvax', 'product', 'who is it for', 'intro'],
    href: '/',
    body: `Runvax is a client-finding tool for web designers, freelancers and digital agencies.

The core idea: thousands of local businesses — restaurants, salons, clinics, hotels, law firms — have no website, so customers cannot find them online. Runvax finds those businesses, tells you which are worth contacting, writes the outreach for you, and tracks the deal to close.

What you can do:
- Search any city + industry for businesses with no website
- See a lead score telling you which prospects to contact first
- Generate a personalised WhatsApp message, cold email or full proposal in one click
- Track every prospect from first contact to closed deal in a pipeline
- Analyse a prospect's existing website for weaknesses and pitch the fix
- Get AI market briefs on an industry before you pitch it

Built for freelance web designers, small agencies, and developers moving into client work — strongest in Nigeria, Ghana, Kenya and South Africa, and also usable in the UK, USA and Canada.`,
  },
  {
    id: 'getting-started',
    title: 'Getting started — first search in under five minutes',
    category: 'Getting started',
    tags: ['start', 'getting started', 'new', 'setup', 'begin', 'first search', 'onboarding', 'signup', 'how to use'],
    href: '/settings',
    body: `1. **Create your account** — sign up with email and password, then click the verification link emailed to you. Email must be verified before your first search.
2. **Fill in your profile** — Settings → Profile: your name, agency name, tagline, city, country, and a profile photo. Every outreach message and proposal is built from these fields, so a blank profile produces weak, generic messages.
3. **Work the Quest Tracker** — the floating widget in the bottom-right corner tracks four setup milestones: save your first prospect, contact a prospect, move a deal to Proposal, and win a deal. Click any quest to jump to the right place.
4. **Run your first search** — on the home page enter an industry ("restaurant") and a city ("Lagos") and hit Search. Results come back ranked by lead score in a few seconds.

The single highest-value setup step is the profile. The AI writes in your name, from your agency, with your tagline and portfolio link — with those blank it has nothing specific to say about you.`,
  },
  {
    id: 'searching',
    title: 'How to search for prospects',
    category: 'Finding prospects',
    tags: ['search', 'searching', 'find', 'industry', 'location', 'city', 'radius', 'query', 'no results', 'lookup'],
    href: '/',
    body: `The search form is on the home page. Three fields:

**Industry / business type** — what you are looking for: restaurant, hair salon, pharmacy, dental clinic, hotel, law firm, gym, supermarket, event hall, mechanic. Be specific: "hair salon Lagos Island" beats "business Lagos".

**Location** — a city or neighbourhood: Lagos, Victoria Island, Ikeja, Lekki Phase 1, Abuja, Port Harcourt, Owerri, Enugu, Kano, Accra, Nairobi.

**Radius** — how far from the centre to search, 1–50 km. Default 5 km. Raise it for smaller towns and rural areas.

What happens when you search:
1. Runvax checks a 7-day cache — repeating a recent search returns instantly and does not hit the paid API.
2. Otherwise it queries Google Places and returns businesses up to your plan's per-search cap.
3. Each business gets a lead score from 0–100.
4. Results are sorted highest-opportunity first.

After the search, filter results by: no website (best prospects), social media only (a Facebook/Instagram page but no site — also excellent), or has website (for redesign and SEO pitches).

Supported countries: Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon, United States, United Kingdom, Canada.`,
  },
  {
    id: 'no-search-results',
    title: 'Troubleshooting: a search returns no results or too few',
    category: 'Troubleshooting',
    tags: [
      'no results', 'empty', 'nothing found', 'zero results', 'not working', 'few results',
      'blank', 'search failed', 'no prospects', 'returns nothing',
    ],
    href: '/',
    body: `Work through these in order:

1. **Check the spelling of the city** and use a well-known name. Very small towns often have thin Google Places coverage — search the nearest larger city instead.
2. **Widen the radius.** The 5 km default is tight outside dense city centres; try 15–25 km.
3. **Broaden the industry term.** "restaurant" returns far more than "continental fine dining restaurant". Search the broad term, then filter.
4. **Check your daily search quota.** Once the cap is hit, searches are refused with an upgrade prompt until midnight UTC.
5. **Confirm your email is verified.** Unverified accounts cannot search.
6. **Check location restrictions.** Some accounts or plans are limited to specific countries or cities; a blocked search returns an explicit "restricted on your account" or "not available on your plan" message.

If results come back but they all have websites, that is normal for wealthy commercial districts — try residential areas, smaller neighbourhoods, or an industry that digitises late (mechanics, laundries, event halls, caterers, tutors).`,
  },
  {
    id: 'lead-score',
    title: 'Lead score and how to read a prospect card',
    category: 'Finding prospects',
    tags: ['score', 'lead score', 'rating', 'card', 'prospect card', '0-100', 'best prospects', 'priority', 'hot lead'],
    body: `Every result carries a lead score from 0–100. 80+ is a hot prospect. The score is driven by website absence, low review count, and how much a business in that industry stands to gain from a site.

Reading a prospect card:
- **Lead score badge** — priority, highest first
- **Business name / category** — straight from Google Places
- **Rating & reviews** — Google stars and review count
- **Website indicator** — green: has a website. Red: none. Orange: social media only
- **Phone number** — present means you can reach them on WhatsApp
- **Distance** — km from your search centre

Click any card to open the Business Drawer: full address, opening hours, all reviews, nearby competitors, and a PageSpeed score if they have a site. The PageSpeed number is a pitch angle on its own — "your site takes 8 seconds to load on mobile, I can get it under 2".`,
  },
  {
    id: 'pipeline',
    title: 'Saving prospects and managing the pipeline',
    category: 'Pipeline',
    tags: [
      'pipeline', 'save', 'saved', 'kanban', 'stage', 'stages', 'drag', 'board', 'crm',
      'notes', 'reminder', 'follow up date', 'deal value', 'export', 'csv',
    ],
    href: '/pipeline',
    body: `Click **Save to Pipeline** on any business card or in the Business Drawer to add it to your board at the Found stage.

The six stages: **Found** (not yet contacted) → **Contacted** (message sent) → **Interested** (replied positively) → **Proposal Sent** → **Won** or **Lost**.

Move a prospect by dragging its card between columns, or by changing the stage inside the Prospect Detail modal.

Clicking a card opens Prospect Detail, where you can change stage, write notes, set a follow-up reminder date, set the estimated deal value in ₦, read the conversation history, generate fresh outreach, and generate or view a proposal.

Select several cards with the checkboxes for bulk actions: Bulk WhatsApp, Bulk Email, and Export CSV (a spreadsheet of all prospect data, stages and notes).

Use the Notes tab per prospect to record what they said on the phone, their budget, the decision-maker's name, and any objection they raised — the AI reads notes when suggesting replies.`,
  },
  {
    id: 'outreach-generation',
    title: 'Generating outreach messages (WhatsApp and email)',
    category: 'Outreach',
    tags: [
      'outreach', 'generate', 'message', 'cold email', 'whatsapp message', 'pitch', 'copy',
      'regenerate', 'tone', 'personalised', 'personalized', 'ai message', 'write',
    ],
    body: `For any business, open the card or Business Drawer and click **Generate Outreach**. Pick the channel — WhatsApp or Email — and hit Generate. The message appears in 5–10 seconds, fully editable before you send.

What makes it personal: the business name and city, their industry, whether they have a website (and its speed score if they do), your name, agency name and tagline, your portfolio URL, and a local reference relevant to that market.

**WhatsApp** messages are short, conversational and direct — name the business, name the gap, state the value, end with an easy question. **Email** is longer and more formal, with a subject line, a clear problem statement, a portfolio link and a soft call to action.

Two tones: Professional (clean and concise) and Casual (warmer — usually stronger with local businesses).

Hit **Regenerate** for a different variation; each pass uses a different copywriting framework (AIDA, PAS, story-led and others), so regenerating gives a genuinely different angle rather than a reshuffle.

For prospects with no website, **Generate Prompt** produces a full specification of the site they should have — sections, features, design direction, copy suggestions. Use it to speed up your build, or to show the client exactly what they are buying before they pay.

Every generation costs one AI call against your daily allowance.`,
  },
  {
    id: 'message-quality',
    title: 'Making generated messages sound like you',
    category: 'Outreach',
    tags: [
      'sounds robotic', 'ai sounding', 'generic', 'edit message', 'doesnt sound like me',
      'bad message', 'improve', 'rewrite', 'quality', 'tone wrong',
    ],
    href: '/settings',
    body: `Generated messages are fully editable — click into the text in the Outreach Modal and change anything before sending.

If messages feel generic, the cause is almost always a thin profile. Fix these in Settings → Profile:
- **Tagline** — the single biggest lever. "I build fast websites for Lagos restaurants" gives the AI a specific angle; an empty tagline leaves it writing filler.
- **Agency name and your name** — used in the greeting and signature.
- **Website / portfolio URL** — becomes the proof link in the message.
- **City** — enables genuinely local references.

Then: switch the tone from Professional to Casual (usually warmer and better received locally), and hit Regenerate for a different framework. If a specific prospect has a website, run the Website Weakness Analysis first — a message built on "your site loads in 9.2s on mobile" outperforms any general pitch.`,
  },
  {
    id: 'whatsapp-api',
    title: 'WhatsApp Business API setup and sending',
    category: 'Outreach',
    tags: [
      'whatsapp', 'wa', 'business api', 'meta', 'template', 'templates', 'access token',
      'phone number id', 'rejected', 'approval', '24 hour window', 'connect whatsapp', 'bulk whatsapp',
    ],
    href: '/settings?tab=whatsapp-api',
    body: `The WhatsApp Business API sends messages programmatically, without opening WhatsApp on your phone. It is optional — you can always send by clicking a WhatsApp link instead.

Requirements: a Facebook Business Manager account, a dedicated phone number (not your personal one), and a verified business.

Setup:
1. Create an app at developers.facebook.com and add the WhatsApp Business API product.
2. Follow Meta's guided setup to register your phone number.
3. Copy your **Access Token** and **Phone Number ID** from the Meta dashboard.
4. In Runvax go to Settings → WhatsApp Business, paste the Access Token and click **Connect** — Runvax fetches your registered numbers.
5. Select your number and save.

**Templates.** Meta requires a pre-approved template for the first message to a number that has never messaged you. Create one in Settings → WhatsApp Business → Create Template, using {{1}} for variables, then submit for review. Most simple business templates are approved in 24–72 hours; check progress under Template Status.

**Why templates get rejected:** too salesy, misleading claims, too many emojis, or words like FREE, GUARANTEED and URGENT. Rewrite as a plain, informational message and resubmit.

**The 24-hour window.** Once a prospect messages you or replies to a template, you can send any free-form message for 24 hours. Runvax tracks which conversations are inside an open window.

**Bulk WhatsApp** sends to several selected prospects with a delay between each to avoid spam detection. Runvax also applies a warm-up ramp on new numbers — daily volume starts low and increases over time, which is what keeps a number from being banned.`,
  },
  {
    id: 'email-smtp',
    title: 'Sending email and custom SMTP setup',
    category: 'Outreach',
    tags: [
      'email', 'smtp', 'send email', 'gmail', 'app password', 'deliverability', 'spam',
      'bulk email', 'email blast', 'from address', 'port 587', 'test connection',
    ],
    href: '/settings?tab=email',
    body: `Send to one prospect from the Outreach Modal: pick Email → Generate → **Send Email**. Send to many with **Bulk Email** from the pipeline (Email Blast is a Pro/Agency feature) — built for businesses that list an email but no phone number.

Mail goes out over the platform SMTP unless you configure your own. Configure your own: emails from a generic platform address land in spam far more often than mail from hello@youragency.com.

Settings → Email & SMTP:
- Host — e.g. smtp.gmail.com or mail.youragency.com
- Port — 587 for STARTTLS, 465 for SSL
- Username — your email address
- Password — your email or app password
- From address — how your name appears to recipients

Click **Test Connection** to send yourself a test before saving.

**Gmail requires an App Password**, not your normal password: Google Account → Security → 2-Step Verification → App passwords → select Mail → generate → paste the 16-character password into the SMTP Password field. Your regular Gmail password will always fail.`,
  },
  {
    id: 'proposals',
    title: 'Creating and sending proposals',
    category: 'Closing',
    tags: [
      'proposal', 'proposals', 'pdf', 'quote', 'quotation', 'send proposal',
      'proposal wrong', 'placeholder', 'document', 'contract',
    ],
    body: `A proposal is an AI-generated PDF addressed to one specific prospect. It contains your agency details, the prospect's business name and city, the problem (no website or an outdated one), your proposed solution, pricing from your rate card, your portfolio as proof, your bank details, and a clear next step.

To generate one: open the prospect's detail modal or Business Drawer → **Generate Proposal** → review the preview → edit if needed → **Send via Email**.

Proposals are a Pro and Agency feature and cost one AI call.

**If the PDF has blank or placeholder sections**, the matching settings are empty. Fill in all four before generating: Rate Card (drives the pricing section), Portfolio (the proof section), Bank details (the payment section), and agency name plus tagline (the header). Missing fields cannot be invented by the AI, so they render as placeholders.`,
  },
  {
    id: 'rate-card',
    title: 'Rate card setup',
    category: 'Settings',
    tags: [
      'rate card', 'ratecard', 'pricing packages', 'packages', 'my prices', 'maintenance',
      'retainer', 'add-ons', 'payment terms', 'deposit', 'what to charge', 'charge',
      'what should i charge', 'how much to charge', 'set my prices', 'quote',
    ],
    href: '/settings?tab=ratecard',
    body: `Your rate card feeds every proposal. Set it once in Settings → Rate Card.

**Packages** — your main tiers. A typical Nigerian setup: Starter ₦150,000 (5-page responsive site, 2 revisions); Business ₦350,000 (10 pages, booking/contact form, 6 months support); E-commerce ₦600,000 (full store, payment integration, 12 months support).

**Maintenance plans** — monthly retainers shown at the foot of proposals, e.g. Basic ₦15,000/month (hosting, security updates, one content update) and Growth ₦30,000/month (adds a monthly SEO report and five content updates). Retainers are what turn one-off project income into predictable revenue — always include at least one.

**Add-ons** — individual extras: extra page ₦20,000, logo design ₦30,000, Google Business Profile setup ₦15,000, social media setup ₦25,000.

**Payment terms** — your deposit structure ("50% upfront, 50% on delivery"), how long the quote stays valid, and how many revision rounds are included.

Three tiers work better than one price: most clients pick the middle option, and the top tier makes the middle look reasonable.`,
  },
  {
    id: 'portfolio',
    title: 'Portfolio setup',
    category: 'Settings',
    tags: ['portfolio', 'projects', 'work samples', 'proof', 'case study', 'examples', 'screenshot'],
    href: '/settings?tab=portfolio',
    body: `Add 3–5 portfolio pieces for strong proposals. Each entry takes a project name, a live URL, a screenshot URL, a one-or-two-sentence description of what you built and what it achieved, and the industry.

The industry field matters: proposals pick portfolio pieces that match the prospect's sector. A restaurant responds far better to a food website than to a law firm site.

If you have no client work yet, build two or three speculative sites for local business types you want to target and list those — a prospect cares that the work is good and relevant, not who paid for it.`,
  },
  {
    id: 'bank-details',
    title: 'Bank details for proposals',
    category: 'Settings',
    tags: ['bank', 'account number', 'payment details', 'get paid', 'payout', 'invoice', 'sort code'],
    href: '/settings?tab=payment',
    body: `Your bank details appear in the payment section of every proposal so a client who says yes can pay immediately.

Settings → Bank & Payment: bank name (e.g. First Bank Nigeria), account number, account name (matching the account exactly), an optional sort code, and an optional payment link.

Leave these blank and proposals go out with a placeholder where the payment instructions should be — the most common reason a "yes" stalls for a week.`,
  },
  {
    id: 'follow-up-sequences',
    title: 'Follow-up sequences',
    category: 'Outreach',
    tags: ['follow up', 'followup', 'sequence', 'cadence', 'drip', 'no reply', 'chase', 'reminder', 'steps'],
    body: `Most prospects never reply to a first message, so Runvax lets you build a follow-up sequence per prospect.

Open the prospect's detail modal → **Follow-Up Sequence** tab → add steps, each with a day offset, a channel (WhatsApp, email, or a call reminder) and the message. Save.

A sequence that works:
- Day 0 — WhatsApp cold outreach
- Day 3 — WhatsApp follow-up ("Just checking whether you saw my message")
- Day 7 — Email with the proposal attached
- Day 14 — Final WhatsApp ("Completely understand if the timing isn't right — happy to connect whenever")

Each step shows as pending, sent or skipped, and the prospect is highlighted in your pipeline on the day a step is due.

Most deals that close come from the second, third or fourth touch. If you only ever send one message, you are leaving the majority of your pipeline on the table.`,
  },
  {
    id: 'reply-intelligence',
    title: 'AI reply intelligence — handling prospect responses',
    category: 'Closing',
    tags: [
      'reply', 'replies', 'response', 'responded', 'objection', 'too expensive', 'intent',
      'suggestion', 'what do i say', 'answer them', 'sentiment', 'negotiate',
    ],
    body: `When a prospect responds, log their message in the prospect's Conversation panel and click **Get Reply Suggestion**. The AI reads their message and drafts an appropriate response.

Runvax classifies replies into 20+ intent types and recommends the next move:
- **Interested** → send the proposal immediately
- **Asked price** → send the rate card or a proposal
- **Too expensive** → offer the entry-level package rather than discounting the quoted one
- **Need to think** → set a 3-day follow-up reminder
- **Not interested** → move to Lost and ask for a referral
- **Wrong number** → remove from the pipeline

The fuller **Reply Intelligence** panel runs a combined sentiment and intent analysis, which is what you want for a vague or hard-to-read reply.

Speed matters more than polish here: replying within the hour to an interested prospect converts dramatically better than a perfect reply the next day.`,
  },
  {
    id: 'weakness-analysis',
    title: 'Website weakness analysis',
    category: 'Finding prospects',
    tags: [
      'weakness', 'audit', 'analyse website', 'analyze website', 'pagespeed', 'seo issues',
      'slow site', 'existing website', 'redesign pitch', 'core web vitals',
    ],
    body: `For prospects who already have a website, open the Business Drawer and click **Analyze Website**. The report covers:

- **Performance** — load time and Core Web Vitals
- **SEO** — missing meta tags, weak titles and descriptions, no structured data
- **UX** — mobile responsiveness problems, no contact form, no clear call to action
- **Technical** — no SSL, outdated technology, no analytics

Weakness Analysis is a Pro and Agency feature and costs one AI call.

Its value is in the pitch: paste a finding into your outreach. "I ran a quick check on your site — it takes 9.2 seconds to load on mobile, and most visitors leave after 3. I can fix that." That converts far better than "I build websites", because it proves you looked and it names a cost they are already paying.`,
  },
  {
    id: 'market-brief',
    title: 'Market briefs',
    category: 'Finding prospects',
    tags: [
      'market brief', 'brief', 'research', 'industry research', 'what to charge', 'charge',
      'market intelligence', 'new industry', 'pricing research', 'objections',
      'how much to charge', 'market rates', 'what clients pay',
    ],
    href: '/market-brief',
    body: `A Market Brief researches an industry in a specific location before you pitch it. It covers the client profile, realistic pricing tiers for that exact area with a recommended entry point, why the timing is right, the strongest value propositions, the three objections you will actually hear with counters, the tone to use, one non-obvious strategic insight, and a ready opening line.

Access it from the Market Brief link in a search result header, or go to /market-brief and enter any industry and location.

Market Briefs are a Pro and Agency feature and cost one AI call. Pricing guidance is location-specific — the brief distinguishes between Lekki and Ayobo rather than quoting one national average.

Run one before entering any industry you have not sold to before. Ten minutes here prevents pricing yourself out of a whole sector.`,
  },
  {
    id: 'dashboard',
    title: 'Analytics dashboard',
    category: 'Pipeline',
    tags: [
      'dashboard', 'analytics', 'stats', 'metrics', 'win rate', 'revenue', 'funnel',
      'conversion', 'performance', 'reports', 'progress',
    ],
    href: '/dashboard',
    body: `The dashboard shows pipeline analytics: total prospects and the breakdown by stage, win rate, revenue projection (value of proposals out, expected revenue from Interested and Proposal stages, and won revenue to date), your outreach funnel and response rate trend, daily activity for the last 30 days, which industries respond best, and industry trends by lead score.

Read it weekly and act on three questions: which industries convert best (run more of those searches), what is stuck at Contacted (those need follow-ups, not new prospects), and are you hitting your daily outreach goal.

Set that goal in Settings → Goals & Analytics along with your average deal value and close rate — the dashboard measures your progress against it.`,
  },
  {
    id: 'settings-overview',
    title: 'Settings — what each tab controls',
    category: 'Settings',
    tags: ['settings', 'configure', 'profile', 'tabs', 'account settings', 'preferences', 'where do i set'],
    href: '/settings',
    body: `Settings has eight tabs:

- **Profile** — your name, agency name, tagline, city, job title, WhatsApp number, reply email and website. Used in every message and proposal.
- **Email & SMTP** — your outreach email address and custom SMTP credentials.
- **Bank & Payment** — the bank details printed in proposals.
- **Goals & Analytics** — daily outreach goal, average deal value, close rate.
- **Rate Card** — packages, maintenance plans, add-ons and payment terms.
- **Portfolio** — your project examples.
- **WhatsApp Business** — WhatsApp Business API credentials and templates.
- **Security** — change password, biometric login, active sessions and login history.

Settings → Search History also shows every search you have run, how many businesses came back, and what share had no website — use the hit rate to double down on your best industry and city combinations.`,
  },
  {
    id: 'daily-habit',
    title: 'The daily routine that actually lands clients',
    category: 'Getting started',
    tags: [
      'routine', 'habit', 'daily', 'how many messages', 'consistency', 'workflow',
      'best practice', 'strategy', 'not getting clients', 'no replies', 'streak',
    ],
    body: `Runvax works as a 10–15 minute daily habit, not a once-a-month binge.

1. **Search (3 min)** — one industry, one city you want to own.
2. **Review (2 min)** — scan the top 5–10 results, open the Business Drawer on the best.
3. **Save (1 min)** — add the top three to your pipeline.
4. **Outreach (5 min)** — generate and send WhatsApp or email to each.
5. **Follow up (2 min)** — clear anything due in the pipeline today.
6. **Log (1 min)** — the daily counter increments automatically as you send.

Three messages a day is 90+ prospects a month. At a 10% response rate and a 30% close rate on responses, that is roughly two to three new clients a month from fifteen minutes a day.

If you are getting no replies at all, the problem is usually one of: messages sent to businesses that already have good websites, a blank profile making messages generic, first touch only with no follow-up sequence, or sending at the wrong hour — mid-morning and early evening beat late night for local business owners.`,
  },
  {
    id: 'limit-reached',
    title: 'Troubleshooting: daily limit reached',
    category: 'Troubleshooting',
    tags: [
      'limit reached', 'limit', 'quota', 'blocked', 'cant search', 'ran out', 'used up',
      'daily limit', 'ai limit', 'upgrade prompt', '402', 'reset',
    ],
    href: '/pricing',
    body: `Runvax caps two things per day: searches and AI calls (every outreach generation, proposal, market brief and reply suggestion is one AI call).

When you hit a cap you get an upgrade prompt instead of a result, and an email the first time it happens that day.

**Limits reset at midnight UTC** — not at midnight local time. In West Africa (UTC+1) that is 1am; in East Africa (UTC+3) it is 3am.

To get more capacity now, upgrade at /pricing. To make the capacity you have go further:
- Repeat searches hit the 7-day cache and are free, so re-running an earlier search costs nothing.
- Filter results before generating messages — only generate for prospects you will actually contact.
- Do not regenerate three times looking for perfection; edit the draft by hand instead. Every regeneration is another AI call.

If you were told a search is restricted rather than exhausted, that is a location or country restriction on your account or plan, not a quota.`,
  },
  {
    id: 'verification-email',
    title: 'Troubleshooting: verification or password reset email not arriving',
    category: 'Troubleshooting',
    tags: [
      'verification email', 'verify', 'didnt receive', 'no email', 'confirm email',
      'reset password', 'forgot password', 'spam folder', 'resend', 'cant sign in', 'login',
    ],
    href: '/auth/signin',
    body: `1. **Check the spam and promotions folders first** — this is where the great majority of "missing" verification emails are.
2. **Wait five minutes before resending.** Gmail sometimes delays mail from a new sender; sending three requests in a row does not speed it up.
3. **Click Resend Verification** on the verify page if it still has not arrived.
4. **Check the address for typos** — a mistyped signup address is the second most common cause. If it is wrong, sign up again with the correct address.

Password reset works the same way: request the link from the forgot-password page and check spam if it is slow.

Email must be verified before your first search. If you are locked out with a correct password and a verified address, contact ${SUPPORT_EMAIL} with your account email.`,
  },
  {
    id: 'account-security',
    title: 'Account security — password, biometrics, sessions',
    category: 'Account',
    tags: [
      'password', 'change password', 'security', 'biometric', 'face id', 'fingerprint',
      'webauthn', 'sessions', 'sign out', 'hacked', 'compromised', '2fa',
    ],
    href: '/settings?tab=security',
    body: `Settings → Security handles all of it.

**Password** — change it any time; use at least 8 characters and a password you do not reuse elsewhere.

**Biometric login** — register Face ID or a fingerprint via WebAuthn. Click Register Biometric Device, confirm the browser prompt, and future sign-ins offer a Use Biometric button. Your biometric data never leaves your device — Runvax only stores a public key.

**Sessions** — view active sessions and login history, and sign out everywhere.

If you think the account is compromised: change the password immediately, sign out of all sessions, then email ${SUPPORT_EMAIL} if you see activity you do not recognise.`,
  },
  {
    id: 'billing-payment',
    title: 'Payments, upgrades and cancellation',
    category: 'Billing',
    tags: [
      'payment', 'paystack', 'card', 'bank transfer', 'upgrade', 'cancel', 'refund',
      'subscription', 'billing', 'payment failed', 'not activated', 'charged', 'downgrade',
      'delete account', 'close account', 'delete my account', 'cancel subscription',
    ],
    href: '/pricing',
    body: `Upgrade from /pricing or from any upgrade prompt: pick Pro or Agency, click through to Paystack, and pay by card or bank transfer. You are redirected back and the plan activates immediately. Runvax never stores card details.

**If you paid and the plan did not activate**, first sign out and back in — the plan is carried in your session token, so a stale session can show the old plan after a successful payment. If it is still wrong after that, email ${SUPPORT_EMAIL} with the Paystack reference from your payment receipt.

**Cancellation** — contact support to cancel. You keep access until the end of the current billing period.

**Deleting your account** — email ${SUPPORT_EMAIL} from or naming your account email. Deletion is processed within 48 hours and removes all your data permanently.`,
  },
  {
    id: 'mobile-pwa',
    title: 'Using Runvax on a phone',
    category: 'Account',
    tags: ['mobile', 'phone', 'app', 'pwa', 'install', 'ios', 'android', 'home screen', 'offline'],
    body: `Runvax is a Progressive Web App, so it installs like a native app without an app store.

On Android Chrome, open Runvax and tap the install prompt, or use the browser menu → Add to Home Screen. On iOS Safari, tap Share → Add to Home Screen.

Once installed it opens full-screen from your home icon with the same account and data as the browser. Everything works on mobile, though the pipeline Kanban board and the dashboard are easier to work with on a larger screen.`,
  },
  {
    id: 'data-privacy',
    title: 'Where prospect data comes from, and privacy',
    category: 'Account',
    tags: [
      'data', 'privacy', 'gdpr', 'where does data come from', 'google places', 'legal',
      'accurate', 'wrong information', 'outdated', 'source', 'scraping',
      'delete account', 'delete my data', 'export data', 'my data',
    ],
    href: '/privacy',
    body: `Business data comes from Google Places — the same public business listings that appear in Google Maps: name, category, address, phone, rating, review count and website field. Runvax does not scrape private data and does not sell contact lists.

Because listings are maintained by the businesses themselves, some are out of date. A business flagged "no website" may have built one and never updated its Google listing, and phone numbers change. Always check the Business Drawer before pitching, and treat a wrong detail as a listing problem rather than a Runvax error.

Search results are cached for seven days to keep repeat searches instant and free.

Your own data — profile, prospects, notes, conversations — belongs to you. Export your pipeline as CSV at any time, and request full deletion by emailing ${SUPPORT_EMAIL}.`,
  },
  {
    id: 'team-multiseat',
    title: 'Teams and multiple users',
    category: 'Account',
    tags: ['team', 'teams', 'multi user', 'seats', 'colleague', 'staff', 'share account', 'multiple users'],
    body: `Runvax is currently single-user per account — one login, one pipeline. There is no seat management or shared pipeline yet.

Agency plan customers who need several people working the same pipeline should email ${SUPPORT_EMAIL} to discuss multi-seat access.

Sharing one login between people works but is not recommended: sessions and daily limits are per account, so two people working simultaneously exhaust the same daily quota and can overwrite each other's edits to the same prospect.`,
  },
  {
    id: 'contact-support',
    title: 'Contacting a human',
    category: 'Account',
    tags: [
      'support', 'contact', 'human', 'help', 'email support', 'bug', 'feature request',
      'complaint', 'talk to someone', 'assistant', 'who are you', 'what can you do', 'chatbot',
    ],
    body: `You are already talking to the Runvax Assistant — the in-app support agent. It is available from the sparkle button in the bottom-right corner on every page, it knows the whole product, and it can see the asking user's own plan, usage and setup, so it can answer both "how does this work" and "why isn't this working for me". It is free and does not use up the daily AI allowance.

Email ${SUPPORT_EMAIL} for anything needing a human: billing problems, account recovery, cancellation, deletion, multi-seat requests, bug reports and feature requests.

Include your account email, what you expected, what happened instead, and — for a payment issue — the Paystack reference. That normally turns a multi-day back-and-forth into a single reply.

Other resources: the FAQ at /faq, tutorials and strategy articles on the blog at /blog, and plan details at /pricing.`,
  },
];

export const KNOWLEDGE_BASE: KbArticle[] = [pricingArticle(), ...ARTICLES];

export function getArticle(id: string): KbArticle | undefined {
  return KNOWLEDGE_BASE.find((a) => a.id === id);
}

/** Every in-app route the agent is allowed to link to, so it cannot invent one. */
export const KNOWN_ROUTES: string[] = [
  '/', '/pipeline', '/dashboard', '/settings', '/pricing', '/market-brief',
  '/faq', '/blog', '/privacy', '/terms', '/auth/signin', '/auth/signup',
  '/settings?tab=profile', '/settings?tab=email', '/settings?tab=payment',
  '/settings?tab=goals', '/settings?tab=ratecard', '/settings?tab=portfolio',
  '/settings?tab=whatsapp-api', '/settings?tab=security',
];
