import nodemailer from 'nodemailer';
import { getAppUrl } from './url';
import { PRICING_ENABLED, TRIAL_DAYS } from './promo';

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
export function emailShell(appName: string, body: string, preheader = '', footerNote = ''): string {
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
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">${footerNote || `You're receiving this because you have a ${appName} account.`}</p>
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
export function iconBadge(icon: string, colorHex: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
    <tr>
      <td style="background:${colorHex}1a;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:20px;line-height:44px;">
        ${icon}
      </td>
    </tr>
  </table>`;
}

export function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed,#9333ea);border-radius:14px;box-shadow:0 6px 20px rgba(124,58,237,0.35);">
        <a href="${url}" style="display:block;padding:16px 44px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;white-space:nowrap;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

export function securityNotice(notice: string): string {
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
    ${ctaButton('Upgrade to Pro — $6/mo', `${appUrl}/pricing`)}
    <p style="margin:-16px 0 0;text-align:center;">
      <a href="${appUrl}/pricing" style="font-size:13px;color:#ea580c;font-weight:600;text-decoration:none;">Agency plan — $15/mo (Unlimited everything) &rarr;</a>
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

// ─── Argus — admin ops daily brief digest ──────────────────────────────────

export function adminDailyBriefHtml(
  summary: string,
  recommendations: Array<{ label: string; count: number }>,
  appUrl: string,
  appName: string,
): string {
  const body = `
    ${iconBadge('🛡️', '#7c3aed')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Today's admin brief</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.7;">${summary}</p>
    ${recommendations.length > 0 ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      ${recommendations.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? 'rgba(124,58,237,0.08)' : '#ffffff'};">
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;font-weight:600;">${r.label}</td>
        <td style="padding:13px 18px;font-size:14px;color:#7c3aed;font-weight:700;text-align:right;">${r.count}</td>
      </tr>`).join('')}
    </table>` : ''}
    ${ctaButton('Review in admin', `${appUrl}/admin`)}
  `;
  return emailShell(appName, body, summary);
}

// ─── #1 Payment confirmed ────────────────────────────────────────────────────

export function paymentConfirmationHtml(
  name: string,
  plan: string,
  amountMinor: number,
  renewalDate: string,
  appUrl: string,
  appName: string,
  currency = 'USD',
): string {
  // Amounts arrive in the currency's smallest unit (cents / kobo).
  const paid = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amountMinor / 100);
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
        <td style="padding:13px 18px;font-size:14px;color:#16a34a;font-weight:700;">${paid}</td>
      </tr>
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">Next renewal</td>
        <td style="padding:13px 18px;font-size:14px;color:#1e293b;">${renewalDate}</td>
      </tr>
    </table>
    ${ctaButton('Go to dashboard', appUrl)}
    ${securityNotice('🔒 Keep this email as your payment receipt. To manage your subscription, visit Settings inside ${appName}.')}
  `;
  return emailShell(appName, body, `Your ${planLabel} plan is active — ${paid} received.`);
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

// ─── #2b Plan expired (natural expiry, not a failed payment) ───────────────

export function planExpiredHtml(name: string, plan: string, appUrl: string, appName: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  if (!PRICING_ENABLED) {
    // Pricing is off: no renew button to send them to. Say what happened and that they keep everything.
    const trialBody = `
      ${iconBadge('⏰', '#d97706')}
      <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Your free ${planLabel} access has ended</h1>
      <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
      <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.7;">Your free ${planLabel} period is over and your account is back on the free tier. All your saved prospects and settings are safe, and you can keep searching every day.</p>
      ${ctaButton('Keep prospecting', appUrl)}
      ${securityNotice('We\'ll let you know when paid plans open. Questions? Just reply to this email.')}
    `;
    return emailShell(appName, trialBody, `Your free ${planLabel} access has ended — your account is safe on the free tier.`);
  }
  const body = `
    ${iconBadge('⏰', '#d97706')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Your plan has expired</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.7;">
      Your <strong style="color:#d97706;">${planLabel} plan</strong> subscription period has ended. Your account has been moved to the free tier.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(217,119,6,0.25);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(217,119,6,0.08);">
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:14px;color:#b45309;font-weight:700;">What happens now?</p>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">Your data is safe. You keep all saved prospects. Pro features (AI outreach, proposals, email blast) are paused until you renew.</p>
        </td>
      </tr>
    </table>
    ${ctaButton('Renew your plan', `${appUrl}/pricing`)}
    ${securityNotice('Questions about your subscription? Reply to this email and we\'ll help you out.')}
  `;
  return emailShell(appName, body, `Your ${planLabel} plan has expired — you've been moved to the free tier.`);
}

// ─── #2c Plan expiring soon (renewal reminder, sent ahead of natural expiry) ─

export function planExpiringSoonHtml(name: string, plan: string, expiryDateStr: string, appUrl: string, appName: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  if (!PRICING_ENABLED) {
    const trialBody = `
      ${iconBadge('⏳', '#7c3aed')}
      <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Your free ${planLabel} access ends soon</h1>
      <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
      <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.7;">Your free ${planLabel} access runs until <strong style="color:#1e293b;">${expiryDateStr}</strong>. Use it while you have it: more searches, every AI feature, proposals and email blast.</p>
      ${ctaButton('Make the most of it', appUrl)}
      ${securityNotice('After that your account moves to the free tier. Nothing is deleted.')}
    `;
    return emailShell(appName, trialBody, `Your free ${planLabel} access ends ${expiryDateStr} — make the most of it.`);
  }
  const body = `
    ${iconBadge('⏳', '#7c3aed')}
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;">Your plan expires soon</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">Hi <strong style="color:#1e293b;">${name}</strong>,</p>
    <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.7;">
      Your <strong style="color:#7c3aed;">${planLabel} plan</strong> expires on <strong style="color:#1e293b;">${expiryDateStr}</strong>. Renew before then to keep uninterrupted access.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;border:1px solid rgba(124,58,237,0.25);border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.08);">
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:14px;color:#6d28d9;font-weight:700;">What happens if it lapses?</p>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">Your data stays safe, but you'll be moved to the free tier and lose Pro features (AI outreach, proposals, email blast) until you renew.</p>
        </td>
      </tr>
    </table>
    ${ctaButton('Renew your plan', `${appUrl}/pricing`)}
    ${securityNotice('Already renewed? You can ignore this — it can take a few minutes to reflect.')}
  `;
  return emailShell(appName, body, `Your ${planLabel} plan expires on ${expiryDateStr} — renew to keep access.`);
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


// ─── Launch campaign — free Pro trial (marketing; one-off, two emails) ──────
//
// Email 1 announces the offer; email 2, sent a couple of days later, is the story-style
// follow-up with a countdown to launch day. Both are marketing, so both carry an
// unsubscribe route. `claimBy` is the last day the trial can be started
// (trialOfferLastDayLabel()); the trial length comes from TRIAL_DAYS, so the copy,
// the button and the API can never disagree.

export const LAUNCH_EMAIL_1_SUBJECT = `🚀 RUNVAX Launch Offer: Get ${TRIAL_DAYS} Days of Pro Access for Free`;
export function launchEmail2Subject(daysLeft: number): string {
  if (daysLeft <= 0) return `🎉 RUNVAX is live: your ${TRIAL_DAYS} free Pro days are waiting`;
  return `⏳ ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to launch: your ${TRIAL_DAYS} free Pro days are waiting`;
}

const MARKETING_NOTE = (appName: string, unsubscribeUrl?: string) =>
  `You&rsquo;re receiving this email because you have a ${appName} account. If you no longer wish to receive these emails, ${unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#94a3b8;">unsubscribe here</a>`
    : `reply &ldquo;unsubscribe&rdquo;`} or contact <a href="mailto:info@runvax.com?subject=Unsubscribe" style="color:#94a3b8;">info@runvax.com</a> and we&rsquo;ll stop.`;

const firstNameOf = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there';

function featureRow(icon: string, title: string, text: string): string {
  return `<tr>
    <td style="padding:10px 0;vertical-align:top;width:44px;">
      <div style="background:rgba(124,58,237,0.10);border-radius:10px;width:36px;height:36px;line-height:36px;text-align:center;font-size:18px;">${icon}</div>
    </td>
    <td style="padding:10px 0 10px 12px;vertical-align:top;">
      <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">${title}</p>
      <p style="margin:2px 0 0;font-size:14px;color:#64748b;line-height:1.55;">${text}</p>
    </td>
  </tr>`;
}

function offerCard(): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
    <tr>
      <td style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 55%,#ea580c 100%);border-radius:16px;padding:26px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.85);">&#127873; YOUR LAUNCH OFFER</p>
        <p style="margin:0;font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">${TRIAL_DAYS} days of RUNVAX Pro</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#ffffff;">$0 &middot; No credit card required</p>
      </td>
    </tr>
  </table>`;
}

function verifyBox(appName: string, heading: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
    <tr>
      <td style="background:rgba(234,88,12,0.07);border:1px solid rgba(234,88,12,0.25);border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#c2410c;">&#9888;&#65039; ${heading}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.65;">Email verification is required to access ${appName} and claim your free Pro trial.</p>
        <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.65;">Check your inbox for the verification email, including your spam or junk folder. If you can&rsquo;t find it, log in to your account and use the option to resend the verification email, if available.</p>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.65;">Once your email is verified, log in and activate your free access.</p>
      </td>
    </tr>
  </table>`;
}

function stepsTable(appUrl: string): string {
  const host = appUrl.replace(/^https?:\/\//, '');
  const row = (n: number, text: string, shaded: boolean) => `<tr style="background:${shaded ? 'rgba(124,58,237,0.06)' : '#ffffff'};">
      <td style="padding:13px 18px;font-size:13px;color:#7c3aed;font-weight:700;width:64px;">Step ${n}</td>
      <td style="padding:13px 18px;font-size:14px;color:#1e293b;line-height:1.5;">${text}</td></tr>`;
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
    ${row(1, 'Verify your email address.', true)}
    ${row(2, `Log in to <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;font-weight:600;">${host}</a>.`, false)}
    ${row(3, `Open your account menu and select <strong>&ldquo;Try Pro free for ${TRIAL_DAYS} days.&rdquo;</strong> Your account should show $0, with no card required.`, true)}
  </table>`;
}

const h1 = 'margin:0 0 14px;font-size:30px;font-weight:800;color:#0f172a;letter-spacing:-0.8px;line-height:1.2;';
const p = 'margin:0 0 18px;font-size:16px;color:#475569;line-height:1.7;';

/** Email 1 — the launch offer. */
export function launchCampaignEmailHtml(name: string, appUrl: string, appName: string, claimBy: string, unsubscribeUrl?: string): string {
  const body = `
    ${iconBadge('🚀', '#7c3aed')}
    <h1 style="${h1}">Your next client could be one search away.</h1>
    <p style="${p}">Hi <strong style="color:#1e293b;">${firstNameOf(name)}</strong>,</p>
    <p style="${p}">On <strong>November 1st</strong>, ${appName} officially launches, and we&rsquo;re celebrating by giving you <strong>${TRIAL_DAYS} days of Pro access, completely free.</strong></p>
    <p style="${p}">If you&rsquo;re a freelancer, web developer, digital marketer or AI automation agency looking for more clients, this is your chance to try a smarter way to find and approach potential customers.</p>

    ${offerCard()}
    ${ctaButton(`Claim my ${TRIAL_DAYS} free days`, `${appUrl}/claim-pro`)}

    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;color:#7c3aed;">HERE&rsquo;S WHAT YOU CAN DO WITH ${appName.toUpperCase()}</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
      ${featureRow('🌍', 'Find businesses worldwide', 'Discover potential clients by industry and location, wherever your target market is.')}
      ${featureRow('🎯', 'Discover new opportunities', 'Identify businesses that may need a website or AI automation system, ranked by how well they fit your services.')}
      ${featureRow('🤖', 'Know who to contact and what to say', 'Research decision-makers and prepare personalised outreach messages to start meaningful conversations.')}
      ${featureRow('📈', 'Build your client pipeline', 'Save promising prospects and track your outreach from the first message towards conversion.')}
    </table>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:1px;color:#7c3aed;">HOW TO ACTIVATE YOUR FREE ACCESS</p>
    ${stepsTable(appUrl)}
    ${verifyBox(appName, 'Already registered but haven&rsquo;t verified your email?')}

    <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#0f172a;">Your next client is waiting to be discovered.</p>
    <p style="${p}">Don&rsquo;t just search for clients manually. Use AI-powered prospecting to discover businesses, identify opportunities and start conversations with potential customers. Your ${TRIAL_DAYS}-day free access is your chance to see what ${appName} can do for your business.</p>
    ${ctaButton(`Get started with ${appName}`, `${appUrl}/claim-pro`)}

    <p style="margin:0 0 14px;font-size:13px;color:#94a3b8;">Claim your free ${TRIAL_DAYS} days by ${claimBy}. One free trial per account. Offer subject to eligibility.</p>
    <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">See you inside ${appName}!<br><strong>The ${appName} Team</strong><br><span style="color:#94a3b8;font-size:13px;">The AI-powered client prospecting platform for freelancers and agencies.</span></p>
  `;
  return emailShell(appName, body, `Official launch on November 1st: get ${TRIAL_DAYS} days of Pro free. $0, no card needed.`, MARKETING_NOTE(appName, unsubscribeUrl));
}

/** Email 2 — the story-style follow-up, with a live countdown to launch day. */
export function launchCountdownEmailHtml(name: string, appUrl: string, appName: string, claimBy: string, daysLeft: number, unsubscribeUrl?: string): string {
  const countdown = daysLeft > 0
    ? `<p style="margin:0;font-size:46px;font-weight:900;color:#ffffff;letter-spacing:-1.5px;line-height:1;">${daysLeft}</p>
       <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:#ffffff;">${daysLeft === 1 ? 'day' : 'days'} until ${appName} officially launches</p>
       <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">November 1st</p>`
    : `<p style="margin:0;font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.8px;">${appName} is live</p>
       <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your free Pro days are open to claim.</p>`;
  const bullet = (icon: string, text: string) => `<tr><td style="padding:6px 0;width:34px;vertical-align:top;font-size:18px;">${icon}</td><td style="padding:6px 0;font-size:15px;color:#334155;line-height:1.6;">${text}</td></tr>`;
  const body = `
    <!-- Countdown -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
      <tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 55%,#ea580c 100%);border-radius:16px;padding:24px;text-align:center;">${countdown}</td></tr>
    </table>

    <p style="${p}">Hi <strong style="color:#1e293b;">${firstNameOf(name)}</strong>,</p>
    <p style="${p}">Imagine this.</p>
    <p style="${p}">It&rsquo;s Monday morning. You sit down at your laptop, ready to grow your business.</p>
    <p style="${p}">You know you can build beautiful websites. You know how to run digital marketing campaigns. Maybe you even build AI automation systems that help businesses save time and make more money.</p>
    <p style="${p}">But there&rsquo;s one problem.</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:800;color:#0f172a;">You need more clients.</p>
    <p style="${p}">So you start searching Google. You scroll through social media. You ask friends for referrals. You spend hours looking for businesses that might need your services.</p>
    <p style="${p}">Sometimes you find a promising business, but you don&rsquo;t know who to contact. Other times, you find the decision-maker but struggle to figure out what to say.</p>
    <p style="${p}">And before you know it, another day has passed. You&rsquo;ve done plenty of searching, but you still haven&rsquo;t had enough conversations with potential clients.</p>
    <p style="margin:0 0 18px;font-size:18px;font-weight:800;color:#0f172a;line-height:1.4;">What if finding your next prospect didn&rsquo;t have to be this difficult?</p>
    <p style="${p}">That&rsquo;s why we created ${appName}. It helps freelancers, web developers, digital marketers and AI automation agencies discover businesses across the world, identify potential opportunities, research decision-makers and prepare personalised outreach.</p>
    <p style="${p}">Instead of wondering where your next client will come from, you can start building a pipeline of businesses worth approaching.</p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
      ${bullet('🌍', 'Search for businesses across different countries.')}
      ${bullet('🎯', 'Discover companies that may need your services.')}
      ${bullet('🤖', 'Find the right people to approach and get help starting the conversation.')}
      ${bullet('📈', 'Organise your prospects and build a repeatable client acquisition process.')}
    </table>

    <p style="${p}">And now, we want you to experience it for yourself.</p>
    ${offerCard()}
    <p style="${p}">To celebrate our official launch on November 1st, we&rsquo;re opening up <strong>${TRIAL_DAYS} days of Pro access at no cost, with no credit card required.</strong></p>
    <p style="${p}">Not another video telling you how to find clients. Not another course asking you to take notes and hope for results. <strong>An actual platform you can use to discover prospects and start taking action.</strong></p>
    <p style="${p}">Give it ${TRIAL_DAYS} days. Explore your market. Find businesses worth approaching. Start conversations. See whether it fits the way you grow your business.</p>
    <p style="${p}">Your next client isn&rsquo;t guaranteed. But you can take a more systematic approach to finding the opportunities that could lead to one.</p>

    <p style="margin:6px 0 14px;font-size:20px;font-weight:800;color:#0f172a;">Ready to give it a try?</p>
    ${ctaButton(`Claim your ${TRIAL_DAYS} free days`, `${appUrl}/claim-pro`)}

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:1px;color:#7c3aed;">ONE IMPORTANT THING BEFORE YOU START</p>
    ${verifyBox(appName, 'Already have a ' + appName + ' account? Make sure your email is verified.')}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr style="background:rgba(124,58,237,0.06);"><td style="padding:13px 18px;font-size:14px;color:#1e293b;line-height:1.55;"><strong style="color:#7c3aed;">1.</strong> Check your inbox for the ${appName} verification email. Check spam or junk too.</td></tr>
      <tr><td style="padding:13px 18px;font-size:14px;color:#1e293b;line-height:1.55;"><strong style="color:#7c3aed;">2.</strong> Can&rsquo;t find it? Log in and use the option to resend your verification email, if available.</td></tr>
      <tr style="background:rgba(124,58,237,0.06);"><td style="padding:13px 18px;font-size:14px;color:#1e293b;line-height:1.55;"><strong style="color:#7c3aed;">3.</strong> Once verified, log in and select <strong>&ldquo;Try Pro free for ${TRIAL_DAYS} days&rdquo;</strong> from your account menu.</td></tr>
    </table>

    <p style="margin:0 0 6px;font-size:16px;color:#334155;">Your free access is waiting for you.</p>
    <p style="margin:0 0 20px;font-size:17px;font-weight:800;color:#0f172a;line-height:1.5;">Stop spending all your time wondering where to find clients. Start discovering businesses worth approaching.</p>
    <p style="margin:0 0 14px;font-size:13px;color:#94a3b8;">Offer valid through ${claimBy}. One free trial per account, subject to eligibility.</p>
    <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">See you inside,<br><strong>The ${appName} Team</strong><br><span style="color:#94a3b8;font-size:13px;">Find prospects. Start conversations. Grow your business.</span></p>
  `;
  const pre = daysLeft > 0
    ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to launch. Claim your ${TRIAL_DAYS} free days of Pro. $0, no card needed.`
    : `${appName} is live. Claim your ${TRIAL_DAYS} free days of Pro. $0, no card needed.`;
  return emailShell(appName, body, pre, MARKETING_NOTE(appName, unsubscribeUrl));
}



/** Email 3: an invitation for existing users to come and try RUNVAX 2.0, with the free trial for those who can still claim it. */
export const v2InviteSubject = (trialAvailable: boolean) =>
  trialAvailable ? `RUNVAX 2.0 is here: come and see it, with ${TRIAL_DAYS} days of Pro free` : 'RUNVAX 2.0 is here: come and see the new experience';

export function v2InviteEmailHtml(name: string, appUrl: string, appName: string, o: { trialAvailable: boolean; /** The last day to claim, or null when the offer has no end date yet. */ claimBy: string | null }, unsubscribeUrl?: string): string {
  const home = `${appUrl}/client-acquisition/find?ref=v2-invite`;
  const trial = o.trialAvailable
    ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;color:#7c3aed;">AND IT&rsquo;S FREE TO TRY</p>
       <p style="${p}">Every account can start one free trial of Pro: <strong>${TRIAL_DAYS} days, $0, no credit card.</strong> It starts when you claim it, so there is no rush to switch today.</p>
       ${offerCard()}
       ${ctaButton(`Claim my ${TRIAL_DAYS} free days`, `${appUrl}/claim-pro`)}`
    : '';
  const body = `
    ${iconBadge('✨', '#7c3aed')}
    <h1 style="${h1}">Meet ${appName} 2.0: your new client acquisition engine.</h1>
    <p style="${p}">Hi <strong style="color:#1e293b;">${firstNameOf(name)}</strong>,</p>
    <p style="${p}">You have been using ${appName} to find clients. We have built something new on top of it and we would love you to come and try it. It is called <strong>${appName} 2.0</strong>.</p>
    ${ctaButton(`Switch to ${appName} 2.0`, home)}

    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;color:#7c3aed;">WHAT&rsquo;S NEW</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
      ${featureRow('🌍', 'Find businesses in any country', 'Pick a country, an area and a category, such as restaurants in Victoria Island, and see the businesses with their phone, website and rating.')}
      ${featureRow('🎯', 'Reach the person who decides', 'Look up the owner or manager of a business, with how sure we are and where we found them.')}
      ${featureRow('🤖', 'An AI team that does the follow-up', 'Describe what you sell in one sentence and it builds the emails, the follow-ups and the reply handling. You review everything before anything is sent.')}
      ${featureRow('🧭', 'Campaign templates for 17 industries', 'Start from a template for real estate, healthcare, solar, legal, education and more.')}
      ${featureRow('📱', 'Made for your phone', 'It works like an app on your phone, so you can run your outreach from anywhere.')}
    </table>

    ${trial}

    <p style="${p}">Switching takes one click, and you can go back to the classic ${appName} from the menu whenever you like.</p>
    ${ctaButton(`Come and see ${appName} 2.0`, home)}
    ${o.trialAvailable ? `<p style="margin:0 0 14px;font-size:13px;color:#94a3b8;">${o.claimBy ? `Claim your free ${TRIAL_DAYS} days by ${o.claimBy}. ` : ''}One free trial per account. Offer subject to eligibility.</p>` : ''}
    <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">See you inside ${appName} 2.0!<br><strong>The ${appName} Team</strong></p>
  `;
  return emailShell(appName, body, o.trialAvailable ? `Come and try ${appName} 2.0. ${TRIAL_DAYS} days of Pro free, no credit card.` : `Come and try ${appName} 2.0.`, MARKETING_NOTE(appName, unsubscribeUrl));
}
