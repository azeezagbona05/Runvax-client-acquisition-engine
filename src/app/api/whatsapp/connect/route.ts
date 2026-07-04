import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com/v20.0';

async function graphGet(path: string, token: string) {
  const url = `${GRAPH}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  return res.json() as Promise<Record<string, unknown>>;
}

export interface WaPhone {
  id: string;
  number: string;
  name: string;
  quality: string;
  status: string;
  wabaId: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json() as { token: string };
  if (!token?.trim()) return NextResponse.json({ error: 'Access token required' }, { status: 400 });

  // 1. Validate token — get the identity attached to it
  const me = await graphGet('/me?fields=id,name', token);
  if (me.error) {
    const err = me.error as Record<string, unknown>;
    return NextResponse.json({ error: err.message ?? 'Invalid access token' }, { status: 400 });
  }

  // 2. Collect phone numbers from all reachable WABAs
  const phones: WaPhone[] = [];

  const extractPhones = (wabaList: unknown[], wabaSource: 'owned' | 'client') => {
    void wabaSource;
    for (const waba of wabaList) {
      const w = waba as Record<string, unknown>;
      const wabaId = w.id as string;
      const phoneData = (w.phone_numbers as Record<string, unknown>)?.data as Record<string, unknown>[] | undefined;
      if (!phoneData) continue;
      for (const p of phoneData) {
        phones.push({
          id: p.id as string,
          number: p.display_phone_number as string,
          name: p.verified_name as string,
          quality: (p.quality_rating as string) ?? 'UNKNOWN',
          status: (p.status as string) ?? 'UNKNOWN',
          wabaId,
        });
      }
    }
  };

  // Try via /me/businesses (most common path for user tokens)
  const bizData = await graphGet(
    '/me/businesses?fields=id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}}',
    token,
  );
  if (!bizData.error && Array.isArray(bizData.data)) {
    for (const biz of bizData.data as Record<string, unknown>[]) {
      const wabaList = ((biz.whatsapp_business_accounts as Record<string, unknown>)?.data ?? []) as unknown[];
      extractPhones(wabaList, 'owned');
    }
  }

  // Fallback: /me/whatsapp_business_accounts (for system user tokens)
  if (phones.length === 0) {
    const directWaba = await graphGet(
      '/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}',
      token,
    );
    if (!directWaba.error && Array.isArray(directWaba.data)) {
      extractPhones(directWaba.data as unknown[], 'owned');
    }
  }

  // Fallback 2: client WABAs
  if (phones.length === 0) {
    const clientWaba = await graphGet(
      '/me/client_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}',
      token,
    );
    if (!clientWaba.error && Array.isArray(clientWaba.data)) {
      extractPhones(clientWaba.data as unknown[], 'client');
    }
  }

  if (phones.length === 0) {
    return NextResponse.json({
      error: 'No WhatsApp Business phone numbers found for this token. Make sure the token has whatsapp_business_management permission and is linked to a WhatsApp Business Account.',
    }, { status: 400 });
  }

  // 3. Save the token (phone selection happens separately via settings PATCH)
  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, waAccessToken: token },
    update: { waAccessToken: token },
  });

  return NextResponse.json({
    ok: true,
    userName: me.name,
    phones,
  });
}
