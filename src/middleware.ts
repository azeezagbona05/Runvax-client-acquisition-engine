import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin login page is always accessible
  if (pathname === '/admin/login') return NextResponse.next();

  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    if (!token.isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // The SEO/GEO growth engine is RUNVAX's own marketing tooling — admin only.
  if (pathname === '/growth' || pathname.startsWith('/growth/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.redirect(new URL('/admin/login', req.url));
    if (!token.isAdmin) return NextResponse.redirect(new URL('/command-centre', req.url));
  }

  // Industry Acquisition is admin-only. The page layout and every API route
  // also enforce the feature flag and admin check — this is the outer layer.
  if (pathname === '/acquisition' || pathname.startsWith('/acquisition/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.redirect(new URL('/admin/login', req.url));
    if (!token.isAdmin) return NextResponse.redirect(new URL('/command-centre', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/growth', '/growth/:path*', '/acquisition', '/acquisition/:path*'],
};
