import nodemailer from 'nodemailer';

export function createTransporter() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    });
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function emailShell(appName: string, headerIcon: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${appName}</title></head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:48px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

      <!-- Header / Logo -->
      <tr>
        <td style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#6d28d9 100%);border-radius:20px 20px 0 0;padding:32px 40px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background:rgba(255,255,255,0.12);border-radius:14px;width:46px;height:46px;text-align:center;vertical-align:middle;font-size:22px;line-height:46px;">
                ${headerIcon}
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${appName}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#161622;border-left:1px solid rgba(255,255,255,0.07);border-right:1px solid rgba(255,255,255,0.07);padding:40px 40px 32px;">
          ${body}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#111119;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 20px 20px;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#4b5563;font-size:12px;line-height:1.6;">© ${new Date().getFullYear()} ${appName} · The AI-powered client prospecting tool for freelancers</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed,#9333ea);border-radius:14px;box-shadow:0 4px 24px rgba(124,58,237,0.4);">
        <a href="${url}" style="display:block;padding:16px 44px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;white-space:nowrap;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function securityNotice(notice: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
    <tr>
      <td style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.18);border-radius:12px;padding:14px 18px;">
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${notice}</p>
      </td>
    </tr>
  </table>`;
}

export function verificationEmailHtml(name: string, verifyUrl: string, appName: string): string {
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">Verify your&nbsp;email</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name}</strong>,</p>
    <p style="margin:0 0 32px;font-size:16px;color:#9ca3af;line-height:1.7;">
      Welcome to ${appName}! One quick step — verify your email to unlock your account and start finding high-value clients in your city within seconds.
    </p>
    ${ctaButton('Verify my email', verifyUrl)}
    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.7;">
      Or paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color:#8b5cf6;text-decoration:none;word-break:break-all;">${verifyUrl}</a>
    </p>
    ${securityNotice('🔒 This link expires in <strong style="color:#9ca3af;">24 hours</strong>. If you didn\'t create a ${appName} account, you can safely ignore this email — no action needed.')}
  `;
  return emailShell(appName, '⚡', body);
}

export function passwordResetEmailHtml(name: string, resetUrl: string, appName: string): string {
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">Reset your&nbsp;password</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name ?? 'there'}</strong>,</p>
    <p style="margin:0 0 32px;font-size:16px;color:#9ca3af;line-height:1.7;">
      We received a request to reset the password for your ${appName} account. Click the button below to choose a new password.
    </p>
    ${ctaButton('Reset my password', resetUrl)}
    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.7;">
      Or paste this link into your browser:<br>
      <a href="${resetUrl}" style="color:#8b5cf6;text-decoration:none;word-break:break-all;">${resetUrl}</a>
    </p>
    ${securityNotice('🛡️ This link expires in <strong style="color:#9ca3af;">1 hour</strong>. If you didn\'t request a password reset, your account is safe — no changes have been made. You can ignore this email.')}
  `;
  return emailShell(appName, '🔑', body);
}

// ─── #4 Welcome (sent after email verification) ─────────────────────────────

export function welcomeEmailHtml(name: string, appUrl: string, appName: string): string {
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">You're in. Let's find your first client. 🚀</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name}</strong>, your email is verified and your account is fully active.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.1);">
        <td style="padding:14px 18px;font-size:13px;color:#a78bfa;font-weight:700;">Step 1</td>
        <td style="padding:14px 18px;font-size:14px;color:#e5e7eb;">Search for businesses in your city that need a website</td>
      </tr>
      <tr style="background:rgba(255,255,255,0.02);">
        <td style="padding:14px 18px;font-size:13px;color:#a78bfa;font-weight:700;">Step 2</td>
        <td style="padding:14px 18px;font-size:14px;color:#e5e7eb;">Save the best leads to your pipeline</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.1);">
        <td style="padding:14px 18px;font-size:13px;color:#a78bfa;font-weight:700;">Step 3</td>
        <td style="padding:14px 18px;font-size:14px;color:#e5e7eb;">Generate a personalised proposal and send it in minutes</td>
      </tr>
      <tr style="background:rgba(255,255,255,0.02);">
        <td style="padding:14px 18px;font-size:13px;color:#a78bfa;font-weight:700;">Step 4</td>
        <td style="padding:14px 18px;font-size:14px;color:#e5e7eb;">Fill in your profile in Settings so proposals auto-fill with your details</td>
      </tr>
    </table>
    ${ctaButton('Start finding clients', appUrl)}
    ${securityNotice('💡 <strong style="color:#9ca3af;">Pro tip:</strong> Businesses with no website and 4+ stars are your best leads — they already have paying customers but zero online presence.')}
  `;
  return emailShell(appName, '⚡', body);
}

// ─── #1 Payment confirmed ────────────────────────────────────────────────────

export function paymentConfirmationHtml(
  name: string,
  plan: string,
  amountKobo: number,
  renewalDate: string,
  appUrl: string,
  appName: string,
): string {
  const naira = (amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 });
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">Payment confirmed ✅</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name}</strong>, your <strong style="color:#a78bfa;">${planLabel} plan</strong> is now active. Thank you!</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.12);">
        <td style="padding:13px 18px;font-size:13px;color:#6b7280;font-weight:600;">Plan</td>
        <td style="padding:13px 18px;font-size:14px;color:#e5e7eb;font-weight:700;">${planLabel}</td>
      </tr>
      <tr style="background:rgba(255,255,255,0.02);">
        <td style="padding:13px 18px;font-size:13px;color:#6b7280;font-weight:600;">Amount paid</td>
        <td style="padding:13px 18px;font-size:14px;color:#34d399;font-weight:700;">₦${naira}</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.12);">
        <td style="padding:13px 18px;font-size:13px;color:#6b7280;font-weight:600;">Next renewal</td>
        <td style="padding:13px 18px;font-size:14px;color:#e5e7eb;">${renewalDate}</td>
      </tr>
    </table>
    ${ctaButton('Go to dashboard', appUrl)}
    ${securityNotice('🔒 Keep this email as your payment receipt. To manage your subscription, visit Settings inside ${appName}.')}
  `;
  return emailShell(appName, '⚡', body);
}

// ─── #2 Payment failed / plan downgraded ────────────────────────────────────

export function paymentFailedHtml(name: string, plan: string, appUrl: string, appName: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">Your plan has been downgraded</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name}</strong>,</p>
    <p style="margin:0 0 28px;font-size:16px;color:#9ca3af;line-height:1.7;">
      We weren't able to process your renewal payment for the <strong style="color:#fbbf24;">${planLabel} plan</strong>. Your account has been moved to the free tier.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(251,191,36,0.2);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(251,191,36,0.08);">
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:14px;color:#fbbf24;font-weight:700;">What happens now?</p>
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">Your data is safe. You keep all saved prospects. Pro features (AI outreach, proposals, email blast) are paused until you resubscribe.</p>
        </td>
      </tr>
    </table>
    ${ctaButton('Resubscribe to Pro', `${appUrl}/pricing`)}
    ${securityNotice('💳 Common causes: expired card, insufficient funds, or bank declined the transaction. Update your payment method and resubscribe to restore access.')}
  `;
  return emailShell(appName, '⚡', body);
}

// ─── #3 WhatsApp template rejected ──────────────────────────────────────────

export function whatsappRejectedHtml(name: string, reason: string | undefined, settingsUrl: string, appName: string): string {
  const body = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f9fafb;letter-spacing:-0.6px;">WhatsApp template rejected ⚠️</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#9ca3af;line-height:1.7;">Hi <strong style="color:#e5e7eb;">${name}</strong>,</p>
    <p style="margin:0 0 24px;font-size:16px;color:#9ca3af;line-height:1.7;">
      Meta has rejected your WhatsApp Business message template. The <strong style="color:#f97316;">API Send</strong> button on prospect cards is temporarily disabled until this is resolved.
    </p>
    ${reason ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border:1px solid rgba(249,115,22,0.25);border-radius:12px;overflow:hidden;">
      <tr style="background:rgba(249,115,22,0.08);">
        <td style="padding:14px 18px;">
          <p style="margin:0 0 4px;font-size:12px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Rejection reason from Meta</p>
          <p style="margin:0;font-size:14px;color:#e5e7eb;line-height:1.6;">${reason}</p>
        </td>
      </tr>
    </table>` : ''}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;">
      <tr style="background:rgba(255,255,255,0.03);">
        <td style="padding:14px 18px;">
          <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:700;">How to fix it:</p>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:#9ca3af;line-height:1.8;">
            <li>Go to Settings → WhatsApp Business API</li>
            <li>Click <strong style="color:#e5e7eb;">Reconnect</strong> to reset the template</li>
            <li>Re-submit the template — it usually gets approved within a few hours</li>
          </ol>
        </td>
      </tr>
    </table>
    ${ctaButton('Fix in Settings', settingsUrl)}
  `;
  return emailShell(appName, '⚡', body);
}

// ─── #5 Proposal copy to self ────────────────────────────────────────────────

function mdToEmailHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;color:#7c3aed;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #f97316;">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:#a78bfa;margin:16px 0 6px;">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:#c4b5fd;margin:12px 0 4px;">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f9fafb;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#9ca3af;">$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:16px 0;">')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split('|').filter(Boolean).map((c) => c.trim());
      return '<tr>' + cells.map((c, i) => `<td style="padding:9px 13px;font-size:13px;color:${i === 0 ? '#9ca3af' : '#e5e7eb'};border-bottom:1px solid rgba(255,255,255,0.05);">${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/gm, (block) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;">${block}</table>`)
    .replace(/^- (.+)$/gm, '<li style="font-size:13px;color:#d1d5db;line-height:1.7;margin-bottom:4px;">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/gm, (block) => `<ul style="margin:8px 0 14px;padding-left:20px;">${block}</ul>`)
    .replace(/\n\n/g, '</p><p style="font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 12px;">')
    .replace(/^(?!<[hpultrd])(.+)$/gm, '<p style="font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 12px;">$1</p>');
}

export function proposalCopyHtml(businessName: string, proposalMd: string, appName: string): string {
  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Your generated proposal</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#f9fafb;letter-spacing:-0.5px;">${businessName}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">Generated on ${today} · Saved to your conversations log</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 0;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#1a1a2a;padding:24px 28px;">
          ${mdToEmailHtml(proposalMd)}
        </td>
      </tr>
    </table>
  `;
  return emailShell(appName, '⚡', body);
}

// ─── #6 Proposal to prospect ─────────────────────────────────────────────────

export function proposalToProspectHtml(
  proposalMd: string,
  agencyName: string,
  agencyPhone?: string,
  agencyEmail?: string,
  agencyWebsite?: string,
): string {
  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const contactLine = [agencyPhone, agencyEmail, agencyWebsite].filter(Boolean).join(' · ');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Website Proposal — ${agencyName}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

      <!-- Agency header -->
      <tr>
        <td style="background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 60%,#f97316 100%);border-radius:16px 16px 0 0;padding:28px 40px;">
          <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;">Website Development Proposal</p>
          <p style="margin:0;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.3px;">${agencyName}</p>
          ${contactLine ? `<p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.75);">${contactLine}</p>` : ''}
        </td>
      </tr>

      <!-- Proposal body -->
      <tr>
        <td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:36px 40px;">
          ${mdToEmailHtml(proposalMd).replace(/color:#[0-9a-f]+/gi, (m) => {
    // lighten dark colours for white background
    const darkMap: Record<string, string> = {
      'color:#f9fafb': 'color:#111827', 'color:#e5e7eb': 'color:#1f2937',
      'color:#d1d5db': 'color:#374151', 'color:#9ca3af': 'color:#4b5563',
      'color:#6b7280': 'color:#6b7280', 'color:#a78bfa': 'color:#7c3aed',
      'color:#c4b5fd': 'color:#6d28d9', 'color:#7c3aed': 'color:#4c1d95',
    };
    return darkMap[m.toLowerCase()] ?? m;
  })}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Prepared by <strong style="color:rgba(255,255,255,0.7);">${agencyName}</strong> · ${today}</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
