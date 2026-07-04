import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    // Core pages
    { url: `${SITE_URL}/`,             lastModified: new Date(),              changeFrequency: 'daily',   priority: 1   },
    { url: `${SITE_URL}/pricing`,      lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/faq`,          lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/blog`,         lastModified: new Date(),              changeFrequency: 'weekly',  priority: 0.8 },

    // Comparison pages — high commercial intent
    { url: `${SITE_URL}/vs-fiverr`,    lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/vs-upwork`,    lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/vs-apollo`,    lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },

    // City landing pages — local SEO
    { url: `${SITE_URL}/web-design-clients-lagos`,        lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/web-design-clients-abuja`,        lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/web-design-clients-accra`,        lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/web-design-clients-nairobi`,      lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/web-design-clients-port-harcourt`, lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.7 },

    // App pages
    { url: `${SITE_URL}/growth`,       lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/growth/seo`,   lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/market-brief`, lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.5 },

    // Legal
    { url: `${SITE_URL}/privacy`,      lastModified: new Date('2026-07-01'), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/terms`,        lastModified: new Date('2026-07-01'), changeFrequency: 'yearly',  priority: 0.2 },

    // Blog posts
    ...blogEntries,
  ];
}
