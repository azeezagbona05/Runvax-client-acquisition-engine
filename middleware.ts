export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /auth/signin and /auth/signup
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* static files
     * - /favicon.ico
     */
    '/((?!auth/signin|auth/signup|api/auth|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
