import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ConversationEntry } from '@/types';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entry = await req.json() as Omit<ConversationEntry, 'id' | 'timestamp'>;

  const prospect = await prisma.prospect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const full: ConversationEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };

  await prisma.conversation.create({
    data: {
      prospectId: params.id,
      type: entry.type,
      channel: entry.channel,
      replyType: entry.replyType ?? null,
      framework: entry.framework ?? null,
      content: JSON.stringify(full),
    },
  });

  return NextResponse.json(full, { status: 201 });
}
