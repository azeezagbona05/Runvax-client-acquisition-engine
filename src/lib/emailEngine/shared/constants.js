// Shared vocabulary. Nothing here imports from the RUNVAX app.
export const VerificationStatus = Object.freeze({
  VERIFIED: 'VERIFIED',
  LIKELY_VALID: 'LIKELY_VALID',
  CATCH_ALL: 'CATCH_ALL',
  UNVERIFIED: 'UNVERIFIED',
  INVALID: 'INVALID',
  DISPOSABLE: 'DISPOSABLE',
  ROLE_BASED: 'ROLE_BASED',
  UNKNOWN: 'UNKNOWN',
});

// Provenance of an email. INFERRED must never be shown as confirmed.
export const Provenance = Object.freeze({
  DISCOVERED: 'DISCOVERED', // seen on a public page
  INFERRED: 'INFERRED', // generated from a learned pattern
});

export const ROLE_LOCALS = new Set([
  'info', 'contact', 'hello', 'hi', 'sales', 'support', 'help', 'admin', 'office', 'enquiries', 'enquiry',
  'inquiries', 'inquiry', 'mail', 'team', 'service', 'services', 'billing', 'accounts', 'accounting',
  'hr', 'jobs', 'careers', 'recruitment', 'press', 'media', 'marketing', 'webmaster', 'postmaster',
  'abuse', 'noreply', 'no-reply', 'donotreply', 'bookings', 'booking', 'reservations', 'orders',
  'feedback', 'general', 'reception', 'customerservice', 'legal', 'privacy', 'security', 'newsletter',
]);

// Small seed list; production use should load a maintained list (see documentation/limitations.md).
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com',
  'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mintemail.com', 'mailnesia.com',
  'emailondeck.com', 'tempinbox.com', 'spamgourmet.com', 'mytemp.email', 'moakt.com',
]);

// Free-mail providers: a person's name here says nothing about a company domain pattern.
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com', 'icloud.com',
  'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com', 'msn.com', 'me.com',
]);
