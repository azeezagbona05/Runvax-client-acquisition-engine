import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { livePublicAgent, publishedPosts } from '@/lib/agents/publicFeed';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const live = await livePublicAgent((await params).key);
  if (!live || !live.cfg.destinations.hosted) return { title: 'Not found', robots: { index: false } };
  return { title: live.cfg.business.name ? `${live.cfg.business.name}: articles` : live.agent.name, description: live.cfg.business.about.slice(0, 160) };
}

export default async function HostedAgentPage({ params }: P) {
  const { key } = await params; const live = await livePublicAgent(key);
  if (!live || !live.cfg.destinations.hosted) notFound();
  const posts = await publishedPosts(live.agent.id, 50);
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 60px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 30, margin: 0 }}>{live.cfg.business.name || live.agent.name}</h1>
      {live.cfg.business.about && <p style={{ color: '#475569', marginTop: 6 }}>{live.cfg.business.about}</p>}
      {live.cfg.business.url && <p><a href={live.cfg.business.url} rel="noopener" style={{ color: '#7e22ce' }}>Visit the website</a></p>}
      <div style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        {posts.length === 0 && <p style={{ color: '#64748b' }}>No articles yet.</p>}
        {posts.map((p) => (
          <article key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
            <h2 style={{ fontSize: 21, margin: 0 }}><Link href={`/a/${key}/${p.slug}`} style={{ color: '#0f172a', textDecoration: 'none' }}>{p.title}</Link></h2>
            <time style={{ color: '#64748b', fontSize: 13 }} dateTime={(p.publishedAt ?? p.createdAt).toISOString()}>{(p.publishedAt ?? p.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}</time>
            <p style={{ margin: '8px 0 0', color: '#475569' }}>{p.summary}</p>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 40, fontSize: 12, color: '#94a3b8' }}>Articles by <a href="/" style={{ color: '#94a3b8' }}>RUNVAX agents</a></p>
    </main>
  );
}
