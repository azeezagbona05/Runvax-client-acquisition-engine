import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const draft = await prisma.outreachDraft.findUnique({ where: { id: params.id } });
  if (!draft || draft.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 'sent' is set by the outreach modal after the human actually sends the
  // draft; 'dismissed' (default) is a plain "not interested" from the queue.
  const body = await req.json().catch(() => ({})) as { status?: 'dismissed' | 'sent' };
  const status = body.status === 'sent' ? 'sent' : 'dismissed';

  await prisma.outreachDraft.update({ where: { id: params.id }, data: { status } });
  return NextResponse.json({ ok: true });
}
