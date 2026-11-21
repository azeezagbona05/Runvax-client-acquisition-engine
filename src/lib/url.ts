export function getAppUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getAppName(): string {
  // The brand is fixed. An APP_NAME env var left over from an earlier product name once put "Beam AI Team" on every email.
  return 'Runvax';
}
