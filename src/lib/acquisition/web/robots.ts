/**
 * Minimal robots.txt (RFC 9309) evaluation for our own user agent: the group
 * naming our product token wins, otherwise "*". Longest matching rule wins,
 * Allow beats Disallow on a tie; "*" and "$" wildcards supported.
 * Crawl-delay is honoured (non-standard, but respected), never below 2s.
 */

export const PRODUCT_TOKEN = 'runvaxresearchbot';
export const MIN_DELAY_MS = 2000;

export interface RobotsRules {
  status: 'parsed' | 'none' | 'disallow_all';
  rules: Array<{ allow: boolean; pattern: string }>;
  crawlDelayMs: number;
}

export function parseRobots(text: string, token = PRODUCT_TOKEN): RobotsRules {
  type Group = { agents: string[]; rules: Array<{ allow: boolean; pattern: string }>; delay?: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && value === '') continue; // "Disallow:" = allow everything
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const d = Number.parseFloat(value);
      if (Number.isFinite(d) && d >= 0) current.delay = d;
    }
  }

  const ours = groups.filter((g) => g.agents.some((a) => a.split('/')[0].trim() === token));
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const delay = Math.max(...chosen.map((g) => g.delay ?? 0), 0);
  return { status: 'parsed', rules, crawlDelayMs: Math.max(MIN_DELAY_MS, Math.round(delay * 1000)) };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function isAllowed(robots: RobotsRules, pathWithQuery: string): boolean {
  if (robots.status === 'disallow_all') return false;
  if (robots.status === 'none') return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of robots.rules) {
    if (!patternToRegex(r.pattern).test(pathWithQuery)) continue;
    const len = r.pattern.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}

/** How an HTTP outcome for /robots.txt maps to crawl permission. */
export function robotsFromStatus(httpStatus: number | null, body: string | null): RobotsRules {
  if (httpStatus === null) return { status: 'disallow_all', rules: [], crawlDelayMs: MIN_DELAY_MS }; // timeout / network
  if (httpStatus >= 200 && httpStatus < 300) return parseRobots(body ?? '');
  if (httpStatus === 404 || httpStatus === 410) return { status: 'none', rules: [], crawlDelayMs: MIN_DELAY_MS };
  // 401/403/429/5xx and anything else: be conservative.
  return { status: 'disallow_all', rules: [], crawlDelayMs: MIN_DELAY_MS };
}
