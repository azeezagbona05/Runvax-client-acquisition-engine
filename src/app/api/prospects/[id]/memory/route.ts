import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recall, remember } from '@/lib/prospectMemory';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

async function ownedProspect(userId: string, id: string) {
  return prisma.prospect.findFirst({ where: { id, userId }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownedProspect(session.user.id, params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ memories: await recall(session.user.id, params.id) });
}

// Lets the user add a fact of their own (e.g. "owner wants a call after Friday").
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownedProspect(session.user.id, params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  await remember({ userId: session.user.id, prospectId: params.id, kind: 'note', content, source: 'user', confidence: 'high' });
  return NextResponse.json({ memories: await recall(session.user.id, params.id) }, { status: 201 });
}
