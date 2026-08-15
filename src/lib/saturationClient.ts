import { isTrackableBusinessId, type Saturation } from '@/lib/saturation';

// Browser-side calls into /api/outreach-signal. Every function here fails soft:
// the tracker is an additive signal, so a network error should degrade the badge,
// never break a search or block a send.

/** Fired after a send is reported, so any mounted badge can update itself
 *  without ProspectsContext needing to know the saturation cache exists. */
export const OUTREACH_SENT_EVENT = 'runvax:outreach-sent';

/** Report a send to the shared tracker. Never throws, never awaited by callers. */
export async function recordSaturationSend(
  businessId: string,
  channel: string,
): Promise<void> {
  if (!isTrackableBusinessId(businessId)) return;

  // Announce immediately — the badge shouldn't wait on the round trip.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OUTREACH_SENT_EVENT, { detail: { businessId } }));
  }

  try {
    await fetch('/api/outreach-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, channel }),
    });
  } catch {
    // non-critical — the send itself already happened
  }
}

/** Batch-fetch saturation. Returns {} on any failure so callers can spread safely. */
export async function fetchSaturation(
  businessIds: string[],
): Promise<Record<string, Saturation>> {
  const ids = Array.from(new Set(businessIds.filter(isTrackableBusinessId)));
  if (ids.length === 0) return {};
  try {
    const res = await fetch(`/api/outreach-signal?ids=${encodeURIComponent(ids.join(','))}`);
    if (!res.ok) return {};
    return await res.json() as Record<string, Saturation>;
  } catch {
    return {};
  }
}
