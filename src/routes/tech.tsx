import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tech")({
  head: () => ({
    meta: [
      { title: "Tech — AI Tools & Automation | EmpireAI" },
      {
        name: "description",
        content:
          "Honest reviews, hands-on comparisons, and practical guides for AI tools, SaaS, and no-code automation. Part of the EmpireAI content network.",
      },
      { property: "og:title", content: "Tech — AI Tools & Automation | EmpireAI" },
      {
        property: "og:description",
        content:
          "Honest reviews, hands-on comparisons, and practical guides for AI tools, SaaS, and no-code automation.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://empireai.com/tech" }],
  }),
  component: TechLanding,
});

function TechLanding() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-[100px]" />
          <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[80px]" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            <span className="text-lg">💻</span> EmpireAI Tech Department
          </span>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              AI Tools & Automation
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            Honest reviews, hands-on comparisons, and practical guides for AI
            tools, SaaS, and no-code automation — helping you choose the right
            tools without the hype.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/tech/articles"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40"
            >
              Browse Articles →
            </a>
            <a
              href="/"
              className="rounded-xl border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
            >
              ← All Verticals
            </a>
          </div>
        </div>
      </section>

      {/* What we cover */}
      <section className="border-t border-gray-800 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            What We Cover
          </h2>
          <p className="mt-3 text-center text-gray-400">
            In-depth, hands-on content across the tools that power modern
            businesses.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: "🤖",
                title: "AI Tool Reviews",
                desc: "Honest, tested comparisons of AI writing, image, coding, and productivity tools.",
              },
              {
                emoji: "☁️",
                title: "SaaS Deep Dives",
                desc: "Detailed breakdowns of the SaaS platforms that run modern businesses — CRM, email, project management, and more.",
              },
              {
                emoji: "⚡",
                title: "No-Code Automation",
                desc: "Practical guides to automating workflows with Zapier, Make, n8n, and native integrations.",
              },
              {
                emoji: "📊",
                title: "Tool Comparisons",
                desc: "Side-by-side comparisons with real pricing, feature matrices, and use-case recommendations.",
              },
              {
                emoji: "🛠️",
                title: "Setup Guides",
                desc: "Step-by-step tutorials for getting tools up and running — from signup to first automation.",
              },
              {
                emoji: "🔮",
                title: "Trend Reports",
                desc: "Monthly roundups of new AI tools and SaaS launches worth paying attention to.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6"
              >
                <div className="mb-3 text-3xl">{item.emoji}</div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest article CTA */}
      <section className="border-t border-gray-800 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-indigo-400">
            Just Published
          </span>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            Best AI Tools for Small Business Owners (2026)
          </h2>
          <p className="mt-3 text-gray-400">
            Our first deep-dive — 10 tools organized by category with honest
            pros, cons, and pricing. No affiliate fluff, just real takes from
            real testing.
          </p>
          <a
            href="/tech/articles/article?slug=best-ai-tools-small-business-2026"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500"
          >
            Read the Article →
          </a>
        </div>
      </section>
    </div>
  );
}
