import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSql } from "~/db";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "EmpireAI";
  } catch {
    return "EmpireAI";
  }
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Server function: create niche profile + 3 initial tasks ──

const createNicheProfile = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const nicheInput = ctx.data as string;
  const sql = getSql();
  const trimmed = nicheInput.trim();
  const slug = slugify(trimmed);

  // Check if niche with this slug already exists
  const existing = await sql`SELECT id FROM niche_profiles WHERE slug = ${slug}`;
  if (existing.length > 0) {
    const niche = existing[0] as { id: string };
    // Create tasks if they don't exist for this niche
    const existingTasks = await sql`SELECT count(*) as cnt FROM agent_tasks WHERE niche_id = ${niche.id}`;
    if (Number(existingTasks[0].cnt) === 0) {
      await createTasksForNiche(sql, niche.id, trimmed);
    }
    return { id: niche.id, slug, niche_name: trimmed, created: false };
  }

  // Insert niche profile
  const inserted = await sql`
    INSERT INTO niche_profiles (niche_name, slug)
    VALUES (${trimmed}, ${slug})
    RETURNING id
  `;
  const nicheId = (inserted[0] as { id: string }).id;

  // Create 3 initial tasks
  await createTasksForNiche(sql, nicheId, trimmed);

  return { id: nicheId, slug, niche_name: trimmed, created: true };
});

async function createTasksForNiche(
  sql: ReturnType<typeof getSql>,
  nicheId: string,
  nicheName: string,
) {
  // Get agents by role
  const seoAgent = await sql`SELECT id FROM ai_agents WHERE role = 'seo' LIMIT 1`;
  const strategistAgent = await sql`SELECT id FROM ai_agents WHERE role = 'strategist' LIMIT 1`;
  const salesAgent = await sql`SELECT id FROM ai_agents WHERE role = 'sales' LIMIT 1`;

  const tasks = [];

  if (seoAgent.length > 0) {
    tasks.push({
      agentId: (seoAgent[0] as { id: string }).id,
      title: `Research keywords for ${nicheName}`,
      description: `Perform comprehensive keyword research for the ${nicheName} niche. Identify high-volume, low-competition keywords, analyze SERP features, and find content gaps.`,
    });
  }

  if (strategistAgent.length > 0) {
    tasks.push({
      agentId: (strategistAgent[0] as { id: string }).id,
      title: `Create content strategy for ${nicheName}`,
      description: `Build a 30-60-90 day content calendar for the ${nicheName} niche. Plan topic clusters, pillar content, and publishing cadence aligned with monetization goals.`,
    });
  }

  if (salesAgent.length > 0) {
    tasks.push({
      agentId: (salesAgent[0] as { id: string }).id,
      title: `Find affiliate programs for ${nicheName}`,
      description: `Research and identify the highest-commission affiliate programs relevant to the ${nicheName} niche. Evaluate commission rates, cookie duration, and product quality.`,
    });
  }

  for (const task of tasks) {
    await sql`
      INSERT INTO agent_tasks (agent_id, niche_id, title, description, status)
      VALUES (${task.agentId}, ${nicheId}, ${task.title}, ${task.description}, 'pending')
    `;
  }

  return tasks.length;
}

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

function NicheForm({ niche, setNiche }: { niche: string; setNiche: (v: string) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = niche.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await createNicheProfile({ data: trimmed });
      window.location.href = `/niche/${slugify(trimmed)}`;
    } catch (err) {
      console.error("Failed to create niche:", err);
      window.location.href = `/niche/${slugify(trimmed)}`;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder={t("home.placeholder")}
          className="glow-input flex-1 rounded-xl border border-gray-700 bg-gray-900/60 px-5 py-3.5 text-sm text-gray-100 placeholder-gray-500 backdrop-blur-sm transition-all duration-300 focus:border-indigo-500/50 focus:outline-none"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting}
          className="whitespace-nowrap rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t("home.creating") : t("home.cta")}
        </button>
      </div>
    </form>
  );
}

function Home() {
  const businessName = Route.useLoaderData();
  const [niche, setNiche] = useState("");
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
          <div className="absolute left-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-purple-500/8 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <span className="inline-block rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            {t("home.badge")}
          </span>

          {/* H1 */}
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{t("home.heroLine1")}</span>
            <span className="mt-2 block bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {t("home.heroLine2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
            {t("home.subtitle", { businessName })}
          </p>

          {/* Niche input */}
          <div className="mt-10">
            <NicheForm niche={niche} setNiche={setNiche} />
          </div>

          {/* Live example link */}
          <p className="mt-4">
            <a
              href="/tech"
              className="text-sm text-indigo-400/80 transition hover:text-indigo-300"
            >
              {t("home.liveDemo")}
            </a>
          </p>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-t border-gray-800/50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                emoji: "🧠",
                title: t("home.stats.aiTeam"),
                desc: t("home.stats.aiTeamDesc"),
              },
              {
                emoji: "💰",
                title: t("home.stats.revenue"),
                desc: t("home.stats.revenueDesc"),
              },
              {
                emoji: "🚀",
                title: t("home.stats.liveDemo"),
                desc: t("home.stats.liveDemoDesc"),
                href: "/tech",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="glass-card rounded-2xl p-6 transition-all duration-300 hover:border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]"
              >
                <div className="mb-3 text-2xl">{card.emoji}</div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  {card.title}
                </h3>
                {"href" in card && card.href ? (
                  <a
                    href={card.href}
                    className="mt-1 block text-sm text-indigo-400 transition hover:text-indigo-300"
                  >
                    {card.desc}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-t border-gray-800/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.howItWorks.title")}
          </h2>
          <p className="mt-3 text-center text-gray-400">
            {t("home.howItWorks.subtitle")}
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: t("home.howItWorks.step1Title"),
                desc: t("home.howItWorks.step1Desc"),
                emoji: "🎯",
              },
              {
                step: "02",
                title: t("home.howItWorks.step2Title"),
                desc: t("home.howItWorks.step2Desc"),
                emoji: "🤖",
              },
              {
                step: "03",
                title: t("home.howItWorks.step3Title"),
                desc: t("home.howItWorks.step3Desc"),
                emoji: "💸",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="glass-card rounded-2xl p-6 transition-all duration-300 hover:border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]"
              >
                <span className="text-3xl font-bold text-gray-700">
                  {item.step}
                </span>
                <div className="mt-4 text-3xl">{item.emoji}</div>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-gray-800/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.ctaSection.title")}
          </h2>
          <p className="mt-4 text-gray-400">
            {t("home.ctaSection.subtitle")}
          </p>

          <div className="mt-8">
            <NicheForm niche={niche} setNiche={setNiche} />
          </div>
        </div>
      </section>
    </div>
  );
}
