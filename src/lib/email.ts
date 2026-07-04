import nodemailer from 'nodemailer';

export function createTransporter() {
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
