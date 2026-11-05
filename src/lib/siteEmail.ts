/**
 * Pulling a contact email out of a page's HTML or text. Shared by the email finder routes.
 */

export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Domains that are never real business emails — platform noise
const SITE_NOISE = [
  'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com', 'yourdomain',
  'noreply', 'no-reply', 'donotreply', 'mailer', 'bounce',
  'schema.org', 'w3.org', 'openid', 'cloudflare', 'wordpress.com',
  'nairaland.com', 'jiji.ng', 'jiji.com', 'vconnect.com', 'businesslist.com.ng', 'businesslist.com',
  'facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'twitter.com',
  'google.com', 'googleapis.com', 'bing.com', 'microsoft.com', 'yahoo.com/help',
  'duckduckgo.com', 'duck.com', 'ddg.gg',
  'yellowpages.com', 'yellowpages.com.ng',
  '.png', '.jpg', '.gif', '.webp', '.svg', '.css', '.js',
];

const PREFERRED = /^(info|contact|hello|admin|sales|enquir|hi|support|mail|office|business|shop|store|clinic|hotel|salon|school|church|law|realtor|property|cater|event|manager|ceo|director|booking)/;

/** Every plausible address in the text, lowercased and de-duplicated, in the order found. */
export function listEmails(text: string, extraExclude: string[] = []): string[] {
  const raw = text.match(EMAIL_RE);
  if (!raw) return [];
  const exclude = [...SITE_NOISE, ...extraExclude];
  const filtered = raw
    .map((m) => m.toLowerCase().replace(/[.,;:'"<>\s]+$/, '').replace(/^[.,;:'"<>\s]+/, ''))
    .filter((m) => {
      if (!m.includes('@') || !m.includes('.')) return false;
      if (m.length < 6 || m.length > 80) return false;
      if (exclude.some((j) => m.includes(j))) return false;
      const parts = m.split('@');
      const local = parts[0];
      const domain = parts[1];
      if (!local || !domain || !domain.includes('.')) return false;
      if (local.length < 2 || domain.length < 4) return false;
      return true;
    });
  return Array.from(new Set(filtered));
}

export function pickEmail(text: string, extraExclude: string[] = []): string | null {
  const clean = listEmails(text, extraExclude);
  if (!clean.length) return null;
  return clean.find((m) => PREFERRED.test(m.split('@')[0])) ?? clean[0];
}

/** Cloudflare hides addresses as data-cfemail="hex": the first byte is a key XORed over the rest. */
function decodeCf(hex: string): string {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch { return ''; }
}

/** Makes addresses written to dodge scrapers readable again: Cloudflare protection, HTML entities, "name [at] site [dot] com". */
export function revealEmails(html: string): string {
  return html
    .replace(/data-cfemail="([0-9a-fA-F]{6,})"/g, (_m, hex: string) => ` ${decodeCf(hex)} `)
    .replace(/&#(?:64|x40);|&commat;|%40/gi, '@')
    .replace(/&#(?:46|x2e);/gi, '.')
    .replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, '.');
}

/**
 * The best address found on a business's OWN website. Its own domain is exactly what we want here
 * (info@theirclinic.com), so only platform noise is filtered, never the site's own domain.
 */
export function pickSiteEmail(html: string): string | null {
  return pickEmail(revealEmails(html));
}
