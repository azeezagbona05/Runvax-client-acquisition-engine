# Runvax — User Guide

> Everything you need to find clients, send outreach, close deals, and grow your web design business in Nigeria and across Africa.

---

## Table of Contents

1. [What is Runvax?](#1-what-is-runvax)
2. [Getting Started](#2-getting-started)
3. [Searching for Prospects](#3-searching-for-prospects)
4. [Reading a Prospect Card](#4-reading-a-prospect-card)
5. [Saving Prospects to Your Pipeline](#5-saving-prospects-to-your-pipeline)
6. [Managing Your Pipeline](#6-managing-your-pipeline)
7. [Generating Outreach Messages](#7-generating-outreach-messages)
8. [Sending via WhatsApp Business API](#8-sending-via-whatsapp-business-api)
9. [Sending Emails to Prospects](#9-sending-emails-to-prospects)
10. [Creating & Sending Proposals](#10-creating--sending-proposals)
11. [Follow-Up Sequences](#11-follow-up-sequences)
12. [AI Reply Intelligence](#12-ai-reply-intelligence)
13. [Website Weakness Analysis](#13-website-weakness-analysis)
14. [Market Briefs](#14-market-briefs)
15. [Analytics Dashboard](#15-analytics-dashboard)
16. [Settings & Profile](#16-settings--profile)
17. [Rate Card Setup](#17-rate-card-setup)
18. [Portfolio Setup](#18-portfolio-setup)
19. [Custom SMTP Email](#19-custom-smtp-email)
20. [Bank Details for Proposals](#20-bank-details-for-proposals)
21. [WhatsApp Business API Setup](#21-whatsapp-business-api-setup)
22. [Onboarding Quest Tracker](#22-onboarding-quest-tracker)
23. [Daily Habit & Tracking](#23-daily-habit--tracking)
24. [Upgrading Your Plan](#24-upgrading-your-plan)
25. [Account Security](#25-account-security)
26. [FAQ & Troubleshooting](#26-faq--troubleshooting)

---

## 1. What is Runvax?

Runvax is a client-finding tool built specifically for web designers and digital agencies in Africa.

**The core idea:** Thousands of local businesses in your city — restaurants, salons, clinics, hotels, lawyers — have no website. They're losing customers every day because they can't be found online. You can fix that. Runvax helps you find those businesses, generate personalized outreach messages, and close them as paying clients.

**What you can do with Runvax:**
- Search any city + industry for businesses with no website
- See a lead score that tells you which prospects are worth contacting first
- Generate a personalized WhatsApp or email message in one click
- Track every prospect from first contact to closed deal
- Create and send professional proposals with your rate card and portfolio
- Analyze a business's website for weaknesses to use as your pitch
- Get AI market briefs on any industry before you pitch it

**Who it's for:**  
Freelance web designers, small digital agencies, developers transitioning to client work, and anyone building a web design income stream in Nigeria, Ghana, Kenya, South Africa, and across Africa.

---

## 2. Getting Started

### Step 1 — Create Your Account

Go to the signup page and create an account with your email and password. You'll receive a verification email — click the link to verify before your first search.

### Step 2 — Complete Your Profile

Go to **Settings** and fill in:
- Your name and your agency name
- Your tagline (e.g. "I build websites for Lagos businesses")
- Your city and country
- A profile photo (increases trust with prospects)

This information is used in every outreach message and proposal Runvax generates for you.

### Step 3 — Complete the Quest Tracker

The **Quest Tracker** (bottom-right on desktop) shows 4 setup tasks. Completing all 4 unlocks the full onboarding wizard and gives you the best experience from day one:

1. Set your profile (name, agency, tagline)
2. Add a profile photo
3. Configure your outreach email
4. Add at least one portfolio piece

### Step 4 — Do Your First Search

On the home page, type an industry (e.g. "restaurant") and a city (e.g. "Lagos"). Hit Search. In seconds you'll see a list of businesses ranked by how likely they are to need a website.

---

## 3. Searching for Prospects

The Search Form is on the home page (`/`).

### Search Fields

**Industry / Business Type**  
What kind of business are you looking for? Examples:
- `restaurant`, `hair salon`, `pharmacy`, `dental clinic`, `hotel`, `law firm`, `gym`, `supermarket`, `event hall`, `mechanic`

Be specific — "hair salon Lagos Island" beats "business Lagos."

**Location**  
City or neighborhood. Examples:
- `Lagos`, `Victoria Island Lagos`, `Ikeja`, `Lekki Phase 1`, `Abuja`, `Port Harcourt`, `Owerri`, `Enugu`, `Kano`, `Accra`, `Nairobi`

**Radius**  
How far from the city center to search (1–50 km). Default is 5 km. Increase it for smaller cities or rural areas.

### What Happens When You Search

1. Runvax checks a 7-day cache first (same search again? instant results)
2. If not cached, it calls Google Places and returns up to 10–50 businesses (depending on your plan)
3. Each business gets a **lead score** (0–100) based on website presence, reviews, and industry fit
4. Results are sorted by score — highest opportunity first

### Search Limits

| Plan | Searches per day | Results per search |
|---|---|---|
| Free | 5 | 20 |
| Pro | 20 | 60 |
| Agency | Unlimited | Unlimited |

If you hit your limit, you'll see an upgrade prompt. Limits reset at midnight UTC.

### Filtering Results

After a search, use the filter bar to show only:
- No website (best prospects)
- Social media only (Facebook/Instagram page but no website — also a great prospect)
- Has website (if you want to pitch redesigns or SEO)

---

## 4. Reading a Prospect Card

Each card in the search results tells you:

| Element | What it means |
|---|---|
| **Lead Score badge** | 0–100. 80+ = hot prospect. Based on website absence, low review count, high-opportunity industry |
| **Business name** | Pulled from Google Places |
| **Category** | Industry/business type |
| **Rating & Reviews** | Google star rating and review count |
| **Website indicator** | Green = has website. Red = no website. Orange = social only |
| **Phone number** | Present = you can reach them via WhatsApp |
| **Distance** | Km from your search center |

**Click the card** to open the Business Drawer with full details: address, hours, all reviews, competitor analysis, and PageSpeed score (if they have a website).

### Business Drawer

The slide-out drawer shows:
- Full contact details
- Opening hours
- All Google reviews with sentiment
- Nearby competitors
- Website speed score (PageSpeed Insights) — use this as a pitch angle ("your site loads in 8 seconds, I can get it under 2")
- Quick action buttons: Generate Outreach, Save to Pipeline, View Proposal

---

## 5. Saving Prospects to Your Pipeline

Click **Save to Pipeline** on any business card or in the Business Drawer. The prospect is added to your Kanban board at the **Found** stage.

### Prospect Stages

| Stage | Meaning |
|---|---|
| **Found** | Just discovered, not yet contacted |
| **Contacted** | You've sent a message |
| **Interested** | They responded positively |
| **Proposal Sent** | You've sent them a proposal |
| **Won** | Deal closed |
| **Lost** | They said no (or went cold) |

Move a prospect between stages by dragging the card on the Pipeline board, or by selecting the stage in the Prospect Detail modal.

---

## 6. Managing Your Pipeline

Go to `/pipeline` to see your full Kanban board.

### Pipeline Actions

**Drag & Drop** — Move prospect cards between stage columns directly.

**Click a card** — Opens the Prospect Detail modal where you can:
- Change stage
- Add/edit notes
- Set a follow-up reminder (get a push notification on that date)
- Set your estimated deal value (₦)
- View conversation history
- Generate new outreach messages
- View or generate a proposal

**Bulk Actions** (select multiple cards with checkboxes):
- Bulk WhatsApp — send a message to multiple prospects at once
- Bulk Email — email blast for no-website businesses
- Export as CSV — download your pipeline as a spreadsheet

**Search & Filter** — Filter by stage, industry, date added, or score.

### Prospect Notes

Inside the Prospect Detail modal, the Notes tab is a free-text notepad for that prospect. Use it to track:
- What they said when you called
- Their budget range
- Decision-maker's name
- Any objections they raised

### Reminders

Set a reminder date on any prospect. On that date, the prospect is highlighted in your pipeline and you'll see it in your dashboard's "Due Today" list.

---

## 7. Generating Outreach Messages

This is Runvax's most-used feature. For any business, you can generate a personalized WhatsApp or email message in one click.

### How to Generate

1. Open any prospect card or Business Drawer
2. Click **Generate Outreach** (or the WhatsApp/email icon)
3. The Outreach Modal opens — select your channel (WhatsApp or Email)
4. Hit Generate — your personalized message appears in 5–10 seconds
5. Copy it, edit it if you want, then send it

### What Makes It Personalized

The AI uses:
- The business's name and city
- Their industry
- Whether they have a website (and its score if they do)
- Your name, agency name, and tagline
- Your portfolio URL (if set)
- A relevant local reference (e.g. "I know how competitive Lagos Island salons are")

### Message Channels

**WhatsApp** — Short, conversational, direct. Opens with the business's name, quickly explains the gap (no website / slow website), pitches the value, ends with a simple question like "Would you be open to a quick call this week?"

**Email** — Slightly longer, more formal. Has a subject line, clear problem statement, portfolio link, and a soft CTA.

### Tones

- **Professional** — Clean, respectful, concise
- **Casual** — Warmer, more conversational — works well for local Nigerian businesses

### Regenerating

If you don't like the first result, hit **Regenerate** for a new variation. The AI uses a different framework on each generation (AIDA, PAS, story-based, etc.).

### Website Build Prompt

For prospects with no website, click **Generate Prompt** to get a detailed specification of what their website should look like — sections, features, design style, copy suggestions. Use this to:
- Speed up your design process
- Show the client exactly what they're getting before they pay

---

## 8. Sending via WhatsApp Business API

Runvax integrates with the Meta WhatsApp Business API for direct message sending. This is different from clicking a WhatsApp link — the API lets you send messages programmatically without opening WhatsApp on your phone.

**Requirement:** You need a Meta Business account and a WhatsApp Business API setup. See [WhatsApp Business API Setup](#21-whatsapp-business-api-setup).

### Sending a Message

1. Open the Outreach Modal for a prospect
2. Select **WhatsApp**
3. Generate your message
4. Click **Send via API** — the message goes directly to the prospect's WhatsApp

### Templates

WhatsApp requires pre-approved message templates for first contact with a number that hasn't messaged you before. To create a template:

1. Settings → WhatsApp → Create Template
2. Enter your template name and text
3. Submit for Meta review (typically 24–72 hours)
4. Once approved, you can send it to any prospect

After the prospect replies, you can send free-form messages for 24 hours.

### Bulk WhatsApp

Select multiple prospects on the Pipeline board → click **Bulk WhatsApp** → the system sends your message to each prospect with a small delay between sends to avoid spam detection.

---

## 9. Sending Emails to Prospects

### Direct Email (one prospect)

In the Outreach Modal → select Email → Generate → click **Send Email**. The email is sent via your configured SMTP (or the platform SMTP if you haven't set one).

### Email Blast (multiple no-website businesses)

Select prospects on the Pipeline board → click **Bulk Email**. This is designed for businesses that only have an email address (no WhatsApp / phone on Google Places).

### Custom SMTP

For better deliverability and professional branding, configure your own SMTP in Settings → Email. See [Custom SMTP Email](#19-custom-smtp-email).

---

## 10. Creating & Sending Proposals

Proposals are AI-generated PDF documents addressed to a specific prospect. They include:

- Your agency name and contact details
- The prospect's business name and city
- The problem (no website / outdated website)
- Your proposed solution (what you'll build)
- Your pricing from your rate card
- Your portfolio as proof of work
- Your bank details for payment
- A clear next step / CTA

### How to Generate a Proposal

1. Open any prospect's detail modal or Business Drawer
2. Click **Generate Proposal**
3. The Proposal Modal shows a preview
4. Review it, make edits if needed
5. Click **Send via Email** to email it directly to the prospect's address

### What You Need Set Up First

The proposal quality depends on how complete your profile is:
- **Rate card** — so the pricing section is accurate
- **Portfolio** — so the proof section shows real work
- **Bank details** — so the payment section has your account number
- **Agency name and tagline** — for the header

All of these are set in [Settings](#16-settings--profile).

---

## 11. Follow-Up Sequences

Most clients don't reply to the first message. Runvax lets you create automated follow-up sequences so you never let a prospect go cold.

### Creating a Sequence

1. Open a prospect's detail modal
2. Click **Follow-Up Sequence** tab
3. Add steps: choose the day, channel (WhatsApp, email, or call reminder), and message
4. Save the sequence

**Example sequence:**
- Day 0: WhatsApp cold outreach
- Day 3: Follow-up WhatsApp ("Just checking if you had a chance to see my message")
- Day 7: Email with proposal attached
- Day 14: Final WhatsApp ("Completely understand if timing isn't right — happy to connect whenever")

### Tracking Sequence Status

Each step shows its status: `pending`, `sent`, `skipped`. When a step is due, the prospect is highlighted in your pipeline.

---

## 12. AI Reply Intelligence

When a prospect responds to you, Runvax helps you reply strategically.

### Reply Suggestions

1. In a prospect's Conversation panel, log their reply
2. Click **Get Reply Suggestion**
3. AI analyzes their message and generates an appropriate response

### Intent Detection

Runvax categorizes prospect replies into 20+ types:

| Reply Type | Suggested Next Action |
|---|---|
| Interested | Send proposal immediately |
| Asked Price | Send rate card or proposal |
| Too Expensive | Offer entry-level package |
| Need to Think | Set 3-day follow-up reminder |
| Not Interested | Move to Lost, ask for referral |
| Wrong Number | Remove from pipeline |

The AI detects which type the reply is and recommends the next move.

### Reply Intelligence Panel

The advanced version (`Reply Intelligence`) does full sentiment + intent analysis — useful when you're not sure how to read a vague reply.

---

## 13. Website Weakness Analysis

For prospects who already have a website, Runvax generates a weakness analysis you can use as your pitch.

### How to Use It

1. Open the Business Drawer for any business with a website
2. Click **Analyze Website**
3. The Weakness Modal shows a report covering:
   - **Performance:** Page load time, Core Web Vitals scores
   - **SEO:** Missing meta tags, poor title/description, no structured data
   - **UX:** Mobile responsiveness issues, no contact form, no clear CTA
   - **Technical:** No SSL, outdated tech, no Google Analytics

### Using It in Your Pitch

Copy the weakness summary and include it in your outreach: "I ran a quick check on your website and found that it loads in 9.2 seconds on mobile — the average user leaves after 3 seconds. I can fix this."

This transforms your pitch from generic ("I build websites") to specific and valuable.

---

## 14. Market Briefs

Before pitching a new industry, use Market Briefs to understand it.

### What a Brief Covers

- Industry overview for a specific city/region
- Common pain points of businesses in this industry
- Why they need a website (their specific use case)
- Pricing insights (what they typically spend on marketing)
- Local competitive landscape
- Suggested angles for your pitch

### How to Access

- After a search, click **Market Brief** in the result header
- Or go to `/market-brief` and enter any industry + location

### Usage

Market Briefs consume 1 AI call per generation. Pro and Agency plans only.

---

## 15. Analytics Dashboard

Go to `/dashboard` to see your full pipeline analytics.

### Metrics Shown

**Pipeline Overview**
- Total prospects saved
- Breakdown by stage (Found, Contacted, Interested, Proposal, Won, Lost)
- Win rate (Won / total prospects)

**Revenue Projection**
- Total value of proposals sent
- Estimated revenue from current Interested + Proposal stage prospects
- Won revenue to date

**Outreach Funnel**
- How many prospects you've contacted vs. responded
- Response rate trend

**Daily Activity**
- Outreach messages sent per day (last 30 days)
- Searches performed
- Proposals generated

**Category Performance**
- Which industries have your best response rates
- Which industries have the most no-website prospects

**Industry Trends**
- Top industries by lead score in your recent searches

### Using the Dashboard

Check your dashboard weekly to answer:
- Which industries are converting best? (Do more of those searches)
- What's your average stage time? (Is anything stuck at "Contacted"?)
- Are you hitting your daily outreach goal?

---

## 16. Settings & Profile

Go to `/settings` to configure everything. Settings are organized into 8 tabs.

### Profile Tab

| Field | Purpose |
|---|---|
| Full name | Used in outreach: "Hi, I'm [Name]" |
| Agency name | "at [Agency Name]" in messages |
| Tagline | Brief pitch: "I build fast websites for Lagos businesses" |
| Profile photo | Shown in your portal; some proposals include it |
| City | Used for location context in messages |
| Country | Determines currency and Google Places region |
| Job title | Your role (Freelancer, Creative Director, etc.) |
| Website | Your portfolio site URL — included in outreach messages |

### Email Tab

Configure outreach email address and custom SMTP. See [Custom SMTP Email](#19-custom-smtp-email).

### Bank/Payment Tab

Your bank account details for the payment section of proposals. See [Bank Details for Proposals](#20-bank-details-for-proposals).

### Goals Tab

Set your monthly income goal (in ₦). The Dashboard uses this to show your progress toward target.

### Rate Card Tab

Define your service packages and pricing. See [Rate Card Setup](#17-rate-card-setup).

### Portfolio Tab

Add portfolio pieces (project name, URL, screenshot, description). See [Portfolio Setup](#18-portfolio-setup).

### WhatsApp Tab

Configure WhatsApp Business API credentials. See [WhatsApp Business API Setup](#21-whatsapp-business-api-setup).

### Security Tab

- Change password
- Set up biometric login (Face ID / fingerprint)
- View active sessions
- See login history

---

## 17. Rate Card Setup

Your rate card is used in every proposal. Set it once in Settings → Rate Card.

### Packages

Define your main service tiers. Example:

| Package | Price | What's Included |
|---|---|---|
| Starter | ₦150,000 | 5-page website, mobile responsive, 2 revisions |
| Business | ₦350,000 | 10 pages, booking/contact form, 6 months support |
| E-commerce | ₦600,000 | Full online store, payment integration, 12 months support |

### Maintenance Plans

Monthly retainer options shown at the bottom of proposals:

| Plan | Price/month | What's Covered |
|---|---|---|
| Basic | ₦15,000/month | Hosting, security updates, 1 content update |
| Growth | ₦30,000/month | + Monthly SEO report, 5 content updates |

### Add-Ons

Individual extras a client can add to any package:
- Extra page: ₦20,000
- Logo design: ₦30,000
- Google Business profile setup: ₦15,000
- Social media setup: ₦25,000

### Payment Terms

State your payment structure — e.g. "50% upfront, 50% on delivery" or "30% deposit, 70% on launch."

---

## 18. Portfolio Setup

Add 3–5 portfolio pieces for the best proposals. Each piece needs:

| Field | Purpose |
|---|---|
| Project name | e.g. "Mama Put Restaurant, Surulere" |
| Project URL | Live website link |
| Screenshot URL | Image of the homepage |
| Description | 1–2 sentences: what you built, the result |
| Industry | So the proposal can show relevant work |

**Tip:** Always try to match portfolio pieces to the prospect's industry. A restaurant will respond better to seeing a food website than a law firm website.

---

## 19. Custom SMTP Email

Using your own email address (e.g. hello@youragency.com) makes outreach look professional. Emails from `noreply@runvax.com` go to spam.

### SMTP Setup

1. Settings → Email tab
2. Enter your SMTP details:
   - Host: e.g. `smtp.gmail.com` or `mail.youragency.com`
   - Port: 587 (STARTTLS) or 465 (SSL)
   - Username: your email address
   - Password: your email password or app password
   - From address: how your name appears to recipients
3. Click **Test Connection** — a test email is sent to verify it works
4. Save

### Gmail App Passwords

If using Gmail, you must use an App Password (not your regular password):
1. Google Account → Security → 2-Step Verification → App passwords
2. Select "Mail" and generate a password
3. Use that 16-character password in the SMTP Password field

---

## 20. Bank Details for Proposals

Your bank details appear in the payment section of every proposal so clients know how to pay you.

### What to Enter

| Field | Example |
|---|---|
| Bank name | First Bank Nigeria |
| Account number | 0123456789 |
| Account name | Ace Digital Services |
| Sort code | (optional) |

Settings → Bank/Payment tab.

---

## 21. WhatsApp Business API Setup

The WhatsApp Business API (from Meta) lets you send messages programmatically. This is more powerful than sending manually but requires setup.

### Requirements

- A Facebook Business Manager account
- A dedicated phone number (not your personal number)
- A verified business

### Setup Steps

1. Create an app at [Meta for Developers](https://developers.facebook.com)
2. Add the WhatsApp Business API product to your app
3. Follow Meta's guided setup to register your phone number
4. Copy your **Access Token** and **Phone Number ID** from the Meta dashboard
5. In Runvax → Settings → WhatsApp:
   - Paste your Access Token
   - Click **Connect** — Runvax fetches your registered numbers
   - Select your WhatsApp phone number
6. Save

### Creating Templates

WhatsApp requires approved templates for first messages to new contacts:

1. Settings → WhatsApp → Create Template
2. Name your template (e.g. `web_design_cold_outreach`)
3. Write your template text using `{{1}}` for variables
4. Submit for review
5. Check status in Settings → WhatsApp → Template Status
6. Meta approves most simple business templates within 24–72 hours

### Sending Without Templates

Once a prospect has messaged you (or replied to a template), you have a 24-hour window to send any message without a template. Runvax tracks this window and shows you which prospects are in an open conversation window.

---

## 22. Onboarding Quest Tracker

The Quest Tracker appears as a floating widget (bottom-right corner on desktop). It tracks your setup progress across 4 milestones:

| Quest | What to Do | Why It Matters |
|---|---|---|
| Set your profile | Fill name, agency, tagline in Settings | Used in every outreach message |
| Add profile picture | Upload photo in Settings → Profile | Builds trust in proposals |
| Configure email | Set email + SMTP in Settings → Email | Outreach emails look professional |
| Add portfolio | Add 1+ portfolio piece in Settings → Portfolio | Proposals have real proof |

Click any quest to jump directly to the relevant settings section.

Once all 4 are complete, the tracker collapses to "Setup Complete."

---

## 23. Daily Habit & Tracking

Runvax is most effective when used as a 10–15 minute daily habit.

### Recommended Daily Routine

1. **Search** (3 min) — One search: pick an industry and city you want to target today
2. **Review** (2 min) — Scan the top 5–10 results, open Business Drawers for the best prospects
3. **Save** (1 min) — Add the top 3 prospects to your pipeline
4. **Outreach** (5 min) — Generate and send a WhatsApp or email to each
5. **Follow up** (2 min) — Check pipeline for any prospects due for a follow-up today
6. **Log** (1 min) — The Daily Log counter auto-increments when you send outreach

### Daily Log

The dashboard shows your outreach count for each day. Use it as a streak tracker — even 3 messages/day compounds into 90+ prospects reached per month.

### Search History

Settings → Search History shows every search you've done with:
- How many businesses were returned
- What percentage had no website (hit rate)
- Your most productive industries and cities

Use this to double down on high-hit-rate searches.

---

## 24. Upgrading Your Plan

### Free Plan Limits

The Free plan gives you 5 searches per day, 20 results per search, 15 AI calls per day, and up to 30 saved prospects. It's enough to validate the product and land your first client.

### When to Upgrade

Upgrade to Pro when:
- You're consistently hitting the 5-search-per-day free limit
- You want to send AI proposals (Free plan doesn't include proposals)
- You want market briefs or website weakness analysis
- You need more than 30 saved prospects

### How to Upgrade

1. Click any upgrade prompt, or go to `/pricing`
2. Choose Pro (₦9,999/month) or Agency (₦24,999/month)
3. Click **Get Started** — you're redirected to Paystack checkout
4. Pay with your card or bank transfer
5. You're redirected back and your plan is instantly activated

Payment is processed by Paystack, Nigeria's leading payment gateway. Runvax never stores your card details.

### Cancellation

Contact support to cancel. You retain access until the end of your current billing period.

---

## 25. Account Security

### Email Verification

You must verify your email before searching. Check your inbox for the verification link after signup. If it didn't arrive, click **Resend Verification** on the verify page.

### Password

Change your password anytime in Settings → Security. Minimum 8 characters recommended; use a unique password not shared with other services.

### Biometric Login (Face ID / Fingerprint)

Set up fingerprint or Face ID login in Settings → Security → Biometric Login. This uses WebAuthn — your biometric data never leaves your device.

1. Click **Register Biometric Device**
2. Your browser prompts for fingerprint / Face ID
3. Future logins show a "Use Biometric" button on the sign-in page

### If Your Account Is Compromised

1. Change your password immediately in Settings → Security
2. Sign out of all sessions
3. Contact support if you see unauthorized activity

---

## 26. FAQ & Troubleshooting

**Why am I not getting search results?**  
Check that you've entered a valid industry and city. Very small towns may return no results — try a nearby larger city. Also confirm your daily search quota hasn't been reached (check Usage in your dashboard).

**My outreach message doesn't sound like me — can I edit it?**  
Yes. The Outreach Modal is a text editor — click anywhere in the message to edit before sending. You can also regenerate for a different style.

**The prospect's phone number isn't showing — can I still reach them?**  
Yes. If there's no phone number, use the Email option or search for their Facebook/Instagram page manually. Many Nigerian businesses respond well to direct Facebook messages.

**WhatsApp says my template was rejected — why?**  
Meta rejects templates that are too salesy, contain misleading claims, or use too many emojis. Rewrite it as a genuine, informational message. Avoid words like "FREE," "GUARANTEED," "URGENT."

**Can I export my pipeline?**  
Yes. On the Pipeline board, select all prospects (top-left checkbox) and click **Export CSV**. You get a spreadsheet with all prospect data, stages, and notes.

**I sent a message but can't track if it was read.**  
WhatsApp Business API provides delivery and read receipts in the API response. Runvax logs the send status. Read receipts depend on the recipient's WhatsApp privacy settings — if they have read receipts off, you won't see it.

**Can I use Runvax from my phone?**  
Yes. Runvax is a Progressive Web App (PWA). On iOS Safari or Android Chrome, tap **Add to Home Screen** to install it and use it like a native app.

**How do I add a new team member?**  
Currently, Runvax is single-user per account. Agency plan users can contact support about multi-seat access.

**My proposal PDF looks wrong — what should I check?**  
Make sure your rate card, portfolio, and bank details are all filled in Settings. Missing fields result in placeholder sections in the proposal.

**I didn't receive the verification email.**  
Check your spam folder first. If it's not there, click **Resend Verification** on the verify page. Gmail sometimes delays emails from new SMTP senders — wait 5 minutes before resending.

**How do I delete my account?**  
Contact support at softlineazeez123@gmail.com with your account email and we'll process the deletion within 48 hours. All your data is permanently removed.

---

## Quick Reference: Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Open search | `Ctrl/Cmd + K` |
| Save prospect | `S` (when a card is focused) |
| Generate outreach | `G` (when a prospect is open) |

---

## Support

For help, bug reports, or feature requests:
- Email: softlineazeez123@gmail.com
- Blog (tips & tutorials): `/blog`
- Pricing: `/pricing`

---

*Runvax is built for Nigerian web designers. Prices in ₦. Exchange rate reference: ₦1,400 = $1 USD.*
