import { createFileRoute } from "@tanstack/react-router";
import { hasDatabase } from "~/db";

export const Route = createFileRoute("/niche/$slug")({
  loader: async ({ params }) => {
    const nicheSlug = params.slug;
    return { nicheSlug, dbConnected: hasDatabase() };
  },
  component: NichePage,
});

function NichePage() {
  const { nicheSlug, dbConnected } = Route.useLoaderData();
  const displayName = nicheSlug
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
            🤖 AI Team Activation
          </span>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Setting up your AI team for{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {displayName}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
            We're configuring specialized AI agents — research, writing, SEO, social media, email, and sales — all tailored to the{" "}
            <strong className="text-gray-200">{displayName}</strong> niche.
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
              Researching market → Planning content → Activating agents → Ready to publish
            </p>
          </div>

          {!dbConnected && (
            <div className="mt-8 glass-card mx-auto max-w-md rounded-xl p-5">
              <p className="text-sm text-yellow-400">
                ⚠️ Database not connected — running in demo mode with in-memory agents.
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href="/dashboard"
              className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:scale-[1.02]"
            >
              View AI Agent Dashboard →
            </a>
            <a href="/" className="text-sm text-gray-500 transition hover:text-gray-300">
              ← Back to homepage
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-800/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">What happens next?</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { emoji: "🔍", title: "Market Research", desc: `Our SEO Research Agent analyzes the ${displayName} market — finding high-value keywords, content gaps, and competitor strategies.` },
              { emoji: "✍️", title: "Content Creation", desc: `The AI Writer and Content Strategist plan and produce SEO-optimized articles, guides, and product reviews for ${displayName}.` },
              { emoji: "💰", title: "Monetization", desc: "Affiliate, ads, digital products — the monetization engine activates multiple revenue channels automatically." },
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
