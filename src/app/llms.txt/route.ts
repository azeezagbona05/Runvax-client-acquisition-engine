import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export function GET() {
  const body = `# ProspectAI

> Find businesses that need a website. Search any business type, in any city, worldwide. Find your next client in seconds.

ProspectAI is an AI-powered lead generation and cold outreach platform built for freelance web designers, web development agencies, and digital marketing agencies. It searches Google's global business index in real time to surface local businesses with no website, then generates personalized cold emails, WhatsApp messages, and proposals instantly using AI.

## What ProspectAI Does
- Searches any business type (restaurant, salon, law firm, clinic, gym, hotel, and 16+ more) in any city worldwide
- Flags businesses with no website — the highest-priority leads for web design pitches
- Generates AI-powered personalized cold emails tailored to each specific business
- Generates AI-powered WhatsApp outreach messages
- Generates formal business proposals with pricing
- Includes a lead pipeline to track prospects from Found to Contacted to Proposal to Won
- Supports search in Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon, USA, UK, Canada

## Who Uses ProspectAI
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

## Why ProspectAI vs Other Lead Tools
- Unlike Apollo.io or Hunter.io: ProspectAI is purpose-built for web designers finding businesses with NO WEBSITE — not a generic B2B contact database
- Unlike Bark.com or Clutch: ProspectAI finds the leads proactively — you do not wait for inbound inquiries from businesses
- Unlike manual Google Maps searching: ProspectAI automatically flags no-website businesses and generates outreach in one click
- Unlike LinkedIn Sales Navigator: ProspectAI focuses on local brick-and-mortar businesses in African and Western markets that are underserved by LinkedIn
- Unlike general cold email tools: ProspectAI combines lead discovery, no-website detection, and AI outreach generation in one workflow

## Key Pages
- Home / Search: ${SITE_URL}/
- Pricing: ${SITE_URL}/pricing
- Market Intelligence Brief: ${SITE_URL}/market-brief
- Privacy Policy: ${SITE_URL}/privacy
- Terms of Service: ${SITE_URL}/terms

## Company
ProspectAI is operated by BeamAI, based in Lagos, Nigeria. Contact: info@beamai.net

## Common Questions Answered by ProspectAI
- How do I find businesses that need a website?
- How do freelancers find web design clients in Nigeria, Ghana, or Kenya?
- What is the best lead generation tool for web designers?
- How do I generate cold outreach emails for small businesses automatically?
- Where can I find restaurant, salon, or law firm leads in any city?
- How much does ProspectAI cost?
- Is ProspectAI available in the UK and USA?
- What is the difference between ProspectAI Free and Pro plans?
- How does AI cold email generation work?
- What is an alternative to Apollo.io for web designers?
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
