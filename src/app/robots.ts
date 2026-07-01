import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const DISALLOWED = ['/api/', '/admin/', '/settings', '/pipeline', '/dashboard', '/auth/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Search engines + AI assistants/crawlers — explicitly allowed for GEO (generative engine optimization)
      {
        userAgent: [
          'Googlebot',
          'Bingbot',
          'GPTBot',              // OpenAI / ChatGPT
          'ChatGPT-User',
          'OAI-SearchBot',
          'Google-Extended',     // Gemini / Google AI features
          'PerplexityBot',
          'Perplexity-User',
          'ClaudeBot',           // Anthropic
          'anthropic-ai',
          'Claude-User',
          'Applebot',
          'Applebot-Extended',
          'CCBot',               // Common Crawl — feeds many AI training sets
        ],
        allow: '/',
        disallow: DISALLOWED,
      },
      // Default for everything else
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
