import crypto from 'node:crypto';

/** Keys are encrypted at rest with a key derived from NEXTAUTH_SECRET. Format: v1.iv.tag.data (base64url). */
function key(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set.');
  return crypto.createHash('sha256').update(`integrations:${s}`).digest();
}

export function seal(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function open<T = Record<string, string>>(sealed: string | null | undefined): T | null {
  if (!sealed) return null;
  try {
    const [v, iv, tag, data] = sealed.split('.');
    if (v !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')) as T;
  } catch { return null; }
}
