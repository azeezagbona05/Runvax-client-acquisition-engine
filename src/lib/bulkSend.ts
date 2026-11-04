/**
 * Bulk WhatsApp API send from the search page. The server route decides who may be messaged
 * (acquisition clinics 409, suppressed 403, errors 4xx/5xx); this reports each outcome instead of
 * treating every response as success.
 */
export type BulkTarget = { name: string; phone: string };
export type BulkFailure = { name: string; status: number; message: string };
export type BulkResult = { sent: number; failed: BulkFailure[]; stopped?: string };

export async function sendWhatsAppBulk(
  targets: BulkTarget[],
  opts: { delayMs?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<BulkResult> {
  const { delayMs = 3000, onProgress } = opts;
  const result: BulkResult = { sent: 0, failed: [] };
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: t.phone, businessName: t.name }),
      });
      if (res.ok) result.sent++;
      else {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        const message = j?.error || `The server refused this message (HTTP ${res.status}).`;
        result.failed.push({ name: t.name, status: res.status, message });
        if (res.status === 401) { result.stopped = 'You are signed out. Sign in again; remaining messages were not sent.'; onProgress?.(i + 1, targets.length); break; }
      }
    } catch {
      result.failed.push({ name: t.name, status: 0, message: 'Network error; this message may not have been sent.' });
    }
    onProgress?.(i + 1, targets.length);
    if (i < targets.length - 1 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return result;
}

export function summarizeBulk(total: number, r: BulkResult): string {
  const lines = [`Sent ${r.sent} of ${total}.`];
  if (r.failed.length) {
    lines.push(`${r.failed.length} not sent:`);
    for (const f of r.failed.slice(0, 10)) lines.push(`• ${f.name}: ${f.message}`);
    if (r.failed.length > 10) lines.push(`…and ${r.failed.length - 10} more.`);
  }
  if (r.stopped) lines.push(r.stopped);
  return lines.join('\n');
}
