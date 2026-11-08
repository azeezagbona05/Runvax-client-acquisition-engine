/** Rules for who counts as a signed-in admin. No Node-only imports, so the edge middleware can use it too. */

/** An admin session only lasts this long, however long the browser's normal session lives. */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

export const adminEmailList = (): string[] => (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email: unknown): boolean => typeof email === 'string' && !!email && adminEmailList().includes(email.trim().toLowerCase());

interface AdminTokenLike { isAdmin?: unknown; adminAt?: unknown; email?: unknown }
/** True only for a session made by the admin sign-in (email code or biometric), less than 12 hours ago, for an email that is still on the admin list. */
export function adminTokenValid(t: AdminTokenLike | null | undefined, now = Date.now()): boolean {
  if (!t || t.isAdmin !== true || typeof t.adminAt !== 'number') return false;
  const age = now - t.adminAt;
  return age >= 0 && age < ADMIN_SESSION_MS && isAdminEmail(t.email);
}

type SessionLike = { user?: { email?: string | null; isAdmin?: boolean } } | null | undefined;
/** For API routes: the NextAuth session already had its admin flag re-checked (and dropped when stale) by the jwt callback. */
export function isAdminSession<S extends SessionLike>(session: S): session is NonNullable<S> & { user: { email: string } } {
  return !!session?.user && session.user.isAdmin === true && isAdminEmail(session.user.email);
}
