import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '@/lib/prisma';
import { ingestReply, logAgent, type IngestDeps } from '@/lib/acqReplies';

const LOOKBACK_DAYS = 14;
const MAX_MESSAGES = 100;

/** Mail servers usually name the reader smtp.x → imap.x. Settings has no separate IMAP host yet. */
export const imapHostFor = (smtpHost: string): string => (/^smtp\./i.test(smtpHost) ? smtpHost.replace(/^smtp\./i, 'imap.') : smtpHost);

export interface InboxCheck { ok: true; scanned: number; replies: number; duplicates: number } 

/**
 * Reads the user's mailbox (same login as their outgoing mail) and files replies from their campaign
 * contacts. Only messages whose sender is a contact in one of the user's campaigns are downloaded.
 */
export async function checkInbox(userId: string, deps: IngestDeps = {}): Promise<InboxCheck | { ok: false; error: string }> {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { smtpHost: true, smtpUser: true, smtpPass: true } });
  if (!s?.smtpHost || !s.smtpUser || !s.smtpPass) return { ok: false, error: 'Connect your mailbox in Settings → Email first. Replies are read with the same login.' };

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const leads = await prisma.outreachLead.findMany({
    where: { userId, status: { in: ['sent', 'unsubscribed'] }, sentAt: { not: null } },
    select: { id: true, email: true, sentAt: true }, orderBy: { sentAt: 'desc' }, take: 5000,
  });
  const byEmail = new Map<string, string>();
  for (const l of leads) if (!byEmail.has(l.email.toLowerCase())) byEmail.set(l.email.toLowerCase(), l.id);
  if (!byEmail.size) return { ok: true, scanned: 0, replies: 0, duplicates: 0 };

  const client = new ImapFlow({ host: imapHostFor(s.smtpHost), port: 993, secure: true, auth: { user: s.smtpUser, pass: s.smtpPass }, logger: false });
  let scanned = 0, replies = 0, duplicates = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const matches: number[] = [];
      for await (const m of client.fetch({ since }, { envelope: true, uid: true })) {
        scanned++;
        const from = m.envelope?.from?.[0]?.address?.toLowerCase();
        if (from && byEmail.has(from) && matches.length < MAX_MESSAGES) matches.push(m.uid);
      }
      for (const uid of matches) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const p = await simpleParser(msg.source);
        const from = p.from?.value?.[0]?.address?.toLowerCase();
        const leadId = from ? byEmail.get(from) : undefined;
        if (!leadId) continue;
        const r = await ingestReply({ userId, leadId, text: p.text ?? '', subject: p.subject ?? '', source: 'inbox', messageId: p.messageId ?? `uid-${uid}`, receivedAt: p.date ?? new Date() }, deps);
        if (r.ok) { if (r.duplicate) duplicates++; else replies++; }
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (e) {
    try { await client.logout(); } catch { /* already closed */ }
    return { ok: false, error: `Could not read your mailbox: ${e instanceof Error ? e.message.slice(0, 160) : 'connection failed'}` };
  }
  await logAgent(userId, 'reply', 'Checked your inbox', `${scanned} message${scanned === 1 ? '' : 's'} looked at, ${replies} new repl${replies === 1 ? 'y' : 'ies'}.`);
  return { ok: true, scanned, replies, duplicates };
}
