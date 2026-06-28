import { Business } from '@/types';

// Common African / frequently-seen country dialing codes for trunk-prefix stripping.
// Maps a national leading-zero number to its full international code.
const DEFAULT_COUNTRY_CODE = '234'; // Nigeria

/**
 * Normalize a phone number into the digits-only international format that
 * WhatsApp's wa.me links require (NO leading +, NO leading 0, NO spaces).
 *
 * Examples (Nigeria):
 *   "0803 123 4567"     -> "2348031234567"
 *   "+234 803 123 4567" -> "2348031234567"
 *   "803 123 4567"      -> "2348031234567"
 *   "08031234567"       -> "2348031234567"
 *
 * If an international number (with country code) is available, prefer it.
 */
export function normalizePhone(
  national?: string,
  international?: string,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string {
  // Prefer the international number when present — it already carries the code.
  if (international && international.trim()) {
    const intl = international.replace(/\D/g, '');
    if (intl) return intl;
  }

  if (!national || !national.trim()) return '';

  let digits = national.replace(/\D/g, '');
  if (!digits) return '';

  // Already in international form for the default country.
  if (digits.startsWith(countryCode)) return digits;

  // Local trunk format: leading 0 -> swap for country code.
  if (digits.startsWith('0')) {
    digits = countryCode + digits.slice(1);
    return digits;
  }

  // Bare local number (e.g. "8031234567") -> prepend country code.
  if (digits.length >= 7 && digits.length <= 11) {
    return countryCode + digits;
  }

  return digits;
}

/** Build a ready-to-open wa.me URL with optional prefilled text. */
export function whatsappLink(business: Business, text?: string): string | null {
  const num = normalizePhone(business.phone, business.phoneIntl);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Pretty display version, e.g. "+234 803 123 4567". */
export function displayPhone(business: Business): string {
  return business.phoneIntl || business.phone || '';
}
