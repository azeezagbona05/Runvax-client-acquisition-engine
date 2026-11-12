import { prisma } from '@/lib/prisma';
import { defaultDiscovery, defaultPermissions, defaultPreferences, deployIssues, sanitizeDiscovery, sanitizePermissions, sanitizePreferences, sanitizeProfile } from './types';

/** Every read here is keyed by the signed-in user's id, so one user's career data can never reach another's agent, campaigns or leads. */
export async function logEvent(userId: string, agent: string, action: string, detail?: string, ok = true) {
  try { await prisma.careerAgentEvent.create({ data: { userId, agent, action, detail: detail?.slice(0, 400), ok } }); } catch { /* the log must never break the action */ }
}

export async function loadCareer(userId: string) {
  const [prof, docs, pref, events, base] = await Promise.all([
    prisma.careerProfile.findUnique({ where: { userId } }),
    prisma.careerDocument.findMany({ where: { userId, kind: 'uploaded' }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, kind: true, name: true, chars: true, createdAt: true } }),
    prisma.careerPreference.findUnique({ where: { userId } }),
    prisma.careerAgentEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.careerDocument.findFirst({ where: { userId, kind: 'baseline' }, orderBy: { createdAt: 'desc' }, select: { text: true } }),
  ]);
  const preferences = pref ? sanitizePreferences(pref.preferences) : defaultPreferences();
  const discovery = pref ? sanitizeDiscovery(pref.discovery) : defaultDiscovery();
  const permissions = pref ? sanitizePermissions(pref.permissions) : defaultPermissions();
  const profile = prof ? sanitizeProfile(prof.profile) : null;
  let baseline = null as ReturnType<typeof sanitizeProfile> | null;
  try { baseline = base ? sanitizeProfile(JSON.parse(base.text)) : null; } catch { baseline = null; }
  return {
    baseline, profile, profileSource: prof?.source ?? null, profileConfirmed: !!prof?.confirmedAt,
    documents: docs, preferences, discovery, permissions,
    status: (pref?.status ?? 'draft') as 'draft' | 'active' | 'paused', deployedAt: pref?.deployedAt ?? null,
    issues: deployIssues({ hasProfile: !!profile, profileConfirmed: !!prof?.confirmedAt, prefs: preferences, discovery }),
    events,
  };
}
