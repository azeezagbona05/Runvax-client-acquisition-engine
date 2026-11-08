import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { validKey } from '@/lib/agents/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chat', robots: { index: false } };

/** A full-page home for an assistant: a link to share, or to open the chat on a phone. */
export default async function HostedChat({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; if (!validKey(key)) notFound();
  const a = await prisma.customAgent.findUnique({ where: { publicKey: key } });
  if (!a || a.kind !== 'assistant' || a.status !== 'active') notFound();
  const cfg = sanitizeConfig('assistant', a.config) as AssistantConfig; if (!cfg.channels.web) notFound();
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 20px', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <h1 style={{ fontSize: 30, margin: 0 }}>{cfg.business.name || a.name}</h1>
      <p style={{ color: '#475569' }}>{cfg.business.about}</p>
      <p style={{ color: '#64748b' }}>Tap the chat bubble to talk to our assistant.</p>
      <Script src="/runvax-chat.js" data-key={key} strategy="afterInteractive" />
    </main>
  );
}
