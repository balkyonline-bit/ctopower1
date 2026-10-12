import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSql } from "~/db";

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

// ─────────────────────────────────────────────────────────────────────────────
// Development Agents — the five roles seeded by scripts/seed-dev-agents.mjs
// (product_manager, software_architect, developer, qa_tester, product_reviewer).
// ─────────────────────────────────────────────────────────────────────────────

const DEV_ROLES = [
  "product_manager",
  "software_architect",
  "developer",
  "qa_tester",
  "product_reviewer",
] as const;

/** Default project name used when the visitor leaves the input empty. */
const DEFAULT_PROJECT = "web platform";

/** Role-appropriate auto-title for the task a card creates. */
const TASK_TITLES: Record<string, (project: string) => string> = {
  product_manager: (p) => `Create PRD for ${p}`,
  software_architect: (p) => `Design technical architecture for ${p}`,
  developer: (p) => `Implement core modules for ${p}`,
  qa_tester: (p) => `Write test plan for ${p}`,
  product_reviewer: (p) => `Review release for ${p}`,
};

export interface DevAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  tools: string[];
  status: string;
  tasks_completed: number;
  last_run: string | null;
}

export interface RunDevAgentResult {
  ok: boolean;
  taskId: string;
  title: string;
  agentName: string;
  agentRole: string;
  result: unknown;
  error?: string;
  agentStatus: string;
  tasks_completed: number;
  last_run: string | null;
}

/** READ — the five development agents, in pipeline order. */
const fetchDevAgents = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, role, description, tools, status, tasks_completed, last_run
    FROM ai_agents
    WHERE role IN ('product_manager', 'software_architect', 'developer', 'qa_tester', 'product_reviewer')
    ORDER BY array_position(
      ARRAY['product_manager', 'software_architect', 'developer', 'qa_tester', 'product_reviewer'],
      role
    )
  `) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    role: String(r.role),
    description: String(r.description ?? ""),
    tools: Array.isArray(r.tools) ? (r.tools as string[]) : [],
    status: String(r.status ?? "idle"),
    tasks_completed: Number(r.tasks_completed ?? 0),
    last_run: r.last_run ? String(r.last_run) : null,
  })) satisfies DevAgent[];
});

/** Re-read the agent's counters after a run so the UI shows the real DB state. */
async function readAgentStats(sql: ReturnType<typeof getSql>, agentId: string) {
  const rows = (await sql`
    SELECT status, tasks_completed, last_run FROM ai_agents WHERE id = ${agentId} LIMIT 1
  `) as unknown as Array<Record<string, unknown>>;
  const row = rows[0] ?? {};
  return {
    agentStatus: String(row.status ?? "idle"),
    tasks_completed: Number(row.tasks_completed ?? 0),
    last_run: row.last_run ? String(row.last_run) : null,
  };
}

/**
 * WRITE — create an agent_tasks row for the chosen dev agent and run it for
 * real through the shared executor (pending → completed, result persisted,
 * tasks_completed + 1, last_run set). A thrown error marks the task failed and
 * is surfaced as-is; there is no fallback "success" path.
 */
const runDevAgentTask = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { agentId, projectName } = (ctx.data ?? {}) as {
    agentId?: string;
    projectName?: string;
  };

  if (!agentId) throw new Error("agentId is required");

  const sql = getSql();
  const agentRows = (await sql`
    SELECT id, name, role FROM ai_agents WHERE id = ${agentId} LIMIT 1
  `) as unknown as Array<{ id: string; name: string; role: string }>;

  if (agentRows.length === 0) throw new Error(`Agent not found: ${agentId}`);

  const agent = agentRows[0];
  if (!(DEV_ROLES as readonly string[]).includes(agent.role)) {
    throw new Error(`${agent.name} is not part of the development team`);
  }

  const project = (projectName ?? "").trim() || DEFAULT_PROJECT;
  const titleFor = TASK_TITLES[agent.role] ?? ((p: string) => `Run task for ${p}`);
  const title = titleFor(project);
  const description = `Project: ${project}. Created from the Development Agents panel on /tech (role: ${agent.role}).`;

  const inserted = (await sql`
    INSERT INTO agent_tasks (agent_id, title, description, status, priority)
    VALUES (${agent.id}, ${title}, ${description}, 'pending', 0)
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  const taskId = String(inserted[0].id);

  // Execute for real. executeTask persists the result, bumps tasks_completed
  // and sets last_run; it returns success:false (and stores the error) when the
  // LLM call itself fails.
  const { executeTask } = await import("~/services/agent-executor");

  let exec: Awaited<ReturnType<typeof executeTask>>;
  try {
    exec = await executeTask(taskId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      UPDATE agent_tasks
      SET status = 'failed', result = ${JSON.stringify({ error: message })}, completed_at = NOW()
      WHERE id = ${taskId}
    `;
    const stats = await readAgentStats(sql, agent.id);
    return {
      ok: false,
      taskId,
      title,
      agentName: agent.name,
      agentRole: agent.role,
      result: { error: message },
      error: message,
      ...stats,
    } satisfies RunDevAgentResult;
  }

  const stats = await readAgentStats(sql, agent.id);
  return {
    ok: exec.success,
    taskId,
    title,
    agentName: exec.agentName || agent.name,
    agentRole: exec.agentRole || agent.role,
    result: exec.result,
    error: exec.error,
    ...stats,
  } satisfies RunDevAgentResult;
});

function resultSnippet(result: unknown): string {
  if (result === null || result === undefined) return "";
  try {
    return typeof result === "string"
      ? result.slice(0, 600)
      : JSON.stringify(result, null, 2).slice(0, 600);
  } catch {
    return String(result).slice(0, 600);
  }
}

const ROLE_ICONS: Record<string, string> = {
  product_manager: "📋",
  software_architect: "🏗️",
  developer: "⌨️",
  qa_tester: "🧪",
  product_reviewer: "🛡️",
};

function DevAgentsSection() {
  const { t, i18n } = useTranslation();
  const [agents, setAgents] = useState<DevAgent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunDevAgentResult>>({});

  useEffect(() => {
    let cancelled = false;
    fetchDevAgents()
      .then((rows) => {
        if (!cancelled) setAgents(rows as DevAgent[]);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRun(agent: DevAgent) {
    setRunningId(agent.id);
    setRunError(null);
    try {
      const res = (await runDevAgentTask({
        data: { agentId: agent.id, projectName: project },
      })) as RunDevAgentResult;
      setResults((prev) => ({ ...prev, [agent.id]: res }));
      setAgents((prev) =>
        prev
          ? prev.map((a) =>
              a.id === agent.id
                ? {
                    ...a,
                    tasks_completed: res.tasks_completed,
                    last_run: res.last_run,
                  }
                : a,
            )
          : prev,
      );
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  const statusLabel = (key: string) =>
    t(`techDev.status.${["idle", "pending", "completed", "failed", "in_progress"].includes(key) ? key : "idle"}`);
  const statusTone: Record<string, string> = {
    idle: "text-gray-400 border-gray-700 bg-gray-800/60",
    pending: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    in_progress: "text-blue-300 border-blue-500/30 bg-blue-500/10",
    completed: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    failed: "text-red-300 border-red-500/30 bg-red-500/10",
  };

  return (
    <section className="border-t border-gray-800 px-6 py-20 sm:py-28" id="development-agents">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            <span className="text-lg">🧑‍💻</span> {t("techDev.badge")}
          </span>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("techDev.heading")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-400">
            {t("techDev.subtitle")}
          </p>
        </div>

        <div className="mt-10 mx-auto max-w-xl">
          <label
            htmlFor="dev-project-name"
            className="block text-sm font-medium text-gray-300"
          >
            {t("techDev.projectLabel")}
          </label>
          <input
            id="dev-project-name"
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder={t("techDev.projectPlaceholder")}
            className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {runError && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {t("techDev.runError")}: {runError}
          </p>
        )}

        {loadError && (
          <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {t("techDev.loadError")}: {loadError}
          </p>
        )}

        {!agents && !loadError && (
          <p className="mt-10 text-center text-sm text-gray-400">{t("techDev.loading")}</p>
        )}

        {agents && (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const run = results[agent.id];
              const isRunning = runningId === agent.id;
              const status = isRunning
                ? "in_progress"
                : run
                  ? run.ok
                    ? "completed"
                    : "failed"
                  : agent.status;
              const snippet = run ? resultSnippet(run.result) : "";

              return (
                <div
                  key={agent.id}
                  data-agent-role={agent.role}
                  className="flex flex-col rounded-2xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-indigo-500/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 text-3xl">{ROLE_ICONS[agent.role] ?? "🤖"}</div>
                      <h3 className="text-lg font-semibold text-gray-100">{agent.name}</h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone[status] ?? statusTone.idle}`}
                      data-agent-status={status}
                    >
                      {statusLabel(isRunning ? "in_progress" : status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                      {t("techDev.skillsLabel")}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400">
                      {agent.description}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                      {t("techDev.toolsLabel")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {agent.tools.length === 0 && (
                        <span className="text-sm text-gray-500">{t("techDev.noTools")}</span>
                      )}
                      {agent.tools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{t("techDev.tasksCompleted", { count: agent.tasks_completed })}</span>
                    <span>
                      {agent.last_run
                        ? t("techDev.lastRun", { time: new Date(agent.last_run).toLocaleString() })
                        : t("techDev.neverRun")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRun(agent)}
                    disabled={isRunning || runningId !== null}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRunning ? t("techDev.running") : t("techDev.runTask")}
                  </button>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                      {t("techDev.resultLabel")}
                    </p>
                    {run ? (
                      <>
                        <p className="mt-1 text-xs text-gray-500">
                          {t("techDev.taskCreated", { title: run.title })}
                        </p>
                        <pre
                          data-result-for={agent.role}
                          className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-800 bg-gray-950/80 p-3 text-xs leading-relaxed text-gray-300"
                        >
                          {run.ok ? snippet : `${t("techDev.failedResult")}: ${run.error ?? ""}`}
                        </pre>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">{t("techDev.resultEmpty")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-500">
          {t("techDev.footerNote", { language: i18n.language })}
        </p>
      </div>
    </section>
  );
}

function TechLanding() {
  const { t } = useTranslation();
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
            <span className="text-lg">💻</span> {t("tech.badge")}
          </span>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {t("tech.heroTitle")}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            {t("tech.heroSubtitle")}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/tech/articles"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40"
            >
              {t("tech.browseArticles")}
            </a>
            <a
              href="/"
              className="rounded-xl border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
            >
              {t("tech.allVerticals")}
            </a>
          </div>
        </div>
      </section>

      {/* What we cover */}
      <section className="border-t border-gray-800 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("tech.coverTitle")}
          </h2>
          <p className="mt-3 text-center text-gray-400">
            {t("tech.coverSubtitle")}
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: "🤖",
                titleKey: "aiToolReviews",
              },
              {
                emoji: "☁️",
                titleKey: "saasDeepDives",
              },
              {
                emoji: "⚡",
                titleKey: "noCodeAutomation",
              },
              {
                emoji: "📊",
                titleKey: "toolComparisons",
              },
              {
                emoji: "🛠️",
                titleKey: "setupGuides",
              },
              {
                emoji: "🔮",
                titleKey: "trendReports",
              },
            ].map((item) => (
              <div
                key={item.titleKey}
                className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6"
              >
                <div className="mb-3 text-3xl">{item.emoji}</div>
                <h3 className="text-lg font-semibold">{t(`tech.cover.${item.titleKey}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {t(`tech.cover.${item.titleKey}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Development Agents */}
      <DevAgentsSection />

      {/* Latest article CTA */}
      <section className="border-t border-gray-800 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-indigo-400">
            {t("tech.justPublished")}
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
            {t("tech.readArticle")}
          </a>
        </div>
      </section>
    </div>
  );
}
