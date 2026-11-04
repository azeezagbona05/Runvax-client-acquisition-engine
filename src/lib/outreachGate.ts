import { isAcquisitionProspect } from '@/lib/acquisition/isolation';

/**
 * Browser-side gate for outreach links (wa.me, mailto:).
 *
 * A link opened by the browser never passes through a send route, so the only
 * place to stop it is before it is opened. Two layers, deliberately separate:
 *
 *  1. Render time: an Industry Acquisition prospect (by the `source` the server
 *     returned) gets a disabled control and an explanation. This only HIDES
 *     actions; it authorises nothing.
 *  2. Click time: the server is asked (POST /api/outreach/check, which reuses
 *     the same recipient and suppression matching as the send routes) before
 *     any link is opened. This is what catches a stale page, a suppressed
 *     contact, or an unsaved search result for an acquisition clinic.
 *
 * It fails closed: if the server can't be asked, nothing opens.
 *
 * Limit: this controls RUNVAX's own buttons. A person can always message a
 * clinic from their own phone or mailbox; no software here can prevent that.
 */

export type OutreachTarget = { businessId?: string; email?: string | null; phone?: string | null };
export type OpenResult = { ok: true } | { ok: false; message: string; duplicate?: true };
export type OutreachVerdict = { allowed: true } | { allowed: false; code: string; message: string };

export const ACQUISITION_NOTICE =
  'This clinic is managed by Industry Acquisition. Contact it only through the approved pitch in the acquisition review queue.';
const CHECK_FAILED: OutreachVerdict = {
  allowed: false, code: 'check_unavailable',
  message: 'Could not confirm this contact may be messaged, so nothing was opened. Please try again.',
};
const POPUP_BLOCKED = 'Your browser blocked the new tab. Allow pop-ups for this site and try again.';

/** For rendering only: never use this to decide that something may be sent. */
export function isAcquisitionManaged(p?: { source?: string | null } | null): boolean {
  return !!p && isAcquisitionProspect(p);
}

// A link that is already being checked/opened ignores further requests for it, so repeated clicks
// (double-click, impatient taps) cannot open the same chat twice or log the same send twice.
const inFlight = new Set<string>();
const DUPLICATE: { ok: false; message: string; duplicate: true } = { ok: false, message: '', duplicate: true };
async function once<T extends { ok: boolean }>(key: string, run: () => Promise<T>): Promise<T | typeof DUPLICATE> {
  if (inFlight.has(key)) return DUPLICATE;
  inFlight.add(key);
  try { return await run(); } finally { inFlight.delete(key); }
}

const CHECK_TIMEOUT_MS = 10_000; // a hung server must not leave a blank tab open indefinitely
const CHUNK = 100; // the route accepts at most 100 targets per request

export async function checkOutreach(targets: OutreachTarget[]): Promise<OutreachVerdict[]> {
  const out: OutreachVerdict[] = [];
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    try {
      const res = await fetch('/api/outreach/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: chunk.map((t) => ({ businessId: t.businessId || undefined, email: t.email || undefined, phone: t.phone || undefined })) }),
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      const json = await res.json().catch(() => null) as { results?: OutreachVerdict[] } | null;
      if (!res.ok || !Array.isArray(json?.results) || json!.results!.length !== chunk.length) throw new Error('bad response');
      out.push(...json!.results!);
    } catch {
      out.push(...chunk.map(() => CHECK_FAILED));
    }
  }
  return out;
}

/**
 * Opens a link only if the server allows it. The tab is opened immediately, inside
 * the user's click (so pop-up blockers allow it), and is closed again if refused.
 */
export function openOutreach(url: string, target: OutreachTarget): Promise<OpenResult> {
  return once(url, () => openOutreachNow(url, target));
}
async function openOutreachNow(url: string, target: OutreachTarget): Promise<OpenResult> {
  const win = window.open('', '_blank');
  const [verdict] = await checkOutreach([target]);
  if (!verdict.allowed) { win?.close(); return { ok: false, message: verdict.message }; }
  if (!win) return { ok: false, message: POPUP_BLOCKED };
  try { win.opener = null; } catch { /* not critical */ }
  win.location.href = url;
  return { ok: true };
}

/**
 * For tel: links, which open the phone app rather than a tab: the server is asked first, then the
 * current page navigates to the link (no blank tab is left behind).
 */
export function followOutreach(url: string, target: OutreachTarget): Promise<OpenResult> {
  return once(url, () => followOutreachNow(url, target));
}
async function followOutreachNow(url: string, target: OutreachTarget): Promise<OpenResult> {
  const [verdict] = await checkOutreach([target]);
  if (!verdict.allowed) return { ok: false, message: verdict.message };
  window.location.href = url;
  return { ok: true };
}

/** Same, for several links at once (one server check). Refused or failed targets are reported by index. */
export async function openOutreachBatch(items: Array<{ url: string; target: OutreachTarget }>): Promise<{ opened: number[]; blocked: Array<{ index: number; message: string }> }> {
  const key = 'batch:' + items.map((i) => i.url).join('|');
  const r = await once(key, async () => ({ ok: true as const, ...(await openOutreachBatchNow(items)) }));
  return 'opened' in r ? { opened: r.opened, blocked: r.blocked } : { opened: [], blocked: [] };
}
async function openOutreachBatchNow(items: Array<{ url: string; target: OutreachTarget }>): Promise<{ opened: number[]; blocked: Array<{ index: number; message: string }> }> {
  const wins = items.map(() => window.open('', '_blank'));
  const verdicts = await checkOutreach(items.map((i) => i.target));
  const opened: number[] = [];
  const blocked: Array<{ index: number; message: string }> = [];
  items.forEach((item, index) => {
    const v = verdicts[index];
    const win = wins[index];
    if (!v.allowed) { win?.close(); blocked.push({ index, message: v.message }); return; }
    if (!win) { blocked.push({ index, message: POPUP_BLOCKED }); return; }
    try { win.opener = null; } catch { /* not critical */ }
    win.location.href = item.url;
    opened.push(index);
  });
  return { opened, blocked };
}

/** One message for the user, however many were refused. */
export function reportBlocked(blocked: Array<{ message: string }>): void {
  const shown = blocked.filter((b) => b.message);
  if (shown.length === 0) return; // a repeated click on a link already being opened says nothing
  blocked = shown;
  const unique = Array.from(new Set(blocked.map((b) => b.message)));
  window.alert(blocked.length === 1 ? unique[0] : `${blocked.length} contacts were not opened.\n\n${unique.join('\n')}`);
}
