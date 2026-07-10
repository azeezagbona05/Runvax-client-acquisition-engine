import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTransporter, whatsappRejectedHtml } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';

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
    `${GRAPH}/${settings.wabaId}/message_templates?name=${settings.waTemplateName}&fields=id,name,status,rejected_reason&access_token=${settings.waAccessToken}`,
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

  // Persist latest status and fire rejection email if newly rejected
  if (status !== settings.waTemplateStatus) {
    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { waTemplateStatus: status },
    });

    if (status === 'REJECTED' && process.env.SMTP_HOST) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true },
      });
      if (user?.email) {
        const appName = getAppName();
        const settingsUrl = `${getAppUrl()}/settings`;
        createTransporter().sendMail({
          from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
          to: user.email,
          subject: `Action needed — your WhatsApp template was rejected`,
          html: whatsappRejectedHtml(user.name ?? 'there', template.rejected_reason, settingsUrl, appName),
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({
    status,
    rejectedReason: template.rejected_reason,
  });
}
