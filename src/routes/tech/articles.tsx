import { createFileRoute } from "@tanstack/react-router";
import { articles } from "~/data/articles";

export const Route = createFileRoute("/tech/articles")({
  head: () => ({
    meta: [
      { title: "Tech Articles — AI Tools & SaaS Reviews | EmpireAI" },
      {
        name: "description",
        content:
          "Browse our library of honest AI tool reviews, SaaS comparisons, no-code automation guides, and hands-on tech tutorials.",
      },
      {
        property: "og:title",
        content: "Tech Articles — AI Tools & SaaS Reviews | EmpireAI",
      },
      {
        property: "og:description",
        content:
          "Browse our library of honest AI tool reviews, SaaS comparisons, no-code automation guides, and hands-on tech tutorials.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://empireai.com/tech/articles" }],
  }),
  component: ArticleIndex,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ArticleIndex() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <a
            href="/tech"
            className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
          >
            ← Back to Tech
          </a>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Tech Articles
          </h1>
          <p className="mt-3 text-lg text-gray-400">
            Honest reviews, hands-on comparisons, and practical guides for AI
            tools, SaaS, and no-code automation.
          </p>
        </div>
      </section>

      {/* Article Grid */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          {articles.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-500">No articles published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <a
                  key={article.slug}
                  href={`/tech/articles/article?slug=${article.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 transition hover:border-gray-600 hover:bg-gray-900"
                >
                  {/* Card top accent */}
                  <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500" />

                  <div className="flex flex-1 flex-col p-6">
                    {/* Category + Date */}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400">
                        {article.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(article.date)}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold leading-snug group-hover:text-white">
                      {article.title}
                    </h2>

                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">
                      {article.excerpt}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {article.readingTime}
                      </span>
                      <span className="text-sm font-medium text-indigo-400 group-hover:text-indigo-300">
                        Read →
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Coming Soon */}
      <section className="border-t border-gray-800 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-bold">More Articles Coming Soon</h2>
          <p className="mt-2 text-gray-400">
            We're publishing new hands-on reviews and guides weekly. Topics in
            the pipeline: ChatGPT vs Claude vs Gemini, no-code automation
            workflows, best AI coding assistants, and monthly AI tool roundups.
          </p>
        </div>
      </section>
    </div>
  );
}
