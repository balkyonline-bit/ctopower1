import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useTranslation } from "react-i18next";

// ── Server functions ──

const fetchArticle = createServerFn().handler(
  async (params: { nicheSlug: string; articleSlug: string }) => {
    const sql = getSql();

    const nicheRows = await sql`
      SELECT id, niche_name, slug FROM niche_profiles WHERE slug = ${params.nicheSlug} LIMIT 1
    `;
    if (nicheRows.length === 0) return null;

    const niche = nicheRows[0] as { id: string; niche_name: string; slug: string };

    const articleRows = await sql`
      SELECT a.id, a.title, a.slug, a.content, a.excerpt, a.word_count,
             a.status, a.seo_keywords, a.meta_description, a.published_at, a.created_at,
             np.niche_name, np.slug as niche_slug
      FROM articles a
      JOIN niche_profiles np ON a.niche_id = np.id
      WHERE np.slug = ${params.nicheSlug} AND a.slug = ${params.articleSlug}
      LIMIT 1
    `;

    if (articleRows.length === 0) return null;

    const r = articleRows[0] as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      slug: r.slug as string,
      content: r.content as string,
      excerpt: (r.excerpt as string) ?? "",
      word_count: r.word_count as number,
      status: r.status as string,
      seo_keywords: (r.seo_keywords as string[]) ?? [],
      meta_description: (r.meta_description as string) ?? "",
      published_at: r.published_at ? String(r.published_at) : null,
      created_at: String(r.created_at),
      niche_name: r.niche_name as string,
      niche_slug: r.niche_slug as string,
    };
  },
);

// ── Route ──

export const Route = createFileRoute("/niche/$slug/articles/$articleSlug")({
  loader: async ({ params }) => {
    const article = await fetchArticle({
      nicheSlug: params.slug,
      articleSlug: params.articleSlug,
    });
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    const article = loaderData;
    if (!article) return {};
    return {
      meta: [
        { title: `${article.title} — ${article.niche_name} | AI Content Empire` },
        {
          name: "description",
          content: article.meta_description || article.excerpt || `Read "${article.title}" — an AI-generated article for the ${article.niche_name} niche.`,
        },
        { property: "og:title", content: article.title },
        {
          property: "og:description",
          content: article.meta_description || article.excerpt || "",
        },
        { property: "og:type", content: "article" },
        ...(article.published_at
          ? [{ property: "article:published_time" as const, content: article.published_at }]
          : []),
        ...(article.seo_keywords.length > 0
          ? [{ name: "keywords" as const, content: article.seo_keywords.join(", ") }]
          : []),
      ],
    };
  },
  component: NicheArticleDetailPage,
});

// ── Helpers ──

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function readingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

function renderMarkdown(md: string): string {
  let html = md;
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      return `<pre class="my-4 overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/80 p-4 text-sm"><code class="language-${lang || "text"}">${code.trim()}</code></pre>`;
    },
  );
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-gray-800 px-1.5 py-0.5 text-sm text-cyan-400">$1</code>',
  );
  html = html.replace(/^#### (.+)$/gm, '<h4 class="mt-8 mb-3 text-lg font-semibold text-white">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-8 mb-3 text-xl font-semibold text-white">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-10 mb-4 text-2xl font-bold text-white">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-10 mb-4 text-3xl font-bold text-white">$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-indigo-400 underline hover:text-indigo-300" target="_blank" rel="noopener">$1</a>',
  );
  html = html.replace(/^[\*\-] (.+)$/gm, '<li class="ml-5 list-disc text-gray-400">$1</li>');
  html = html.replace(/((?:<li class="ml-5 list-disc[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-3 space-y-1.5">$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-gray-400">$1</li>');
  html = html.replace(/^---$/gm, '<hr class="my-8 border-gray-700" />');
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("");
      continue;
    }
    if (trimmed.startsWith("<h") || trimmed.startsWith("<pre") || trimmed.startsWith("<ul") || trimmed.startsWith("<li") || trimmed.startsWith("<hr") || trimmed.startsWith("<table") || trimmed === "</ul>") {
      result.push(line);
      continue;
    }
    result.push(`<p class="my-3 leading-relaxed text-gray-300">${trimmed}</p>`);
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ── Component ──

function NicheArticleDetailPage() {
  const article = Route.useLoaderData();
  const { t } = useTranslation();

  const articleHtml = renderMarkdown(article.content);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
        <a href={`/niche/${article.niche_slug}`} className="hover:text-indigo-400">
          {article.niche_name}
        </a>
        <span>/</span>
        <a href={`/niche/${article.niche_slug}/articles`} className="hover:text-indigo-400">
          {t("article.articles")}
        </a>
        <span>/</span>
        <span className="truncate text-gray-400">{article.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-10">
        {article.seo_keywords.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {article.seo_keywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          {article.title}
        </h1>

        {article.excerpt && (
          <p className="mt-4 text-lg leading-relaxed text-gray-400">
            {article.excerpt}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-gray-800 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-white">
            AI
          </div>
          <div>
            <p className="text-sm font-medium text-white">{t("article.aiAuthor")}</p>
            <p className="text-xs text-gray-500">
              {article.published_at
                ? `${t("article.published")} ${formatDate(article.published_at)}`
                : `${t("article.created")} ${formatDate(article.created_at)}`}{" "}
              · {readingTime(article.word_count)} · {article.word_count.toLocaleString()} {t("article.words")}
            </p>
          </div>
        </div>
      </header>

      <div
        className="prose-custom space-y-4"
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />

      <div className="mt-12 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <p className="text-xs leading-relaxed text-gray-500">
          <strong className="text-gray-400">{t("article.disclaimerLabel")}</strong>{" "}
          {t("article.disclaimer")}
        </p>
      </div>

      <div className="mt-10 border-t border-gray-800 pt-8">
        <a
          href={`/niche/${article.niche_slug}/articles`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-600 hover:text-white"
        >
          {t("article.backToArticles")}
        </a>
      </div>
    </article>
  );
}
