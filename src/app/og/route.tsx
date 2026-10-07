import fs from 'fs';
import path from 'path';

export const dynamic = 'force-static';

// Serves the real Runvax logo banner as the social-share image for every page
// that links to /og (layout.tsx, blog, pricing, market-brief). Prerendered
// once at build time — same pattern as sitemap.ts/robots.ts in this repo —
// so there's no per-request cost and no edge-runtime image generation.
const OG_IMAGE = fs.readFileSync(path.join(process.cwd(), 'public/og-image.png'));

export async function GET() {
  return new Response(OG_IMAGE, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
