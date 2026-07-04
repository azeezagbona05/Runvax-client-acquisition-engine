import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

import { TEMPLATE_NAME, TEMPLATE_BODY } from '@/lib/whatsapp-constants';

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!settings?.wabaId || !settings?.waAccessToken) {
    return NextResponse.json({ error: 'WhatsApp not connected. Complete Step 1 first.' }, { status: 400 });
  }

  const token = settings.waAccessToken;
  const wabaId = settings.wabaId;

  // Check if template already exists
  const checkRes = await fetch(
    `${GRAPH}/${wabaId}/message_templates?name=${TEMPLATE_NAME}&fields=id,name,status&access_token=${token}`,
  );
  const checkData = await checkRes.json() as { data?: Array<{id: string; name: string; status: string}>; error?: {message: string} };

  if (checkData.data && checkData.data.length > 0) {
    const existing = checkData.data[0];
    // Update status in DB
    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { waTemplateName: TEMPLATE_NAME, waTemplateStatus: existing.status },
    });
    return NextResponse.json({ ok: true, status: existing.status, existed: true });
  }

  // Create the template
  const payload = {
    name: TEMPLATE_NAME,
    language: 'en',
    category: 'MARKETING',
    components: [
      {
        type: 'BODY',
        text: TEMPLATE_BODY,
        example: {
          body_text: [['Lagos Tailors & Co']],
        },
      },
    ],
  };

  const createRes = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const createData = await createRes.json() as {
    id?: string;
    status?: string;
    error?: { message: string; code: number; error_data?: { details: string } };
  };

  if (!createRes.ok || createData.error) {
    const detail = createData.error?.error_data?.details ?? createData.error?.message ?? 'Template creation failed';
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const status = createData.status ?? 'PENDING';

  await prisma.userSettings.update({
    where: { userId: session.user.id },
    data: { waTemplateName: TEMPLATE_NAME, waTemplateStatus: status },
  });

  return NextResponse.json({ ok: true, status, existed: false });
}
