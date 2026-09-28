import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const POSTS_DIR = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** Set only when a post has been substantively revised after publication. Drives
   *  dateModified and sitemap lastModified; never used for ordering. */
  updated?: string;
  category: string;
  tags: string[];
  readingTime: string;
  content: string;
  /** True for a post Nova drafted that hasn't been reviewed/merged as final yet. */
  draft: boolean;
}

export interface BlogPostMeta extends Omit<BlogPost, 'content'> {}

export function getAllPosts(): BlogPostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '');
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      return {
        slug,
        title: data.title,
        description: data.description,
        date: data.date,
        updated: data.updated ?? undefined,
        category: data.category ?? 'Guide',
        tags: data.tags ?? [],
        readingTime: readingTime(content).text,
        draft: data.draft === true,
      };
    })
    .filter((post) => !post.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPost(slug: string): BlogPost | null {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  if (data.draft === true) return null;
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: data.updated ?? undefined,
    category: data.category ?? 'Guide',
    tags: data.tags ?? [],
    readingTime: readingTime(content).text,
    content,
    draft: false,
  };
}
