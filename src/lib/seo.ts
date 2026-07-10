if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production') {
  console.error(
    '[SEO] WARNING: NEXT_PUBLIC_SITE_URL is not set. ' +
    'All canonical URLs, sitemap entries, and OG tags will point to localhost:3000 in production. ' +
    'Set this env var on your host immediately.'
  );
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Runvax';

// 163 chars — includes location keywords, CTA, removes friction
export const SITE_DESCRIPTION =
  'Find local businesses with no website in Lagos, Accra, Nairobi, London, or anywhere worldwide. Generate AI cold emails in one click. Free plan — no card needed.';
