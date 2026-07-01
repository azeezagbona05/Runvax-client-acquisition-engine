import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPost } from '@/lib/blog';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: { absolute: `${post.title} | ProspectAI Blog` },
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    keywords: post.tags,
    authors: [{ name: 'ProspectAI' }],
    openGraph: {
      title: post.title, description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`, siteName: SITE_NAME,
      type: 'article',
      publishedTime: post.date,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description, images: [`${SITE_URL}/og-image.png`] },
  };
}

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4" {...props} />,
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-3" {...props} />,
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mt-6 mb-2" {...props} />,
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4" {...props} />,
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul className="list-disc list-inside space-y-2 mb-4 text-gray-600 dark:text-gray-300" {...props} />,
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-600 dark:text-gray-300" {...props} />,
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-relaxed" {...props} />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold text-gray-900 dark:text-white" {...props} />,
  blockquote: (props: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 my-6 italic text-gray-500 dark:text-gray-400" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
  ),
  hr: () => <hr className="border-gray-200 dark:border-gray-800 my-8" />,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700" {...props} />
  ),
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'ProspectAI' },
    publisher: {
      '@type': 'Organization',
      name: 'ProspectAI',
      url: SITE_URL,
    },
    url: `${SITE_URL}/blog/${post.slug}`,
    image: `${SITE_URL}/og-image.png`,
    keywords: post.tags.join(', '),
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to blog
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {post.readingTime}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
            {post.description}
          </p>
        </header>

        <article className="prose-none">
          <MDXRemote source={post.content} components={mdxComponents} />
        </article>

        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Find your next web design client — free
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              ProspectAI searches any city, any industry, and flags businesses with no website. Generate cold emails in one click. No credit card needed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Start free — no card needed
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
