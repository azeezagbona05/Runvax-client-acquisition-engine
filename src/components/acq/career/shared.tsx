'use client';

import type { CareerProfileData, Discovery, Permissions, Preferences } from '@/lib/career/types';

export interface CareerState {
  /** What was read from the CV, untouched. Edits and rewrites never change it, so any field can go back to it. */
  baseline: CareerProfileData | null;
  profile: CareerProfileData | null; profileSource: string | null; profileConfirmed: boolean;
  documents: Array<{ id: string; kind: string; name: string; chars: number; createdAt: string }>;
  preferences: Preferences; discovery: Discovery; permissions: Permissions;
  status: 'draft' | 'active' | 'paused'; deployedAt: string | null; issues: string[];
  events: Array<{ id: string; agent: string; action: string; detail: string | null; ok: boolean; createdAt: string }>;
}

export async function api<T = CareerState>(url: string, init?: RequestInit): Promise<T & { error?: string }> {
  try {
    const r = await fetch(url, init); const j = await r.json().catch(() => ({}));
    return (r.ok ? j : { error: j.error || 'Something went wrong. Please try again.' }) as T & { error?: string };
  } catch { return { error: 'Could not reach the server. Check your connection.' } as T & { error?: string }; }
}
export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 } as const;
export const hint = { fontSize: 12, color: '#64748b', marginTop: 4 } as const;
export const box = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff' } as const;
export const AGENT_NAMES: Record<string, string> = { orchestrator: 'Career Orchestrator', cv_intelligence: 'CV Intelligence', cv_designer: 'CV Designer', application_writer: 'Application Writer', job_discovery: 'Job Discovery', job_matching: 'Job Matching' };

export function Field({ label, hint: h, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={lbl}>{label}</span>{children}{h && <span style={{ ...hint, display: 'block' }}>{h}</span>}</label>;
}
export const lines = (a: string[]) => a.join('\n');
export const fromLines = (t: string) => t.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
