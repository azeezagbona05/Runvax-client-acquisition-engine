import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { rateLimit } from './rateLimiter';
import { onGoogleUserCreated } from './newUserSetup';
import { adminTokenValid } from './adminSessionShared';


// Minimum gap between lastActiveAt writes for a single session (5 minutes)
const ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    newUser: '/auth/welcome',
    error: '/auth/signin',
  },
  providers: [
    // Only registered when both keys are set, so the Google buttons stay hidden until it is configured.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Safe: Google only returns verified addresses (checked in the signIn callback), so someone
            // who signed up with a password can also use Google with the same email.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // 5 failed attempts per email per 15 minutes
        const loginIp = (((req as { headers?: Record<string, string> }).headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()) || 'unknown';
        const rl = rateLimit(`login:${email}:${loginIp}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!rl.ok) return null; // silently fail — same UX as wrong password

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) return null;
        if (user.isSuspended) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Record the IP + activity timestamp from this sign-in (fire-and-forget)
        const ip =
          (((req as { headers?: Record<string, string> }).headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()) ||
          (req as { headers?: Record<string, string> }).headers?.['x-real-ip'] ||
          null;
        void prisma.user
          .update({
            where: { id: user.id },
            data: { lastActiveAt: new Date(), ...(ip ? { lastSeenIp: ip } : {}) },
          })
          .catch(() => {});

        // A password never opens the admin area: admins sign in at /admin/login with an email code or biometric.
        return { id: user.id, email: user.email, name: user.name, plan: user.plan, emailVerified: user.emailVerified, isAdmin: false };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Only OAuth creates users through the adapter (password sign-up uses /api/auth/register).
      await onGoogleUserCreated(user).catch(() => {});
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      // Never trust an unverified Google address: it would let someone claim another person's account.
      if (!(profile as { email_verified?: boolean } | undefined)?.email_verified) return false;
      const existing = user.email ? await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { isSuspended: true } }) : null;
      if (existing?.isSuspended) return false;
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (account?.provider === 'google' && user) {
        // Adapter users lack our extra fields. Google verified the address, so mark it verified
        // (this also covers a password account that was just linked) and read plan from the DB.
        // Pre-hijack guard: if this password account was never verified, whoever set that password
        // may not own the address (they could have registered with someone else's email). Google has
        // now proven ownership, so drop the unproven password; the owner can set one via reset.
        const before = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, password: true } });
        const dropUnverifiedPassword = !!before?.password && !before.emailVerified;
        const row = await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date(), emailVerified: new Date(), ...(dropUnverifiedPassword ? { password: null } : {}) },
          select: { plan: true, emailVerified: true, email: true },
        });
        (user as { plan?: string }).plan = row.plan;
        (user as { emailVerified?: Date | null }).emailVerified = row.emailVerified;
        (user as { isAdmin?: boolean }).isAdmin = false; // Google sign-in is never an admin sign-in either
      }
      if (user) {
        token.id  = user.id;
        token.sub = user.id; // ensure sub is always the DB user id
        token.plan = (user as { plan?: string }).plan ?? 'free';
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        token.lastTouch = Date.now();
      } else if (token.id && !token.emailVerified) {
        // Poll DB on every token refresh until the user verifies, so the
        // banner disappears without requiring a sign-out/sign-in cycle.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true },
        });
        if (dbUser?.emailVerified) token.emailVerified = dbUser.emailVerified;
      }

      // The plan rides in the JWT, so an upgrade, a trial or an expiry would otherwise not show
      // until the next sign-in. Re-read it when the client asks (session.update()) and, below,
      // on the same throttle as the activity stamp.
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as string }, select: { plan: true } });
        if (fresh) token.plan = fresh.plan;
      }

      // Stamp lastActiveAt so the admin dashboard can show when a user was last
      // on the platform. This callback runs on every session refresh, so it is
      // throttled to one write per ACTIVITY_TOUCH_MS per session (the last write
      // time rides along in the JWT itself — no extra read).
      if (token.id) {
        const lastTouch = typeof token.lastTouch === 'number' ? token.lastTouch : 0;
        const now = Date.now();
        if (now - lastTouch > ACTIVITY_TOUCH_MS) {
          token.lastTouch = now;
          try {
            const row = await prisma.user.update({
              where: { id: token.id as string },
              data: { lastActiveAt: new Date(now) },
              select: { plan: true, isSuspended: true },
            });
            token.plan = row.plan;
            token.suspended = row.isSuspended;
          } catch { /* a failed refresh keeps the plan we already have */ }
        }
      }

      // The admin flag only survives for a session made by the admin sign-in, for 12 hours, for an email still on the admin list.
      if (token.isAdmin && !adminTokenValid(token as never)) token.isAdmin = false;

      return token;
    },
    async session({ session, token }) {
      // A suspended user's existing JWT must stop working: drop the user so every session check fails.
      if (token.suspended) return { expires: session.expires } as typeof session;
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.plan = token.plan as string;
        (session.user as { emailVerified?: Date | null }).emailVerified = token.emailVerified as Date | null;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};
