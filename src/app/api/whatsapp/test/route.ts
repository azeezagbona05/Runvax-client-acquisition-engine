import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!settings?.waPhoneNumberId || !settings?.waAccessToken) {
    return NextResponse.json({ error: 'WhatsApp API credentials not configured.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${settings.waPhoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,status`,
      { headers: { Authorization: `Bearer ${settings.waAccessToken}` } }
    );
    const data = await res.json() as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      status?: string;
      error?: { message: string; code: number };
    };

    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: data.error?.message ?? 'Invalid credentials — check your Phone Number ID and Access Token.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      phone: data.display_phone_number,
      name: data.verified_name,
      quality: data.quality_rating,
      status: data.status,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to reach Meta API. Check your credentials.' }, { status: 500 });
  }
}
