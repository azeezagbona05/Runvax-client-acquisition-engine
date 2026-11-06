import crypto from 'node:crypto';

// ── Inbound replies (Meta webhook) ───────────────────────────────────────────

/** The token the user types into Meta when they register the webhook. Derived, so nothing extra is stored. */
export const verifyTokenFor = (userId: string): string => crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'x').update(`wa-verify:${userId}`).digest('hex').slice(0, 24);
export const webhookUrlFor = (userId: string): string => `${(process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')}/api/whatsapp/webhook/${userId}`;

/** True when `signature` ("sha256=…") is the HMAC of the raw body under the user's Meta app secret. */
export function signatureOk(raw: string, signature: string | null, appSecret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const want = crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = signature.slice(7);
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export interface WaInbound { from: string; id: string; text: string; at: Date }

/** Text messages from a Meta webhook payload for this phone number only. */
export function parseInbound(payload: unknown, phoneNumberId: string): WaInbound[] {
  const out: WaInbound[] = [];
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries) for (const c of ((e as { changes?: unknown[] }).changes ?? []) as Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ from?: string; id?: string; timestamp?: string; type?: string; text?: { body?: string }; button?: { text?: string } }> } }>) {
    const v = c.value;
    if (!v || v.metadata?.phone_number_id !== phoneNumberId) continue;
    for (const m of v.messages ?? []) {
      const text = m.type === 'text' ? m.text?.body : m.type === 'button' ? m.button?.text : undefined;
      if (!m.from || !m.id || !text?.trim()) continue;
      out.push({ from: m.from.replace(/\D/g, ''), id: m.id, text, at: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date() });
    }
  }
  return out;
}
