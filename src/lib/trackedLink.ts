import crypto from 'node:crypto';

/**
 * Click-tracking links: /api/oc/click/<lead token>?u=<destination>&s=<signature>.
 * The signature covers the token and the destination, so the redirect can only ever go where
 * a campaign email put it. Without it the endpoint would be an open redirect anyone could
 * use to make phishing links look like they come from RUNVAX.
 */
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is required to sign tracked links');
  return s;
}

const sign = (token: string, url: string) =>
  crypto.createHmac('sha256', secret()).update(`click:${token}:${url}`).digest('hex').slice(0, 32);

export function trackedLink(appUrl: string, token: string, url: string): string {
  return `${appUrl}/api/oc/click/${token}?u=${encodeURIComponent(url)}&s=${sign(token, url)}`;
}

/** The destination when the signature is valid and it is a web link; otherwise null. */
export function verifyTrackedLink(token: string, url: string, sig: string): string | null {
  try {
    if (!/^https?:\/\//i.test(url) || url.length > 2000) return null;
    const a = Buffer.from(sign(token, url));
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? url : null;
  } catch { return null; }
}
