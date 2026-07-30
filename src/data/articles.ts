export interface ArticleMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  readingTime: string;
}

export const articles: ArticleMeta[] = [
  {
    slug: "best-ai-tools-small-business-2026",
    title: "Best AI Tools for Small Business Owners (2026)",
    excerpt:
      "A practical, no-hype guide to the AI tools that actually save small business owners time and money — organized by category with honest pros, cons, and pricing.",
    date: "2026-07-21",
    category: "AI Tools",
    readingTime: "12 min read",
  },
];

export function getArticle(slug: string): ArticleMeta | undefined {
  return articles.find((a) => a.slug === slug);
}
