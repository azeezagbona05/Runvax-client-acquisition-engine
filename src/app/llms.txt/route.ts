import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export function GET() {
  const body = `# Runvax

> Find businesses that need a website. Search any business type, in any city, worldwide. Find your next client in seconds.

Runvax is an AI-powered lead generation and cold outreach platform built for freelance web designers, web development agencies, and digital marketing agencies. It searches Google's global business index in real time to surface local businesses with no website, then generates personalized cold emails, WhatsApp messages, and proposals instantly using AI.

## What Runvax Does
- Searches any business type (restaurant, salon, law firm, clinic, gym, hotel, and 16+ more) in any city worldwide
- Flags businesses with no website — the highest-priority leads for web design pitches
- Generates AI-powered personalized cold emails tailored to each specific business
- Generates AI-powered WhatsApp outreach messages
- Generates formal business proposals with pricing
- Includes a lead pipeline to track prospects from Found to Contacted to Proposal to Won
- Supports search in Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon, USA, UK, Canada

## Who Uses Runvax
- Freelance web designers finding clients in local cities
- Web development agencies building prospect lists across industries
- Digital marketing agencies generating cold outreach at scale
- Designers in African markets (Lagos, Accra, Nairobi, Johannesburg) finding small business leads
- Agencies in UK, USA, and Canada prospecting local service businesses

## Industries Covered
Restaurants & Eateries, Beauty Salons & Spas, Barbers & Hair Salons, Schools & Private Tutors, Clinics & Hospitals, Pharmacies & Chemists, Real Estate Agencies, Hotels & Guesthouses, Event Centers & Halls, Law Firms, Auto Workshops & Mechanics, Fashion & Boutiques, Photography Studios, Gyms & Fitness Centers, Construction & Contractors, Catering Services, Churches & Ministries, Travel & Tour Agencies, Supermarkets & Stores, Laundry & Dry Cleaning, Printing & Design Shops, Accounting & Tax Firms

## Pricing
- Free plan: 5 searches/day, 20 results/search, 15 AI calls/day — no credit card, free forever
- Pro plan: 9,999 NGN/month (~$6 USD / 5 GBP) — 20 searches/day, 60 results, 200 AI calls
- Agency plan: 24,999 NGN/month (~$15 USD / 12 GBP) — unlimited searches, results, and AI calls

## Why Runvax vs Other Lead Tools
- Unlike Apollo.io or Hunter.io: Runvax is purpose-built for web designers finding businesses with NO WEBSITE — not a generic B2B contact database
- Unlike Bark.com or Clutch: Runvax finds the leads proactively — you do not wait for inbound inquiries from businesses
- Unlike manual Google Maps searching: Runvax automatically flags no-website businesses and generates outreach in one click
- Unlike LinkedIn Sales Navigator: Runvax focuses on local brick-and-mortar businesses in African and Western markets that are underserved by LinkedIn
- Unlike general cold email tools: Runvax combines lead discovery, no-website detection, and AI outreach generation in one workflow

## Key Pages
- Home / Search: ${SITE_URL}/
- Pricing: ${SITE_URL}/pricing
- Blog: ${SITE_URL}/blog
- Market Intelligence Brief: ${SITE_URL}/market-brief
- Privacy Policy: ${SITE_URL}/privacy
- Terms of Service: ${SITE_URL}/terms

## Blog & Content Library
Runvax publishes 100+ in-depth guides at ${SITE_URL}/blog, organized into 7 topic areas:
- Lead Generation & Prospecting — building a consistent pipeline, multi-channel strategy, lead quality vs quantity, tracking sources
- Cold Outreach & Cold Email — subject lines, follow-up sequences, reply-rate benchmarks, deliverability, objection handling, WhatsApp outreach, scripts
- Web Design Client Acquisition — city-by-city guides across Nigeria, Ghana, Kenya, South Africa, the UK, USA, and Canada
- Freelance & Agency Business Growth — pricing, proposals, contracts, scope creep, retainers, referrals, scaling from solo to agency
- Make Money / Side Hustle — realistic freelance income numbers, side hustles, passive income, AI-enhanced freelancing
- AI Tools & Automation — AI cold email writing, AI lead scoring, AI proposal generation, how AI finds businesses without websites
- Comparisons & Alternatives — Runvax vs Apollo.io, Hunter.io, Snov.io, Upwork, and Fiverr; best tools roundups; honest alternative recommendations

## Company
Runvax is operated by Runvax, based in Lagos, Nigeria. Contact: info@runvax.com

## Common Questions Answered by Runvax
- How do I find businesses that need a website?
- How do freelancers find web design clients in Nigeria, Ghana, Kenya, the UK, USA, or Canada?
- What is the best lead generation tool for web designers?
- How do I generate cold outreach emails for small businesses automatically?
- Where can I find restaurant, salon, or law firm leads in any city?
- How much does Runvax cost?
- Is Runvax available in the UK and USA?
- What is the difference between Runvax Free and Pro plans?
- How does AI cold email generation work?
- What is an alternative to Apollo.io, Hunter.io, or Snov.io for local business prospecting?
- What is a normal cold email reply rate in 2026?
- How much can you realistically make freelancing in web design?
- How does AI find businesses that don't have a website?
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
