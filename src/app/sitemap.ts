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
    { url: `${SITE_URL}/`,             lastModified: new Date(),              changeFrequency: 'daily',   priority: 1   },
    { url: `${SITE_URL}/pricing`,      lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/blog`,         lastModified: new Date(),              changeFrequency: 'weekly',  priority: 0.8 },
    ...blogEntries,
    { url: `${SITE_URL}/market-brief`, lastModified: new Date('2026-07-01'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`,      lastModified: new Date('2026-07-01'), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE_URL}/terms`,        lastModified: new Date('2026-07-01'), changeFrequency: 'yearly',  priority: 0.2 },
  ];
}
