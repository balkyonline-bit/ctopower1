import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql, hasDatabase } from "~/db";
import { useTranslation } from "react-i18next";

// ── Server functions ──

const fetchArticleCount = createServerFn().handler(async (slug: string) => {
  const sql = getSql();
  const rows = await sql`
    SELECT count(*) as cnt
    FROM articles a
    JOIN niche_profiles np ON a.niche_id = np.id
    WHERE np.slug = ${slug} AND a.status = 'published'
  `;
  return Number((rows[0] as { cnt: string }).cnt);
});

// ── Route ──

export const Route = createFileRoute("/niche/$slug")({
  loader: async ({ params }) => {
    const slug = params.slug;
    const dbConnected = hasDatabase();
    let articleCount = 0;

    if (dbConnected) {
      try {
        articleCount = await fetchArticleCount(slug);
      } catch {
        // DB might not have articles table yet
      }
    }

    return { slug, articleCount, dbConnected };
  },
  component: NichePage,
});

function NichePage() {
  const { slug, articleCount, dbConnected } = Route.useLoaderData();
  const { t } = useTranslation();

  const displayName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
          <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-cyan-500/8 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            {t("niche.badge")}
          </span>
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {t("niche.settingUp")}{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {displayName}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
            {t("niche.configuring")}{" "}
            <strong className="text-gray-200">{displayName}</strong>{" "}
            {t("niche.nicheLabel")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="h-2 w-12 rounded-full bg-indigo-500/30">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 animate-pulse" style={{ width: "100%" }} />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              {t("niche.progressLabel")}
            </p>
          </div>
          {!dbConnected && (
            <div className="mt-8 glass-card mx-auto max-w-md rounded-xl p-5">
              <p className="text-sm text-yellow-400">
                {t("niche.demoMode")}
              </p>
            </div>
          )}
          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href="/dashboard"
              className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:scale-[1.02]"
            >
              {t("niche.viewDashboard")}
            </a>
            {articleCount > 0 && (
              <a
                href={`/niche/${slug}/articles`}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-6 py-3 text-sm font-medium text-indigo-300 transition-all duration-300 hover:border-indigo-500/50 hover:bg-indigo-500/20"
              >
                📝 {articleCount} {articleCount !== 1 ? t("niche.articlesPublished_plural") : t("niche.articlesPublished")} {t("niche.viewLibrary")}
              </a>
            )}
            <a href="/" className="text-sm text-gray-500 transition hover:text-gray-300">
              {t("niche.backHome")}
            </a>
          </div>
        </div>
      </section>
      <section className="border-t border-gray-800/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">{t("niche.whatNext")}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { emoji: "🔍", title: t("niche.marketResearch"), desc: t("niche.marketResearchDesc", { niche: displayName }) },
              { emoji: "✍️", title: t("niche.contentCreation"), desc: t("niche.contentCreationDesc", { niche: displayName }) },
              { emoji: "💰", title: t("niche.monetization"), desc: t("niche.monetizationDesc") },
            ].map((item) => (
              <div key={item.title} className="glass-card rounded-2xl p-6 text-center">
                <div className="text-4xl">{item.emoji}</div>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
