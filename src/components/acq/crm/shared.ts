export async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: true; j: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, init ? { ...init, headers: { 'Content-Type': 'application/json' } } : undefined);
    const j = await r.json().catch(() => ({})) as T & { error?: string };
    return r.ok ? { ok: true, j } : { ok: false, error: j.error ?? 'That did not work.' };
  } catch { return { ok: false, error: 'Could not reach the server.' }; }
}
export const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
export const STAGES: Array<[string, string]> = [['identified', 'Identified'], ['contacted', 'Contacted'], ['engaged', 'Engaged'], ['interested', 'Interested'], ['demo_booked', 'Meeting booked'], ['proposal_sent', 'Proposal sent'], ['customer', 'Customer'], ['lost', 'Lost']];
export const stageLabel = (s: string) => STAGES.find((x) => x[0] === s)?.[1] ?? s;
export const MANUAL: Array<[string, string]> = [['demo_booked', 'Meeting booked'], ['proposal_sent', 'Proposal sent'], ['customer', 'Customer'], ['lost', 'Lost']];
export const ago = (iso: string | null) => { if (!iso) return 'never'; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
export const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '');
export interface Person { id: string; name: string | null; email: string; role: string }
export const who = (p: Person) => p.name || p.email;
