/** Phone numbers are matched on their last 9 digits, so "+234 803…" and "0803…" are the same person. */
export const phoneKey = (p: string): string => p.replace(/\D/g, '').slice(-9);
