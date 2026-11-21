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

const SECRET_PREFIX = 'enc:';
/** Encrypts a stored password (mailbox login). Values saved before encryption existed are plain text and still read back fine. */
export function sealSecret(plain: string): string { return `${SECRET_PREFIX}${seal(plain)}`; }
export function openSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(SECRET_PREFIX)) return stored; // legacy plain text, re-encrypted the next time it is saved
  const v = open<string>(stored.slice(SECRET_PREFIX.length));
  return typeof v === 'string' ? v : null;
}

/** Mail servers must be on the public internet: a customer-typed host must not be a way to probe this server's own network. Enforced in production only, so local testing against a dev mail server still works. */
export function isPublicMailHost(host: string): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const h = host.trim().toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':')) return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) { const [a, b] = [Number(m[1]), Number(m[2])]; return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)); }
  return true;
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
