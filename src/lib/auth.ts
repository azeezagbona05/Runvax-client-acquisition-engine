import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    newUser: '/auth/signup',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;
        if (user.isSuspended) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Record the IP from this sign-in (fire-and-forget)
        const ip =
          (((req as { headers?: Record<string, string> }).headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()) ||
          (req as { headers?: Record<string, string> }).headers?.['x-real-ip'] ||
          null;
        if (ip) {
          void prisma.user.update({ where: { id: user.id }, data: { lastSeenIp: ip } }).catch(() => {});
        }

        const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
        return { id: user.id, email: user.email, name: user.name, plan: user.plan, emailVerified: user.emailVerified, isAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id  = user.id;
        token.sub = user.id; // ensure sub is always the DB user id
        token.plan = (user as { plan?: string }).plan ?? 'free';
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      } else if (token.id && !token.emailVerified) {
        // Poll DB on every token refresh until the user verifies, so the
        // banner disappears without requiring a sign-out/sign-in cycle.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true },
        });
        if (dbUser?.emailVerified) token.emailVerified = dbUser.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
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
