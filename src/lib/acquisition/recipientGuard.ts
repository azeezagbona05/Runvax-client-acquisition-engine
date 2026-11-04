import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { findSuppressionHits, normalizeEmail, SuppressionKeyError } from './suppression';
import { registrableDomain } from './web/url';
import { isAcquisitionProspect } from './isolation';

/**
 * Server-side recipient check for RUNVAX's existing outbound routes
 * (/api/send-email, /api/proposal/send-email, /api/whatsapp/send).
 *
 * Industry Acquisition clinics are stored as ordinary CRM prospects, so the
 * Pipeline's email and WhatsApp buttons work on them. Those routes know only
 * the recipient, not the prospect, so the check is by recipient:
 *
 *  1. A recipient that belongs to an Industry Acquisition clinic is refused
 *     outright (409). The engine's approval gate and review queue are the only
 *     way to reach those clinics, and the engine has no send path.
 *  2. A recipient on this account's suppression list (opted out, objected,
 *     erased) is refused (403), whoever the recipient belongs to.
 *
 * Ordinary prospects are untouched: with no engine data the check finds
 * nothing and allows the send. It is data-based, not flag-based, so turning
 * the feature flag off cannot reopen the path for clinics already imported.
 *
 * Browser-opened wa.me and mailto: links never reach the server, so no
 * server-side check can cover them; they send nothing from RUNVAX.
 */

export type RecipientVerdict =
  | { allowed: true }
  | { allowed: false; status: 403 | 409 | 503; code: 'acquisition_managed' | 'suppressed' | 'check_unavailable'; message: string };

const MANAGED: RecipientVerdict = {
  allowed: false, status: 409, code: 'acquisition_managed',
  message: 'This clinic is managed by Industry Acquisition and can’t be messaged from here. Messages to it go through the acquisition review queue.',
};
const SUPPRESSED: RecipientVerdict = {
  allowed: false, status: 403, code: 'suppressed',
  message: 'This recipient has opted out or been suppressed, so nothing was sent.',
};
const UNAVAILABLE: RecipientVerdict = {
  allowed: false, status: 503, code: 'check_unavailable',
  message: 'Could not confirm this recipient may be contacted, so nothing was sent. Please try again.',
};

const acquisitionFlagOn = () => process.env.INDUSTRY_ACQUISITION_ENABLED === 'true';

// Prisma: the acquisition tables (or a column) do not exist yet, i.e. the
// feature's migrations have not been applied, so there is no engine data.
const notInstalled = (err: unknown) => ['P2021', 'P2022'].includes((err as { code?: string })?.code ?? '');

export async function checkRecipient(userId: string, r: { email?: string | null; phone?: string | null }): Promise<RecipientVerdict> {
  const email = r.email ? normalizeEmail(r.email) : '';
  const phone = r.phone ? normalizePhone(r.phone) : '';
  if (!email && !phone) return { allowed: true };

  try {
    // 1. Does the recipient belong to an engine clinic?
    if (email) {
      if (await prisma.acquisitionDecisionMaker.findFirst({ where: { userId, email }, select: { id: true } })) return MANAGED;
      let domain: string | null = null;
      try { domain = registrableDomain(email.split('@')[1] ?? ''); } catch { domain = null; }
      if (domain && await prisma.acquisitionProspect.findFirst({ where: { userId, orgDomain: domain }, select: { id: true } })) return MANAGED;
    }
    if (phone.length >= 9 && await prisma.acquisitionIdentity.findFirst({ where: { userId, kind: 'phone', value: phone }, select: { id: true } })) return MANAGED;

    // 2. Is the recipient suppressed?
    try {
      const hits = await findSuppressionHits(userId, { email: email || undefined, phone: phone || undefined });
      if (hits.length > 0) return SUPPRESSED;
    } catch (err) {
      if (!(err instanceof SuppressionKeyError)) throw err;
      // No suppression key: nothing can have been suppressed (the engine fails closed without one).
      // But if the feature is on, a missing key is a misconfiguration: refuse rather than guess.
      if (acquisitionFlagOn()) return UNAVAILABLE;
    }
    return { allowed: true };
  } catch (err) {
    if (notInstalled(err)) return { allowed: true };
    console.error('[recipient guard] check failed; refusing the send:', err instanceof Error ? err.message : String(err));
    return UNAVAILABLE;
  }
}

/**
 * Whether an account may open an outreach link (wa.me, mailto:) for a target.
 * Used by the browser before it opens such a link, so the decision comes from
 * the server, not from what the page happens to believe: a stale page, a
 * suppressed contact, or an unsaved search result for an acquisition clinic is
 * all caught here.
 *
 * Reuses checkRecipient() for every contact match, so domain, subdomain, phone
 * and suppression matching are identical to the send routes. In addition, a
 * saved prospect that IS an acquisition clinic (its source, or its linked
 * acquisition record) is refused even if it has no contact details here.
 *
 * Scoped to the caller's own prospects: it reveals nothing about anyone else.
 */
export async function checkOutreachTarget(
  userId: string,
  t: { businessId?: string | null; email?: string | null; phone?: string | null },
): Promise<RecipientVerdict> {
  let stored: { email?: string; phone?: string } = {};
  try {
    if (t.businessId) {
      const prospect = await prisma.prospect.findUnique({
        where: { userId_businessId: { userId, businessId: t.businessId } },
        select: { id: true, source: true, businessData: true },
      });
      if (prospect) {
        if (isAcquisitionProspect(prospect)) return MANAGED;
        try {
          if (await prisma.acquisitionProspect.findFirst({ where: { userId, prospectId: prospect.id }, select: { id: true } })) return MANAGED;
        } catch (err) {
          if (!notInstalled(err)) throw err;
        }
        const data = (prospect.businessData ?? {}) as { email?: unknown; phone?: unknown; phoneIntl?: unknown };
        if (typeof data.email === 'string') stored.email = data.email;
        const phone = typeof data.phoneIntl === 'string' && data.phoneIntl ? data.phoneIntl : data.phone;
        if (typeof phone === 'string') stored.phone = phone;
      }
    }
  } catch (err) {
    if (notInstalled(err)) stored = {};
    else {
      console.error('[outreach check] lookup failed; refusing:', err instanceof Error ? err.message : String(err));
      return UNAVAILABLE;
    }
  }

  // Check what the page supplied AND what the server holds; either can be blocked.
  const candidates = [
    { email: t.email ?? undefined, phone: t.phone ?? undefined },
    { email: stored.email, phone: stored.phone },
  ].filter((c) => c.email || c.phone);
  // Managed outranks suppressed, so look at every candidate for a managed match before settling for a suppressed one.
  let suppressed: RecipientVerdict | null = null;
  for (const c of candidates) {
    const v = await checkRecipient(userId, c);
    if (v.allowed) continue;
    if (v.code === 'acquisition_managed') return v;
    suppressed ??= v;
  }
  return suppressed ?? { allowed: true };
}
