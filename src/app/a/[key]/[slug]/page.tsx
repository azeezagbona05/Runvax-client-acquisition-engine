import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { livePublicAgent } from '@/lib/agents/publicFeed';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ key: string; slug: string }> };

async function load(key: string, slug: string) {
  const live = await livePublicAgent(key); if (!live || !live.cfg.destinations.hosted) return null;
  const post = await prisma.customAgentPost.findFirst({ where: { agentId: live.agent.id, slug, status: 'published' } });
  return post ? { live, post } : null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { key, slug } = await params; const r = await load(key, slug);
  return r ? { title: r.post.title, description: r.post.summary } : { title: 'Not found', robots: { index: false } };
}

export default async function HostedPostPage({ params }: P) {
  const { key, slug } = await params; const r = await load(key, slug); if (!r) notFound();
  const { live, post } = r; const date = post.publishedAt ?? post.createdAt;
  const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.summary, datePublished: date.toISOString(), author: { '@type': 'Organization', name: live.cfg.business.name || live.agent.name }, ...(live.cfg.business.url ? { publisher: { '@type': 'Organization', name: live.cfg.business.name, url: live.cfg.business.url } } : {}) };
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 60px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', lineHeight: 1.7 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <p><Link href={`/a/${key}`} style={{ color: '#7e22ce' }}>← {live.cfg.business.name || 'All articles'}</Link></p>
      <h1 style={{ fontSize: 32, lineHeight: 1.25, margin: '10px 0 6px' }}>{post.title}</h1>
      <time style={{ color: '#64748b', fontSize: 14 }} dateTime={date.toISOString()}>{date.toLocaleDateString('en-GB', { dateStyle: 'long' })}</time>
      {/* The body was reduced to a small tag allow-list when it was saved. */}
      <div className="rvx-article" style={{ marginTop: 20 }} dangerouslySetInnerHTML={{ __html: post.body }} />
      {live.cfg.business.url && <p style={{ marginTop: 36 }}><a href={live.cfg.business.url} rel="noopener" style={{ color: '#7e22ce', fontWeight: 600 }}>Visit {live.cfg.business.name || 'the website'} →</a></p>}
    </main>
  );
}
