import { prisma } from '@/lib/prisma';
import { defaultDiscovery, defaultPermissions, defaultPreferences, deployIssues, sanitizeDiscovery, sanitizePermissions, sanitizePreferences, sanitizeProfile } from './types';

/** Every read here is keyed by the signed-in user's id, so one user's career data can never reach another's agent, campaigns or leads. */
export async function logEvent(userId: string, agent: string, action: string, detail?: string, ok = true) {
  try { await prisma.careerAgentEvent.create({ data: { userId, agent, action, detail: detail?.slice(0, 400), ok } }); } catch { /* the log must never break the action */ }
}

export async function loadCareer(userId: string) {
  const [prof, docs, pref, events] = await Promise.all([
    prisma.careerProfile.findUnique({ where: { userId } }),
    prisma.careerDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, kind: true, name: true, chars: true, createdAt: true } }),
    prisma.careerPreference.findUnique({ where: { userId } }),
    prisma.careerAgentEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 40 }),
  ]);
  const preferences = pref ? sanitizePreferences(pref.preferences) : defaultPreferences();
  const discovery = pref ? sanitizeDiscovery(pref.discovery) : defaultDiscovery();
  const permissions = pref ? sanitizePermissions(pref.permissions) : defaultPermissions();
  const profile = prof ? sanitizeProfile(prof.profile) : null;
  return {
    profile, profileSource: prof?.source ?? null, profileConfirmed: !!prof?.confirmedAt,
    documents: docs, preferences, discovery, permissions,
    status: (pref?.status ?? 'draft') as 'draft' | 'active' | 'paused', deployedAt: pref?.deployedAt ?? null,
    issues: deployIssues({ hasProfile: !!profile, profileConfirmed: !!prof?.confirmedAt, prefs: preferences, discovery }),
    events,
  };
}
