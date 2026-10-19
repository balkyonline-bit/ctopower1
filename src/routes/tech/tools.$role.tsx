import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSql } from "~/db";
import {
  DEFAULT_PROJECT,
  DEV_ROLES,
  ROLE_ICONS,
  TASK_TITLES,
  slugToRole,
  videoTarget,
  type DevAgent,
  type RunDevAgentResult,
  type VideoTarget,
} from "~/lib/dev-roles";

export const Route = createFileRoute("/tech/tools/$role")({
  head: () => ({
    meta: [
      { title: "Development agent — how to use | EmpireAI" },
      {
        name: "description",
        content:
          "Step-by-step instructions and a video tutorial for one of the five development agents (Product Manager, Software Architect, Developer, QA Tester, Product Reviewer).",
      },
    ],
    links: [{ rel: "canonical", href: "https://empireai.com/tech" }],
  }),
  component: ToolPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Server functions (same DB contract as the /tech overview page)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LIST = `('product_manager', 'software_architect', 'developer', 'qa_tester', 'product_reviewer')`;

/** READ — all five development agents, in pipeline order (filtered client-side by role). */
const fetchDevAgents = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, role, description, tools, status, tasks_completed, last_run, video_url
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
    video_url: r.video_url ? String(r.video_url) : null,
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

/** WRITE — create an agent_tasks row for this agent and run it for real. */
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
  const description = `Project: ${project}. Created from the ${agent.role} tool page on /tech/tools (role: ${agent.role}).`;

  const inserted = (await sql`
    INSERT INTO agent_tasks (agent_id, title, description, status, priority)
    VALUES (${agent.id}, ${title}, ${description}, 'pending', 0)
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  const taskId = String(inserted[0].id);

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

/**
 * WRITE — persist (or clear, with an empty url) the tutorial video of one
 * development agent. Returns the value actually stored in the database.
 */
const saveAgentVideo = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { agentId, url } = (ctx.data ?? {}) as { agentId?: string; url?: string };
  if (!agentId) throw new Error("agentId is required");

  const trimmed = (url ?? "").trim();
  if (trimmed) {
    // Our own upload endpoint (/api/upload) answers with a RELATIVE url of the
    // shape "/api/media/<name>". src/lib/dev-roles.ts videoTarget() already
    // plays those, so they are valid stored values. Everything else must still
    // be a parseable absolute http(s) url.
    const isOwnUpload =
      trimmed.startsWith("/api/media/") && !trimmed.includes("..");
    if (!isOwnUpload) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new Error("invalid_url");
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid_url");
      }
    }
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE ai_agents
    SET video_url = ${trimmed === "" ? null : trimmed}
    WHERE id = ${agentId}
    RETURNING id, role, video_url
  `) as unknown as Array<{ id: string; role: string; video_url: string | null }>;

  if (rows.length === 0) throw new Error(`Agent not found: ${agentId}`);
  return {
    ok: true,
    id: String(rows[0].id),
    role: String(rows[0].role),
    video_url: rows[0].video_url ? String(rows[0].video_url) : null,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────

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

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

/** RIGHT column — player for whatever video the agent currently has. */
function VideoPlayer({ url }: { url: string | null }) {
  const { t } = useTranslation();
  const target: VideoTarget | null = useMemo(() => (url ? videoTarget(url) : null), [url]);

  if (!target) {
    return (
      <div
        data-video-state="empty"
        className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center"
      >
        <span className="text-3xl">🎬</span>
        <p className="text-sm text-gray-400">{t("techDev.video.empty")}</p>
      </div>
    );
  }

  return (
    <div data-video-state="set" data-video-kind={target.kind} data-video-provider={target.provider}>
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black">
        {target.kind === "video" ? (
          <video
            key={target.src}
            src={target.src}
            controls
            playsInline
            preload="metadata"
            data-video-src={target.src}
            className="aspect-video w-full bg-black"
          />
        ) : (
          <iframe
            key={target.src}
            src={target.src}
            title={t("techDev.howTo.videoLabel")}
            data-video-src={target.src}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full border-0"
          />
        )}
      </div>
      <p className="mt-2 break-all text-xs text-gray-500" data-video-url={target.src}>
        {target.src}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        <a
          href={target.src}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-indigo-400 underline hover:text-indigo-300"
        >
          {t("techDev.video.openExternal")}
        </a>
        {target.kind === "iframe" && (
          <span className="text-xs text-gray-500">{t("techDev.video.embedNote")}</span>
        )}
      </div>
    </div>
  );
}

function ToolPage() {
  const { role: rawRole } = Route.useParams();
  const role = slugToRole(String(rawRole ?? ""));
  const { t, i18n } = useTranslation();

  const [agents, setAgents] = useState<DevAgent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState("");
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunDevAgentResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [urlDraft, setUrlDraft] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDevAgents()
      .then((rows) => {
        if (cancelled) return;
        const list = rows as DevAgent[];
        setAgents(list);
        const mine = list.find((a) => a.role === role);
        if (mine?.video_url) setUrlDraft(mine.video_url);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const agent = agents?.find((a) => a.role === role) ?? null;

  const steps = useMemo(() => {
    if (!role) return [] as string[];
    const raw = t(`techDev.howTo.${role}`, { returnObjects: true }) as unknown;
    return Array.isArray(raw) ? (raw as string[]) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language, role]);

  const statusLabel = (key: string) =>
    t(
      `techDev.status.${["idle", "pending", "completed", "failed", "in_progress"].includes(key) ? key : "idle"}`,
    );

  function patchAgent(agentId: string, patch: Partial<DevAgent>) {
    setAgents((prev) => (prev ? prev.map((a) => (a.id === agentId ? { ...a, ...patch } : a)) : prev));
  }

  async function handleRun() {
    if (!agent) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = (await runDevAgentTask({
        data: { agentId: agent.id, projectName: project },
      })) as RunDevAgentResult;
      setRun(res);
      patchAgent(agent.id, { tasks_completed: res.tasks_completed, last_run: res.last_run });
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function persistVideo(agentId: string, url: string) {
    const res = (await saveAgentVideo({ data: { agentId, url } })) as {
      video_url: string | null;
    };
    patchAgent(agentId, { video_url: res.video_url });
    setUrlDraft(res.video_url ?? "");
    return res;
  }

  async function handleSaveUrl() {
    if (!agent) return;
    setVideoError(null);
    setVideoNotice(null);
    setSavingVideo(true);
    try {
      await persistVideo(agent.id, urlDraft);
      setVideoNotice(urlDraft.trim() ? "saved" : "cleared");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVideoError(message.includes("invalid_url") ? "invalidUrl" : message);
    } finally {
      setSavingVideo(false);
    }
  }

  async function handleUpload(file: File | null | undefined) {
    if (!file || !agent) return;
    setVideoError(null);
    setVideoNotice(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { ok?: boolean; url?: string; code?: string; reason?: string };
      if (!res.ok || !json.ok || !json.url) {
        setVideoError(json.code ?? json.reason ?? "server_error");
        return;
      }
      await persistVideo(agent.id, json.url);
      setVideoNotice("saved");
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const videoMessage = (value: string) => {
    if (value === "saved") return t("techDev.video.saved");
    if (value === "cleared") return t("techDev.video.cleared");
    if (value === "invalidUrl") return t("techDev.video.invalidUrl");
    return t(`techDev.video.err.${value}`, { defaultValue: value });
  };

  if (!role) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-gray-300" data-tool-not-found="1">
          {t("techDev.toolPage.notFound", { role: String(rawRole ?? "") })}
        </p>
        <a href="/tech" className="mt-6 inline-block text-indigo-400 underline">
          {t("techDev.toolPage.backToTech")}
        </a>
      </div>
    );
  }

  const name = agent?.name ?? t(`nav.tools.${role}`);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16" data-tool-page={role}>
      <a href="/tech" className="text-sm text-indigo-400 hover:text-indigo-300">
        {t("techDev.toolPage.backToTech")}
      </a>

      {/* Header — agent identity from the database */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 pb-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            <span className="text-lg">{ROLE_ICONS[role] ?? "🤖"}</span> {t("techDev.toolPage.badge")}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl" data-tool-name>
            {name}
          </h1>
          <p className="mt-2 text-sm text-gray-500" data-tool-role>
            {t("techDev.toolPage.roleLabel")}: {role}
          </p>
        </div>
        <span
          data-agent-status={agent?.status ?? "idle"}
          className="rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs font-medium text-gray-400"
        >
          {statusLabel(agent?.status ?? "idle")}
        </span>
      </header>

      {loadError && (
        <p className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {t("techDev.loadError")}: {loadError}
        </p>
      )}
      {!agents && !loadError && <p className="mt-8 text-sm text-gray-400">{t("techDev.loading")}</p>}

      {agent && (
        <section className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              {t("techDev.skillsLabel")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300" data-tool-skills>
              {agent.description}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              {t("techDev.toolsLabel")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2" data-tool-tools>
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
            <p className="mt-4 text-xs text-gray-500">
              {t("techDev.tasksCompleted", { count: agent.tasks_completed })} ·{" "}
              {agent.last_run
                ? t("techDev.lastRun", { time: new Date(agent.last_run).toLocaleString() })
                : t("techDev.neverRun")}
            </p>
          </div>
        </section>
      )}

      {/* How to use — steps LEFT, video RIGHT */}
      <section className="mt-14" id="how-to-use">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("techDev.howTo.heading")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t("techDev.howTo.subtitle")}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* LEFT: numbered steps */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6" data-howto-steps>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              {t("techDev.howTo.stepsLabel")}
            </p>
            <ol className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-4" data-step={index + 1}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t("techDev.howTo.step", { number: index + 1 })}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-300">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* RIGHT: video + URL entry + upload */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6" data-howto-video>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              {t("techDev.howTo.videoLabel")}
            </p>

            <div className="mt-4">
              <VideoPlayer url={agent?.video_url ?? null} />
            </div>

            <div className="mt-6 border-t border-gray-800 pt-5">
              <label
                htmlFor="video-url"
                className="block text-sm font-medium text-gray-300"
              >
                {t("techDev.video.urlLabel")}
              </label>
              <input
                id="video-url"
                name="video-url"
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder={t("techDev.video.urlPlaceholder")}
                className={INPUT_CLASS}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-video-save
                  onClick={handleSaveUrl}
                  disabled={savingVideo || uploading}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingVideo ? t("techDev.video.saving") : t("techDev.video.save")}
                </button>
                <button
                  type="button"
                  data-video-clear
                  onClick={() => {
                    setUrlDraft("");
                    setVideoError(null);
                    setSavingVideo(true);
                    if (!agent) return;
                    persistVideo(agent.id, "")
                      .then(() => setVideoNotice("cleared"))
                      .catch((err: unknown) =>
                        setVideoError(err instanceof Error ? err.message : String(err)),
                      )
                      .finally(() => setSavingVideo(false));
                  }}
                  disabled={savingVideo || uploading}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("techDev.video.clear")}
                </button>
                <button
                  type="button"
                  data-video-upload
                  onClick={() => fileRef.current?.click()}
                  disabled={savingVideo || uploading}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? t("techDev.video.uploading") : t("techDev.video.upload")}
                </button>
                <input
                  ref={fileRef}
                  id="video-file"
                  name="video-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0])}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">{t("techDev.video.hint")}</p>
              {videoNotice && (
                <p className="mt-2 text-xs text-emerald-300" data-video-notice>
                  {videoMessage(videoNotice)}
                </p>
              )}
              {videoError && (
                <p className="mt-2 text-xs text-red-300" data-video-error>
                  {t("techDev.video.errorPrefix")}: {videoMessage(videoError)}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Run task */}
      {agent && (
        <section className="mt-14 border-t border-gray-800 pt-10" id="run-task">
          <h2 className="text-2xl font-bold tracking-tight">{t("techDev.runTask")}</h2>
          <div className="mt-6 max-w-xl">
            <label htmlFor="tool-project-name" className="block text-sm font-medium text-gray-300">
              {t("techDev.projectLabel")}
            </label>
            <input
              id="tool-project-name"
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder={t("techDev.projectPlaceholder")}
              className={INPUT_CLASS}
            />
          </div>
          {runError && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {t("techDev.runError")}: {runError}
            </p>
          )}
          <button
            type="button"
            data-run-task
            onClick={handleRun}
            disabled={running}
            className="mt-5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? t("techDev.running") : t("techDev.runTask")}
          </button>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              {t("techDev.resultLabel")}
            </p>
            {run ? (
              <>
                <p className="mt-1 text-xs text-gray-500">
                  {t("techDev.taskCreated", { title: run.title })}
                </p>
                <pre
                  data-result-for={role}
                  className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-800 bg-gray-950/80 p-3 text-xs leading-relaxed text-gray-300"
                >
                  {run.ok ? resultSnippet(run.result) : `${t("techDev.failedResult")}: ${run.error ?? ""}`}
                </pre>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-500">{t("techDev.resultEmpty")}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
