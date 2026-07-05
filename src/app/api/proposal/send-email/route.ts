import { NextRequest, NextResponse } from 'next/server';
import { createTransporter, proposalToProspectHtml } from '@/lib/email';
import { getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { prospectEmail, proposal, agencyName, agencyPhone, agencyEmail, agencyWebsite } = await req.json() as {
    prospectEmail: string;
    proposal: string;
    agencyName?: string;
    agencyPhone?: string;
    agencyEmail?: string;
    agencyWebsite?: string;
  };

  if (!prospectEmail || !proposal) {
    return NextResponse.json({ error: 'prospectEmail and proposal are required' }, { status: 400 });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ error: 'No SMTP configured — set up email in Settings' }, { status: 500 });
  }

  const appName = getAppName();
  const fromName = agencyName || appName;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${fromName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: prospectEmail,
      subject: `Website Proposal — ${fromName}`,
      html: proposalToProspectHtml(proposal, fromName, agencyPhone, agencyEmail, agencyWebsite),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send' }, { status: 500 });
  }
}
