import crypto from 'node:crypto';

/**
 * Signed one-click unsubscribe links for promotional email. The token is an HMAC of the user id,
 * so a link can only unsubscribe the account it was issued for and cannot be guessed.
 */
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is required to sign unsubscribe links');
  return s;
}

export function unsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  try {
    const a = Buffer.from(unsubscribeToken(userId));
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export function unsubscribeUrl(appUrl: string, userId: string): string {
  return `${appUrl}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}
