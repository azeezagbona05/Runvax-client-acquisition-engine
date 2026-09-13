import { NextResponse } from 'next/server';
import { composePrompt } from '@/lib/outreach/composer';
import { selectFrameworks } from '@/lib/outreach/router';
import { runQualityGate } from '@/lib/outreach/quality-gate';
import { generate as aiGenerate } from '@/lib/ai';
import type { ProspectContext, SenderProfile } from '@/lib/outreach/types';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ctx = {
  businessName: 'Elevate Fitness', industry: 'gym', city: 'Lagos', country: 'NG',
  hasWebsite: false, rating: 4.6, reviewCount: 214, channel: 'whatsapp',
  intent: 'cold_first_touch', offer: 'website',
} as unknown as ProspectContext;

const profile: SenderProfile = {
  senderName: 'Azeez', businessName: 'Softline Studio', whatsapp: '+2348000000000',
  replyEmail: 'a@softline.ng', city: 'Lagos', tagline: 'Fast websites for Lagos businesses',
  services: 'Web design', website: 'softline.ng',
};

export async function GET(req: Request) {
  const nonce = new URL(req.url).searchParams.get('n') ?? '';
  const sel = selectFrameworks(ctx);
  const { system, user } = composePrompt(ctx, sel, profile);
  const hasBans = system.includes('AI-TELL BANS');

  const res = await aiGenerate({ system, prompt: user + (nonce ? `\n(variation ${nonce})` : ''), temperature: 0.9, maxTokens: 650, feature: 'outreach' });
  const wa = res.text.match(/---WHATSAPP---([\s\S]*?)---EMAIL-SUBJECT---/)?.[1]?.trim() ?? res.text.trim();
  const qg = runQualityGate({ whatsapp: wa } as never, ctx, profile.businessName);

  return new NextResponse(
    `AI-TELL BANS in system prompt: ${hasBans}\nsystem prompt chars: ${system.length}\n\n--- GENERATED WHATSAPP ---\n${wa}\n\n--- GATE ---\npass: ${qg.pass}\nnotes:\n${qg.notes.length ? qg.notes.join('\n') : '(none)'}`,
    { headers: { 'content-type': 'text/plain' } },
  );
}
