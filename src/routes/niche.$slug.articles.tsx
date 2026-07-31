import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useTranslation } from "react-i18next";

// ── Server functions ──

const fetchNicheProfile = createServerFn().handler(async (slug: string) => {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM niche_profiles WHERE slug = ${slug} LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    id: r.id as string,
    niche_name: r.niche_name as string,
    slug: r.slug as string,
    industry: r.industry as string | null,
    target_audience: r.target_audience as string | null,
    country: r.country as string | null,
    language: r.language as string | null,
    website: r.website as string | null,
    created_at: String(r.created_at),
  };
});

const fetchArticles = createServerFn().handler(async (nicheId: string) => {
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, slug, excerpt, word_count, status, seo_keywords, published_at, created_at
    FROM articles
    WHERE niche_id = ${nicheId}
    ORDER BY published_at DESC NULLS LAST, created_at DESC
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    excerpt: (r.excerpt as string) ?? "",
    word_count: r.word_count as number,
    status: r.status as string,
    seo_keywords: (r.seo_keywords as string[]) ?? [],
    published_at: r.published_at ? String(r.published_at) : null,
    created_at: String(r.created_at),
  }));
});

// ── Route ──

export const Route = createFileRoute("/niche/$slug/articles")({
  loader: async ({ params }) => {
    const slug = params.slug;
    const profile = await fetchNicheProfile(slug);
    let articles: Awaited<ReturnType<typeof fetchArticles>> = [];

    if (profile) {
      articles = await fetchArticles(profile.id);
    }

    return { slug, profile, articles };
  },
  head: ({ loaderData }) => {
    const { profile, slug } = loaderData;
    const displayName = profile
      ? profile.niche_name
      : slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
    return {
      meta: [
        { title: `${displayName} Articles — AI Content Empire` },
        {
          name: "description",
          content: `Browse AI-generated articles for the ${displayName} niche. SEO-optimized content produced by our AI writer agent.`,
        },
      ],
    };
  },
  component: NicheArticlesPage,
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

// ── Component ──

function NicheArticlesPage() {
  const { slug, profile, articles } = Route.useLoaderData();
  const { t } = useTranslation();

  const displayName = profile
    ? profile.niche_name
    : slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  const publishedArticles = articles.filter((a) => a.status === "published");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-gray-800 px-6 py-16 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-4xl">
          <a
            href={`/niche/${slug}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
          >
            {t("articles.backTo")} {displayName}
          </a>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {displayName} {t("articles.title")}
          </h1>
          <p className="mt-3 text-lg text-gray-400">
            {t("articles.subtitle")}{" "}
            <strong className="text-gray-200">{displayName}</strong>{" "}
            {t("articles.nicheLabel")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {publishedArticles.length} {publishedArticles.length !== 1 ? t("articles.published_plural") : t("articles.published")}
          </p>
        </div>
      </section>

      {/* Article Grid or Empty State */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          {publishedArticles.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/10 text-4xl">
                📝
              </div>
              <h2 className="text-xl font-semibold">{t("articles.noArticles")}</h2>
              <p className="mt-2 text-gray-400">
                {t("articles.noArticlesDesc", { niche: displayName })}
              </p>
              <a
                href={`/niche/${slug}`}
                className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:scale-[1.02]"
              >
                {t("articles.runPipeline")}
              </a>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {publishedArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/niche/${slug}/articles/${article.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 transition hover:border-gray-600 hover:bg-gray-900"
                >
                  <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-cyan-500" />
                  <div className="flex flex-1 flex-col p-6">
                    {article.seo_keywords.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {article.seo_keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="text-lg font-semibold leading-snug text-white group-hover:text-indigo-300 transition-colors">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400 line-clamp-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {article.published_at
                          ? formatDate(article.published_at)
                          : t("articles.draft")}{" "}
                        · {readingTime(article.word_count)}
                      </span>
                      <span className="text-sm font-medium text-indigo-400 group-hover:text-indigo-300">
                        {t("articles.read")}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
