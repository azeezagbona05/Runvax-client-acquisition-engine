/** Which employer forms the agent may ever open. An exact host allow-list: nothing else is visited, whatever a job listing says. */
export type Platform = 'greenhouse' | 'lever';
export const ALLOWED_HOSTS: Record<string, Platform> = {
  'job-boards.greenhouse.io': 'greenhouse', 'boards.greenhouse.io': 'greenhouse',
  'jobs.lever.co': 'lever', 'jobs.eu.lever.co': 'lever',
};
export const PLATFORM_LABEL: Record<Platform, string> = { greenhouse: 'Greenhouse', lever: 'Lever' };

export interface Target { platform: Platform; applyUrl: string }

/** The hosted application form for a stored listing, or null when it has none the agent supports. */
export function targetFor(l: { source: string; externalId: string; url: string }): Target | null {
  try {
    if (l.source === 'greenhouse') {
      const m = l.externalId.match(/^([a-z0-9_-]{1,60})\/(\d{3,15})$/i);                 // "board/jobId" (kept by discovery)
      if (!m) return null;
      return { platform: 'greenhouse', applyUrl: `https://job-boards.greenhouse.io/${m[1]}/jobs/${m[2]}` };
    }
    if (l.source === 'lever') {
      const u = new URL(l.url);
      if (u.protocol !== 'https:' || ALLOWED_HOSTS[u.hostname] !== 'lever' || !/^\/[a-z0-9_-]+\/[0-9a-f-]{36}\/?$/i.test(u.pathname)) return null;
      return { platform: 'lever', applyUrl: `https://${u.hostname}${u.pathname.replace(/\/$/, '')}/apply` };
    }
  } catch { /* not a URL */ }
  return null;
}

/** Throws unless the URL is https on an allowed host (or a host the caller explicitly allows, used only by tests with a local fixture). */
export function assertAllowed(url: string, extraHosts: string[] = []): Platform | 'fixture' {
  const u = new URL(url);
  if (extraHosts.includes(u.host)) return 'fixture';
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS[u.hostname]) throw new Error(`Refusing to open ${u.hostname}: not a supported application form.`);
  return ALLOWED_HOSTS[u.hostname];
}
