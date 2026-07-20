import nodemailer from 'nodemailer';
import { getAppUrl } from './url';

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

// `preheader` is the hidden snippet Gmail/Outlook/Apple Mail show next to the
// subject line in the inbox list — without it, clients fall back to showing
// raw HTML/whitespace from the top of the body, which looks broken.
function emailShell(appName: string, body: string, preheader = ''): string {
  const logoUrl = `${getAppUrl()}/icon-192.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${appName}</title></head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:48px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:20px;box-shadow:0 8px 32px rgba(15,23,42,0.10),0 2px 8px rgba(15,23,42,0.06);">

      <!-- Header / Logo -->
      <tr>
        <td style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#ea580c 100%);border-radius:20px 20px 0 0;padding:30px 40px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background:#ffffff;border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                <img src="${logoUrl}" width="40" height="40" alt="${appName}" style="display:block;border-radius:12px;width:40px;height:40px;">
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <span style="font-size:21px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${appName}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:40px 40px 32px;">
          ${body}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 20px 20px;padding:22px 40px;text-align:center;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;line-height:1.6;">© ${new Date().getFullYear()} ${appName} · The AI-powered client prospecting tool for freelancers</p>
          <p style="margin:0;color:#cbd5e1;font-size:11px;">You're receiving this because you have a ${appName} account.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Small colored icon badge shown above each email's headline — gives every
// email type a distinct visual identity at a glance (success vs. warning vs. info).
function iconBadge(icon: string, colorHex: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
    <tr>
      <td style="background:${colorHex}1a;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:20px;line-height:44px;">
        ${icon}
      </td>
    </tr>
  </table>`;
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed,#9333ea);border-radius:14px;box-shadow:0 6px 20px rgba(124,58,237,0.35);">
        <a href="${url}" style="display:block;padding:16px 44px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;white-space:nowrap;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function securityNotice(notice: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
    <tr>
      <td style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.18);border-radius:12px;padding:14px 18px;">
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${notice}</p>
      </td>
    </tr>
  </table>`;
}

export function verificationEmailHtml(name: string, verifyUrl: string, appName: string): string {
  const body = `
    ${iconBadge('✉️', '#7c3aed')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Verify your&nbsp;email</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 32px;font-size:16px;color:#475569;line-height:1.7;">
      Welcome to ${appName}! One quick step — verify your email to unlock your account and start finding high-value clients in your city within seconds.
    </p>
    ${ctaButton('Verify my email', verifyUrl)}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
      Or paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color:#7c3aed;text-decoration:none;word-break:break-all;">${verifyUrl}</a>
    </p>
    ${securityNotice('🔒 This link expires in <strong style="color:#475569;">24 hours</strong>. If you didn\'t create a ${appName} account, you can safely ignore this email — no action needed.')}
  `;
  return emailShell(appName, body, `Verify your email to activate your ${appName} account and start finding clients.`);
}

export function passwordResetEmailHtml(name: string, resetUrl: string, appName: string): string {
  const body = `
    ${iconBadge('🔑', '#7c3aed')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Reset your&nbsp;password</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name ?? 'there'}</strong>,</p>
    <p style="margin:0 0 32px;font-size:16px;color:#475569;line-height:1.7;">
      We received a request to reset the password for your ${appName} account. Click the button below to choose a new password.
    </p>
    ${ctaButton('Reset my password', resetUrl)}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
      Or paste this link into your browser:<br>
      <a href="${resetUrl}" style="color:#7c3aed;text-decoration:none;word-break:break-all;">${resetUrl}</a>
    </p>
    ${securityNotice('🛡️ This link expires in <strong style="color:#475569;">1 hour</strong>. If you didn\'t request a password reset, your account is safe — no changes have been made. You can ignore this email.')}
  `;
  return emailShell(appName, body, 'Reset your password — this link expires in 1 hour.');
}

// ─── Daily limit reached — mirrors UpgradeModal's ai_limit copy exactly, since
// that same modal (and now this email) fires for both the search and AI caps ──

export function limitReachedEmailHtml(name: string, appUrl: string, appName: string): string {
  const body = `
    ${iconBadge('⚡', '#7c3aed')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Daily limit reached</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.7;">
      You've used all 15 AI messages on the Free plan today. Upgrade to Pro for 200 messages/day.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.06);">
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px;font-size:13px;color:#7c3aed;font-weight:700;">⚡ Pro plan includes:</p>
          <table cellpadding="0" cellspacing="0">
            ${['200 AI messages/day', 'Unlimited saved prospects', 'Email blast to 100+ businesses', 'AI proposals & market briefs']
              .map((f) => `<tr><td style="padding:3px 0;font-size:13px;color:#334155;line-height:1.6;"><span style="color:#16a34a;font-weight:700;">&check;</span>&nbsp; ${f}</td></tr>`)
              .join('')}
          </table>
        </td>
      </tr>
    </table>
    ${ctaButton('Upgrade to Pro — ₦9,999/mo', `${appUrl}/pricing`)}
    <p style="margin:-16px 0 0;text-align:center;">
      <a href="${appUrl}/pricing" style="font-size:13px;color:#ea580c;font-weight:600;text-decoration:none;">Agency plan — ₦24,999/mo (Unlimited everything) &rarr;</a>
    </p>
    ${securityNotice('⏰ Your free limit resets at midnight — or upgrade now and never wait again.')}
  `;
  return emailShell(appName, body, "You've hit today's free limit — upgrade to keep finding and pitching clients.");
}

// ─── #4 Welcome (sent immediately at signup, alongside the verification email) ──

export function welcomeEmailHtml(name: string, appUrl: string, appName: string): string {
  const body = `
    ${iconBadge('🚀', '#ea580c')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">You're in. Let's find your first client.</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>, welcome to ${appName} — here's how to land your first paying client this week.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.06);">
        <td style="padding:14px 18px;font-size:13px;color:#7c3aed;font-weight:700;">Step 1</td>
        <td style="padding:14px 18px;font-size:14px;color:#1e293b;">Search for businesses in your city that need a website</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:14px 18px;font-size:13px;color:#7c3aed;font-weight:700;">Step 2</td>
        <td style="padding:14px 18px;font-size:14px;color:#1e293b;">Save the best leads to your pipeline</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.06);">
        <td style="padding:14px 18px;font-size:13px;color:#7c3aed;font-weight:700;">Step 3</td>
        <td style="padding:14px 18px;font-size:14px;color:#1e293b;">Generate a personalised proposal and send it in minutes</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:14px 18px;font-size:13px;color:#7c3aed;font-weight:700;">Step 4</td>
        <td style="padding:14px 18px;font-size:14px;color:#1e293b;">Fill in your profile in Settings so proposals auto-fill with your details</td>
      </tr>
    </table>
    ${ctaButton('Start finding clients', appUrl)}
    ${securityNotice('💡 <strong style="color:#475569;">Pro tip:</strong> Businesses with no website and 4+ stars are your best leads — they already have paying customers but zero online presence.')}
  `;
  return emailShell(appName, body, `Here's how to land your first paying client with ${appName} this week.`);
}

// ─── Admin notification — new user registered ───────────────────────────────

export function newUserRegisteredEmailHtml(
  name: string,
  email: string,
  totalUsers: number,
  appUrl: string,
  appName: string,
): string {
  const body = `
    ${iconBadge('👤', '#16a34a')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">New user registered</h1>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Name</td>
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;font-weight:700;">${name}</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Email</td>
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;">${email}</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Total users</td>
        <td style="padding:13px 18px;font-size:14px;color:#16a34a;font-weight:700;">${totalUsers}</td>
      </tr>
    </table>
    ${ctaButton('View in admin', `${appUrl}/admin`)}
  `;
  return emailShell(appName, body, `${name} just signed up — you now have ${totalUsers} total users.`);
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
    ${iconBadge('✅', '#16a34a')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Payment confirmed</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>, your <strong style="color:#7c3aed;">${planLabel} plan</strong> is now active. Thank you!</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Plan</td>
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;font-weight:700;">${planLabel}</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Amount paid</td>
        <td style="padding:13px 18px;font-size:14px;color:#16a34a;font-weight:700;">₦${naira}</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Next renewal</td>
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;">${renewalDate}</td>
      </tr>
    </table>
    ${ctaButton('Go to dashboard', appUrl)}
    ${securityNotice('🔒 Keep this email as your payment receipt. To manage your subscription, visit Settings inside ${appName}.')}
  `;
  return emailShell(appName, body, `Your ${planLabel} plan is active — ₦${naira} received.`);
}

// ─── #2 Payment failed / plan downgraded ────────────────────────────────────

export function paymentFailedHtml(name: string, plan: string, appUrl: string, appName: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const body = `
    ${iconBadge('⚠️', '#d97706')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Your plan has been downgraded</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.7;">
      We weren't able to process your renewal payment for the <strong style="color:#d97706;">${planLabel} plan</strong>. Your account has been moved to the free tier.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(217,119,6,0.25);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(217,119,6,0.08);">
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:14px;color:#b45309;font-weight:700;">What happens now?</p>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">Your data is safe. You keep all saved prospects. Pro features (AI outreach, proposals, email blast) are paused until you resubscribe.</p>
        </td>
      </tr>
    </table>
    ${ctaButton('Resubscribe to Pro', `${appUrl}/pricing`)}
    ${securityNotice('💳 Common causes: expired card, insufficient funds, or bank declined the transaction. Update your payment method and resubscribe to restore access.')}
  `;
  return emailShell(appName, body, `Your ${planLabel} plan payment failed — you've been moved to the free tier.`);
}

// ─── #3 WhatsApp template rejected ──────────────────────────────────────────

export function whatsappRejectedHtml(name: string, reason: string | undefined, settingsUrl: string, appName: string): string {
  const body = `
    ${iconBadge('⚠️', '#ea580c')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">WhatsApp template rejected</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.7;">
      Meta has rejected your WhatsApp Business message template. The <strong style="color:#ea580c;">API Send</strong> button on prospect cards is temporarily disabled until this is resolved.
    </p>
    ${reason ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border:1px solid rgba(234,88,12,0.25);border-radius:12px;overflow:hidden;">
      <tr style="background:rgba(234,88,12,0.08);">
        <td style="padding:14px 18px;">
          <p style="margin:0 0 4px;font-size:12px;color:#c2410c;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Rejection reason from Meta</p>
          <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${reason}</p>
        </td>
      </tr>
    </table>` : ''}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <td style="padding:14px 18px;">
          <p style="margin:0 0 8px;font-size:13px;color:#475569;font-weight:700;">How to fix it:</p>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.8;">
            <li>Go to Settings → WhatsApp Business API</li>
            <li>Click <strong style="color:#1e293b;">Reconnect</strong> to reset the template</li>
            <li>Re-submit the template — it usually gets approved within a few hours</li>
          </ol>
        </td>
      </tr>
    </table>
    ${ctaButton('Fix in Settings', settingsUrl)}
  `;
  return emailShell(appName, body, 'Your WhatsApp Business template was rejected — API sending is paused until this is fixed.');
}

// ─── #5 Proposal copy to self ────────────────────────────────────────────────

function mdToEmailHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;color:#7c3aed;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #f97316;">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:#6d28d9;margin:16px 0 6px;">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:#7c3aed;margin:12px 0 4px;">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#475569;">$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split('|').filter(Boolean).map((c) => c.trim());
      return '<tr>' + cells.map((c, i) => `<td style="padding:9px 13px;font-size:13px;color:${i === 0 ? '#64748b' : '#1e293b'};border-bottom:1px solid #e5e7eb;">${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/gm, (block) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${block}</table>`)
    .replace(/^- (.+)$/gm, '<li style="font-size:13px;color:#334155;line-height:1.7;margin-bottom:4px;">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/gm, (block) => `<ul style="margin:8px 0 14px;padding-left:20px;">${block}</ul>`)
    .replace(/\n\n/g, '</p><p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 12px;">')
    .replace(/^(?!<[hpultrd])(.+)$/gm, '<p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 12px;">$1</p>');
}

export function proposalCopyHtml(businessName: string, proposalMd: string, appName: string): string {
  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `
    ${iconBadge('📄', '#7c3aed')}
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Your generated proposal</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${businessName}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;">Generated on ${today} · Saved to your conversations log</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 0;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#f8fafc;padding:24px 28px;">
          ${mdToEmailHtml(proposalMd)}
        </td>
      </tr>
    </table>
  `;
  return emailShell(appName, body, `Your proposal for ${businessName} is ready.`);
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
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;border-radius:16px;box-shadow:0 8px 32px rgba(15,23,42,0.10),0 2px 8px rgba(15,23,42,0.06);">

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
          ${mdToEmailHtml(proposalMd)}
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
