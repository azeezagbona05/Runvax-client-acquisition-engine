/**
 * The two workspaces inside the Client Acquisition app. Each has its own sidebar menu; the switcher at the top of the sidebar moves between them.
 * Pages that belong to neither (Integrations, Settings, Help) keep whichever workspace the person was last in.
 */
export type Workspace = 'prospecting' | 'studio';

export const STUDIO_HOME = '/client-acquisition/studio';
export const STUDIO_BUILD = '/client-acquisition/agents/new';
const STUDIO_PREFIXES = ['/client-acquisition/studio', '/client-acquisition/agents', '/client-acquisition/career'];
const SHARED_PREFIXES = ['/client-acquisition/integrations', '/client-acquisition/settings', '/client-acquisition/help'];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Which workspace a path belongs to, or null for the shared pages that follow the person's last choice. */
export function workspaceOf(pathname: string): Workspace | null {
  if (STUDIO_PREFIXES.some((p) => under(pathname, p))) return 'studio';
  if (SHARED_PREFIXES.some((p) => under(pathname, p))) return null;
  return 'prospecting';
}

export const WORKSPACE_LABEL: Record<Workspace, { name: string; hint: string }> = {
  prospecting: { name: 'Prospecting', hint: 'Find leads, run campaigns, win clients' },
  studio: { name: 'AI Agent Studio', hint: 'Build, deploy and manage AI agents' },
};
