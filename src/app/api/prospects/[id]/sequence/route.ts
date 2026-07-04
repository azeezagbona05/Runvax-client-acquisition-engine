import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generate } from '@/lib/ai';
import type { FollowUpStep } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// POST /api/prospects/[id]/sequence — generate a 5-step AI follow-up sequence
export async function POST(req: NextRequest, { params }: Params) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prospect = await prisma.prospect.findUnique({
    where: { id: params.id },
    include: { conversations: { orderBy: { createdAt: 'asc' }, take: 1 } },
  });
  if (!prospect || prospect.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const bizData = prospect.businessData as Record<string, unknown>;
  const bizName: string = (bizData?.name as string | undefined) ?? prospect.businessName;
  const bizCategory: string = (bizData?.category as string | undefined) ?? '';
  const bizAddress: string = (bizData?.address as string | undefined) ?? '';
  const reviewCount: number = (bizData?.reviewCount as number | undefined) ?? 0;
  const rating: number = (bizData?.rating as number | undefined) ?? 0;

  const shortName = bizName.includes('(')
    ? bizName.split('(')[0].trim()
    : bizName.length > 40 ? bizName.slice(0, 40).trim() : bizName;

  const firstMsg = prospect.conversations[0]?.content ?? '';
  const baseDate = prospect.outreachSentAt ?? prospect.savedAt;

  const system = `You are a Nigerian freelance web designer writing natural WhatsApp and email follow-up messages.
Your writing is warm, human, and culturally aware — you understand Nigerian business culture and how to communicate respectfully without being pushy.
You return ONLY valid JSON — no markdown, no extra text.`;

  const prompt = `Generate a 5-step follow-up sequence for this prospect.

Business: ${shortName} (${bizCategory})
Location: ${bizAddress}
Google reviews: ${reviewCount} reviews, ${rating} rating
First message sent: "${firstMsg.slice(0, 300)}"

Return a JSON array with exactly 5 objects. Each object must have these exact keys:
- "id": "step_1" through "step_5"
- "day": number of days after first message (use 3, 7, 14, 21, 30)
- "channel": "whatsapp" or "email"
- "label": short 3-5 word description of the angle
- "message": the full message to send

Channel plan:
- step_1: whatsapp (day 3) — gentle check-in, reference the first message briefly, under 50 words
- step_2: whatsapp (day 7) — new angle (mention a business in their area that recently got a website), under 60 words
- step_3: email (day 14) — more professional introduction, mention a quick result or example, under 100 words
- step_4: whatsapp (day 21) — low-pressure genuine curiosity, not salesy, under 40 words
- step_5: whatsapp (day 30) — genuine last message, leave door open for the future, under 35 words

Style rules:
- WhatsApp messages: start with a warm greeting ("Good morning/afternoon/evening [shortName]!"), natural conversational tone
- Email: brief subject line NOT included — just the body
- Never say "I hope this message finds you well", "just following up", "as per my last message", or "circle back"
- Use "${shortName}" naturally (not full business name)
- Each message must feel completely different from the previous ones — different angle, different opening
- No asterisks or markdown in WhatsApp messages

Return only the JSON array. No other text.`;

  const aiRes = await generate({ system, prompt, json: true, maxTokens: 1200, temperature: 0.85, feature: 'outreach' });

  let steps: FollowUpStep[];
  try {
    const raw = JSON.parse(aiRes.text) as Array<{
      id: string; day: number; channel: string; label: string; message: string;
    }>;
    steps = raw.map((s) => ({
      id: s.id,
      day: s.day,
      channel: s.channel as 'whatsapp' | 'email',
      label: s.label,
      message: s.message,
      dueDate: addDays(new Date(baseDate), s.day),
      status: 'pending' as const,
    }));
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON — try again' }, { status: 500 });
  }

  await prisma.prospect.update({
    where: { id: params.id },
    data: { followUpSequence: steps as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ steps });
}

// PATCH /api/prospects/[id]/sequence — update a single step's status
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { stepId, status }: { stepId: string; status: 'sent' | 'skipped' } = await req.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const steps = (prospect.followUpSequence as unknown as FollowUpStep[]) ?? [];
  const updated = steps.map((s) =>
    s.id === stepId
      ? { ...s, status, sentAt: status === 'sent' ? new Date().toISOString() : s.sentAt }
      : s
  );

  await prisma.prospect.update({
    where: { id: params.id },
    data: { followUpSequence: updated as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ steps: updated });
}
