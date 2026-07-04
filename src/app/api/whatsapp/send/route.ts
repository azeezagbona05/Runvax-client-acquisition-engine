import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TEMPLATE_NAME } from '../create-template/route';

export const dynamic = 'force-dynamic';

interface SendBody {
  to: string;
  businessName: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!settings?.waPhoneNumberId || !settings?.waAccessToken) {
    return NextResponse.json({ error: 'WhatsApp API not connected.' }, { status: 400 });
  }
  if (settings.waTemplateStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Message template not yet approved by Meta. Check Settings → WA Business API.' }, { status: 400 });
  }

  const body = await req.json() as SendBody;
  if (!body.to || !body.businessName) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Normalise phone: strip everything except digits, ensure no leading +
  const to = body.to.replace(/[^0-9]/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: body.businessName },
          ],
        },
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${settings.waPhoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.waAccessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json() as {
    messages?: Array<{ id: string }>;
    error?: { message: string; code: number; error_data?: { details: string } };
  };

  if (!res.ok || data.error) {
    const detail = data.error?.error_data?.details ?? data.error?.message ?? 'Send failed';
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  return NextResponse.json({ ok: true, messageId: data.messages?.[0]?.id });
}
