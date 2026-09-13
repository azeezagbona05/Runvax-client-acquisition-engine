if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production') {
  console.error(
    '[SEO] WARNING: NEXT_PUBLIC_SITE_URL is not set. ' +
    'All canonical URLs, sitemap entries, and OG tags will point to localhost:3000 in production. ' +
    'Set this env var on your host immediately.'
  );
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Runvax';

// ≤160 chars — leads with the category term, names the three offers and audiences
export const SITE_DESCRIPTION =
  'AI for client acquisition. Runvax finds local businesses that need a website, booking, or AI automation anywhere worldwide, then writes the outreach. Free plan.';
