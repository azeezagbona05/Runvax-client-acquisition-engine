/**
 * Status badge for a found email. Statuses come from the RUNVAX email engine's checks (syntax, the domain's mail
 * server, shared vs personal inbox, throwaway domains) or from a mailbox check (Snov / the Verify button).
 * "Verified" is only ever shown when a mailbox check confirmed the address.
 */
export type EmailStatus = 'VERIFIED' | 'LIKELY_VALID' | 'ROLE_BASED' | 'CATCH_ALL' | 'UNVERIFIED' | 'UNKNOWN' | 'INVALID' | 'DISPOSABLE';

export const EMAIL_STATUS_BADGE: Record<EmailStatus, { label: string; tone: string; hint: string }> = {
  VERIFIED: { label: 'Verified', tone: 'acq-pill-green', hint: 'A mailbox check confirmed this address exists.' },
  LIKELY_VALID: { label: 'Likely valid', tone: 'acq-pill-green', hint: 'Published on a public page and the domain receives email. The mailbox itself was not checked.' },
  ROLE_BASED: { label: 'Shared inbox', tone: 'acq-pill-blue', hint: 'A general inbox for the business (like info@ or hello@), and the domain receives email.' },
  CATCH_ALL: { label: 'Accepts all', tone: 'acq-pill-amber', hint: 'This domain accepts any address, so the mailbox cannot be confirmed.' },
  UNVERIFIED: { label: 'Unverified', tone: 'acq-pill-amber', hint: 'The domain receives email, but this mailbox was not checked.' },
  UNKNOWN: { label: 'Not checked', tone: 'acq-pill-gray', hint: 'The check could not finish. Try again later.' },
  INVALID: { label: 'Invalid', tone: 'acq-pill-red', hint: 'This address cannot receive email.' },
  DISPOSABLE: { label: 'Disposable', tone: 'acq-pill-red', hint: 'A throwaway email address.' },
};

export const isEmailStatus = (s: unknown): s is EmailStatus => typeof s === 'string' && s in EMAIL_STATUS_BADGE;

/** A mailbox-check verdict (Snov / Verify button) overrides the engine's status. */
export function effectiveStatus(status: EmailStatus | undefined, verdict?: 'valid' | 'invalid' | 'unknown'): EmailStatus | undefined {
  if (verdict === 'valid') return 'VERIFIED';
  if (verdict === 'invalid') return 'INVALID';
  return status;
}
