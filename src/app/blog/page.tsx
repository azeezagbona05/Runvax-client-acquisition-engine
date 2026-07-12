import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { Calendar, Clock, ArrowRight, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — Guides for Web Designers & Agencies',
  description: 'How to find web design clients, write cold emails that convert, and grow your agency in Nigeria, Ghana, Kenya, South Africa, the UK, and beyond.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'Runvax Blog — Web Design Client Growth Guides',
    description: 'Practical guides on finding local business leads, cold outreach, and scaling your web design agency in Africa and the UK.',
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: 'website',
    images: [{ url: `${SITE_URL}/og`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Runvax Blog — Web Design Client Growth Guides',
    description: 'Find clients, write better cold emails, and grow your web design agency.',
    images: [`${SITE_URL}/og`],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Guide':      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Cold Email': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Lead Gen':   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Strategy':   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Tools':      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Tutorial':   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Templates':  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Resources':  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Make Money': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'AI Tools':   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Comparison': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium mb-3">
            <BookOpen className="w-4 h-4" />
            Runvax Blog
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Guides for Web Designers & Agencies
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
            How to find clients, write cold emails that convert, and grow your web design business — in Nigeria, Ghana, Kenya, the UK, and beyond.
          </p>
        </div>

        {/* Posts */}
        <div className="space-y-8">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <article className="border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS['Guide']}`}>
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {post.readingTime}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                  {post.description}
                </p>
                <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </article>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No posts yet — check back soon.
          </div>
        )}
      </div>
    </div>
  );
}
