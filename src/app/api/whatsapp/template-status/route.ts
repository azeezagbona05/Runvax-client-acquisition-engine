import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TEMPLATE_NAME } from '../create-template/route';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!settings?.wabaId || !settings?.waAccessToken || !settings?.waTemplateName) {
    return NextResponse.json({ status: null });
  }

  const res = await fetch(
    `${GRAPH}/${settings.wabaId}/message_templates?name=${TEMPLATE_NAME}&fields=id,name,status,rejected_reason&access_token=${settings.waAccessToken}`,
  );
  const data = await res.json() as {
    data?: Array<{ id: string; name: string; status: string; rejected_reason?: string }>;
    error?: { message: string };
  };

  if (!res.ok || data.error || !data.data?.length) {
    return NextResponse.json({ status: settings.waTemplateStatus ?? null });
  }

  const template = data.data[0];
  const status = template.status;

  // Persist latest status
  if (status !== settings.waTemplateStatus) {
    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { waTemplateStatus: status },
    });
  }

  return NextResponse.json({
    status,
    rejectedReason: template.rejected_reason,
  });
}
