// Minimal GitHub REST client (plain fetch, no SDK) used only by Nova's content
// cron to open a PR for a new draft post — this repo is a statically-built
// Next.js site on Vercel, so a running function can't write into the live
// deployed site directly. A git commit is required either way, and a PR
// turns that commit into the human review gate.

const API = 'https://api.github.com';

export interface GithubConfig {
  token: string;
  repo: string; // "owner/name"
}

/** Reads GITHUB_TOKEN/GITHUB_REPO, or null if either is unset. */
export function getGithubConfig(): GithubConfig | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo };
}

async function ghFetch(config: GithubConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${API}/repos/${config.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Creates a new branch off `base` (default "main"), adds one file to it, and
 * opens a PR back into `base`. Returns the PR URL.
 */
export async function openContentDraftPR(config: GithubConfig, {
  branch, filePath, fileContent, prTitle, prBody, base = 'main',
}: {
  branch: string;
  filePath: string;
  fileContent: string;
  prTitle: string;
  prBody: string;
  base?: string;
}): Promise<string> {
  const baseRef = await ghFetch(config, `/git/ref/heads/${base}`) as { object: { sha: string } };
  const baseSha = baseRef.object.sha;

  await ghFetch(config, '/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });

  await ghFetch(config, `/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: prTitle,
      content: Buffer.from(fileContent, 'utf8').toString('base64'),
      branch,
    }),
  });

  const pr = await ghFetch(config, '/pulls', {
    method: 'POST',
    body: JSON.stringify({ title: prTitle, body: prBody, head: branch, base }),
  }) as { html_url: string };

  return pr.html_url;
}
