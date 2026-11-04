import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { isBlockedAddress } from '@/lib/acquisition/web/ssrf';

// Strict on purpose: the address is written into an SMTP command, so no CR/LF, spaces or angle brackets.
const SAFE_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;

export const dynamic = 'force-dynamic';

type VerifyResult = 'valid' | 'invalid' | 'unknown';

async function getMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain);
    if (!records?.length) return null;
    records.sort((a, b) => a.priority - b.priority);
    return records[0].exchange;
  } catch {
    return null;
  }
}

function smtpHandshake(mxHost: string, email: string): Promise<VerifyResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { socket.destroy(); resolve('unknown'); }, 8000);

    const socket = net.createConnection(25, mxHost);
    let step = 0;
    let buffer = '';

    const send = (cmd: string) => socket.write(cmd + '\r\n');

    const cleanup = (result: VerifyResult) => {
      clearTimeout(timeout);
      try { send('QUIT'); } catch { /* ignore */ }
      setTimeout(() => { try { socket.destroy(); } catch { /* ignore */ } }, 300);
      resolve(result);
    };

    socket.on('error', () => { clearTimeout(timeout); resolve('unknown'); });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);

        if (step === 0 && code === 220) {
          step = 1;
          send(`EHLO verify.check`);
        } else if (step === 1 && (code === 250 || code === 220)) {
          if (!line.includes('-')) {
            // Last 250 line (no hyphen = end of EHLO response)
            step = 2;
            send(`MAIL FROM:<verify@verify.check>`);
          }
        } else if (step === 2 && code === 250) {
          step = 3;
          send(`RCPT TO:<${email}>`);
        } else if (step === 3) {
          if (code === 250 || code === 251) {
            cleanup('valid');
          } else if (code === 550 || code === 551 || code === 553 || code === 554) {
            cleanup('invalid');
          } else {
            // 421, 450, 452 etc. — server deferred, treat as unknown
            cleanup('unknown');
          }
          return;
        }
      }
    });
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`verify-email:${user.userId}`, { maxRequests: 60, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const { email } = await req.json() as { email: string };

    if (!email || typeof email !== 'string' || email.length > 254 || !SAFE_EMAIL.test(email)) {
      return NextResponse.json({ result: 'invalid' as VerifyResult });
    }

    const domain = email.split('@')[1].toLowerCase();

    // Skip disposable/role addresses quickly
    const disposable = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email', 'yopmail.com'];
    if (disposable.includes(domain)) {
      return NextResponse.json({ result: 'invalid' as VerifyResult });
    }

    const mxHost = await getMxHost(domain);
    if (!mxHost) {
      return NextResponse.json({ result: 'invalid' as VerifyResult });
    }

    // Never open a connection to a mail host that resolves to a private or internal address.
    try {
      const addrs = net.isIP(mxHost) ? [mxHost] : (await dns.lookup(mxHost, { all: true })).map((a) => a.address);
      if (addrs.length === 0 || addrs.some(isBlockedAddress)) return NextResponse.json({ result: 'unknown' as VerifyResult });
    } catch { return NextResponse.json({ result: 'unknown' as VerifyResult }); }

    const result = await smtpHandshake(mxHost, email);
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ result: 'unknown' as VerifyResult });
  }
}
