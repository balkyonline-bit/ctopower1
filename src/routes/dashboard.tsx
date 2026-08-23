import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// ── Server functions ──

const fetchAgents = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`SELECT * FROM ai_agents ORDER BY created_at ASC`;
  return rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: String(r.created_at),
    last_run: r.last_run ? String(r.last_run) : null,
  }));
});

const fetchTasksSummary = createServerFn().handler(async () => {
  const sql = getSql();
  const [pending, completed, inProgress] = await Promise.all([
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'pending'`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'completed'`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'in_progress'`,
  ]);
  return {
    pending: Number((pending[0] as { cnt: number }).cnt),
    completed: Number((completed[0] as { cnt: number }).cnt),
    in_progress: Number((inProgress[0] as { cnt: number }).cnt),
  };
});

const fetchRecentNiches = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT np.*, 
      (SELECT count(*) FROM agent_tasks WHERE niche_id = np.id) as task_count
    FROM niche_profiles np
    ORDER BY np.created_at DESC
    LIMIT 5
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    niche_name: r.niche_name as string,
    slug: r.slug as string,
    task_count: Number(r.task_count),
    created_at: String(r.created_at),
  }));
});

const fetchPendingTasks = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      at.id, at.title, at.description, at.status, at.priority, at.result,
      at.created_at, at.started_at, at.completed_at,
      a.name as agent_name, a.role as agent_role
    FROM agent_tasks at
    LEFT JOIN ai_agents a ON at.agent_id = a.id
    WHERE at.status = 'pending' OR at.status = 'in_progress'
    ORDER BY at.created_at DESC
    LIMIT 20
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | null,
    status: r.status as string,
    priority: r.priority as number,
    agent_name: (r.agent_name as string) ?? "Unknown Agent",
    agent_role: (r.agent_role as string) ?? "unknown",
    created_at: String(r.created_at),
  }));
});

const fetchCompletedTasks = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      at.id, at.title, at.description, at.status, at.priority, at.result,
      at.created_at, at.started_at, at.completed_at,
      a.name as agent_name, a.role as agent_role
    FROM agent_tasks at
    LEFT JOIN ai_agents a ON at.agent_id = a.id
    WHERE at.status = 'completed'
    ORDER BY at.completed_at DESC NULLS LAST
    LIMIT 10
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | null,
    status: r.status as string,
    priority: r.priority as number,
    result: r.result as unknown,
    agent_name: (r.agent_name as string) ?? "Unknown Agent",
    agent_role: (r.agent_role as string) ?? "unknown",
    created_at: String(r.created_at),
    started_at: r.started_at ? String(r.started_at) : null,
    completed_at: r.completed_at ? String(r.completed_at) : null,
  }));
});

const fetchNicheCount = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`SELECT count(*) as cnt FROM niche_profiles`;
  return Number((rows[0] as { cnt: number }).cnt);
});

const fetchAllNicheSlugs = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT id, niche_name, slug FROM niche_profiles ORDER BY created_at DESC
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    niche_name: r.niche_name as string,
    slug: r.slug as string,
  }));
});

// ── Executor server functions ──

const runTaskAction = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { executeTask } = await import("~/services/agent-executor");
  return executeTask(ctx.data as string);
});

const runPipelineAction = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { runContentPipeline } = await import("~/services/content-pipeline");
  return runContentPipeline(ctx.data as string);
});

// ── Activity log ──

const fetchActivityLog = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      al.id, al.action, al.details, al.created_at,
      a.name as agent_name, a.role as agent_role
    FROM agent_activity_log al
    LEFT JOIN ai_agents a ON al.agent_id = a.id
    ORDER BY al.created_at DESC
    LIMIT 20
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    action: r.action as string,
    details: r.details as unknown,
    agent_name: (r.agent_name as string) ?? "System",
    agent_role: (r.agent_role as string) ?? "",
    created_at: String(r.created_at),
  }));
});

// ── Agent performance stats ──

const fetchAgentStats = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      a.id, a.name, a.role, a.tasks_completed, a.performance_score, a.status, a.last_run,
      (SELECT count(*) FROM agent_tasks WHERE agent_id = a.id) as total_tasks,
      (SELECT count(*) FROM agent_tasks WHERE agent_id = a.id AND status = 'pending') as pending_tasks,
      (SELECT count(*) FROM agent_tasks WHERE agent_id = a.id AND status = 'completed') as completed_tasks,
      (SELECT count(*) FROM agent_tasks WHERE agent_id = a.id AND status = 'failed') as failed_tasks
    FROM ai_agents a
    ORDER BY a.performance_score DESC
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    role: r.role as string,
    tasks_completed: Number(r.tasks_completed),
    performance_score: Number(r.performance_score),
    status: r.status as string,
    last_run: r.last_run ? String(r.last_run) : null,
    total_tasks: Number(r.total_tasks),
    pending_tasks: Number(r.pending_tasks),
    completed_tasks: Number(r.completed_tasks),
    failed_tasks: Number(r.failed_tasks),
  }));
});

// ── Bulk operations ──

const runAllPendingForNiche = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const nicheSlug = ctx.data as string;
  const sql = getSql();
  
  const nicheRows = await sql`
    SELECT id FROM niche_profiles WHERE slug = ${nicheSlug} LIMIT 1
  `;
  if (nicheRows.length === 0) {
    throw new Error(`Niche not found: ${nicheSlug}`);
  }
  const nicheId = (nicheRows[0] as { id: string }).id;

  const taskRows = await sql`
    SELECT id FROM agent_tasks WHERE niche_id = ${nicheId} AND status = 'pending'
    ORDER BY priority DESC, created_at ASC
  `;

  const { executeTask } = await import("~/services/agent-executor");
  const results: Array<{ taskId: string; success: boolean; summary: string }> = [];

  for (const row of taskRows) {
    const taskId = (row as { id: string }).id;
    try {
      const result = await executeTask(taskId);
      results.push({
        taskId,
        success: result.success,
        summary: result.success
          ? `Completed by ${result.agentName}`
          : `Failed: ${result.error ?? "Unknown error"}`,
      });
    } catch (err) {
      results.push({
        taskId,
        success: false,
        summary: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    nicheSlug,
    tasksRun: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
});

// ── Dashboard summary (single call) ──

const fetchDashboardSummary = createServerFn().handler(async () => {
  const sql = getSql();
  
  const [agentCount, pendingCount, completedCount, inProgressCount, failedCount, nicheCount] = await Promise.all([
    sql`SELECT count(*) as cnt FROM ai_agents`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'pending'`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'completed'`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'in_progress'`,
    sql`SELECT count(*) as cnt FROM agent_tasks WHERE status = 'failed'`,
    sql`SELECT count(*) as cnt FROM niche_profiles`,
  ]);

  const getCnt = (rows: Array<{ cnt: number }>) => Number(rows[0].cnt);

  return {
    agents: getCnt(agentCount as Array<{ cnt: number }>),
    tasks: {
      pending: getCnt(pendingCount as Array<{ cnt: number }>),
      completed: getCnt(completedCount as Array<{ cnt: number }>),
      in_progress: getCnt(inProgressCount as Array<{ cnt: number }>),
      failed: getCnt(failedCount as Array<{ cnt: number }>),
      total: getCnt(pendingCount as Array<{ cnt: number }>) + getCnt(completedCount as Array<{ cnt: number }>) + getCnt(inProgressCount as Array<{ cnt: number }>) + getCnt(failedCount as Array<{ cnt: number }>),
    },
    niches: getCnt(nicheCount as Array<{ cnt: number }>),
  };
});

// ── Task management ──

const completeTask = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const taskId = ctx.data as string;
  const sql = getSql();
  await sql`
    UPDATE agent_tasks 
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${taskId}
  `;
  return { success: true };
});

const updateTaskStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { taskId, status } = ctx.data as { taskId: string; status: string };
  const sql = getSql();
  if (status === "in_progress") {
    await sql`
      UPDATE agent_tasks 
      SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
      WHERE id = ${taskId}
    `;
  } else if (status === "completed") {
    await sql`
      UPDATE agent_tasks 
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${taskId}
    `;
  } else {
    await sql`
      UPDATE agent_tasks 
      SET status = ${status}
      WHERE id = ${taskId}
    `;
  }
  return { success: true };
});

const createTask = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { agentId, title, description } = ctx.data as { agentId: string; title: string; description: string };
  const sql = getSql();
  await sql`
    INSERT INTO agent_tasks (agent_id, title, description, status)
    VALUES (${agentId}, ${title}, ${description}, 'pending')
  `;
  return { success: true };
});

// ── Route ──

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const [agents, tasks, niches, pendingTasks, completedTasks, nicheCount, allNiches] = await Promise.all([
      fetchAgents(),
      fetchTasksSummary(),
      fetchRecentNiches(),
      fetchPendingTasks(),
      fetchCompletedTasks(),
      fetchNicheCount(),
      fetchAllNicheSlugs(),
    ]);

    return { agents, tasks, niches, pendingTasks, completedTasks, nicheCount, allNiches };
  },
  component: Dashboard,
});

// ── Components ──

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: "bg-gray-700 text-gray-300",
    active: "bg-green-900/60 text-green-400 border-green-500/30",
    running: "bg-blue-900/60 text-blue-400 border-blue-500/30",
    error: "bg-red-900/60 text-red-400 border-red-500/30",
    paused: "bg-yellow-900/60 text-yellow-400 border-yellow-500/30",
  };
  const c = colors[status] ?? colors.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" || status === "running" ? "bg-current animate-pulse" : "bg-current"}`} />
      {status}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-900/60 text-yellow-400 border-yellow-500/30",
    in_progress: "bg-blue-900/60 text-blue-400 border-blue-500/30",
    completed: "bg-green-900/60 text-green-400 border-green-500/30",
    failed: "bg-red-900/60 text-red-400 border-red-500/30",
  };
  const c = colors[status] ?? colors.pending;
  const label = status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "in_progress" ? "bg-current animate-pulse" : "bg-current"}`} />
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ResultDisplay({ result }: { result: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!result) return null;

  let displayText = "";
  let isArticle = false;

  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      displayText = JSON.stringify(parsed, null, 2);
      if (parsed?.article?.content) {
        isArticle = true;
        displayText = parsed.article.content;
      }
    } catch {
      displayText = result;
    }
  } else if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    if (obj.article && typeof obj.article === "object") {
      const article = obj.article as Record<string, unknown>;
      if (typeof article.content === "string") {
        isArticle = true;
        displayText = article.content;
      }
    }
    if (!displayText) {
      displayText = JSON.stringify(result, null, 2);
    }
  }

  const preview = isArticle
    ? displayText.substring(0, 300) + "..."
    : displayText.substring(0, 200);

  return (
    <div className="mt-3 border-t border-gray-700/50 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
      >
        {expanded ? t("dashboard.hideResult") : t("dashboard.showResult")}
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg bg-gray-900/80 border border-gray-700/50 p-3 max-h-96 overflow-auto">
          {isArticle ? (
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
              {displayText}
            </div>
          ) : (
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{displayText}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function CreateTaskModal({ agents, onClose, onCreated }: { agents: Array<{ id: string; name: string }>; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !agentId || submitting) return;
    setSubmitting(true);
    try {
      await createTask({ data: { agentId, title: title.trim(), description: description.trim() } });
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t("dashboard.createTaskTitle")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("dashboard.taskTitle")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("dashboard.taskTitlePlaceholder")}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("dashboard.taskDescription")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("dashboard.taskDescPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("dashboard.assignToAgent")}</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 focus:border-indigo-500/50 focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t("dashboard.creatingTask") : t("dashboard.createTaskBtn")}
          </button>
        </form>
      </div>
    </div>
  );
}

function PipelineModal({ niches, onClose, onStarted }: { niches: Array<{ id: string; niche_name: string; slug: string }>; onClose: () => void; onStarted: (slug: string) => void }) {
  const [selected, setSelected] = useState(niches[0]?.slug ?? "");
  const { t } = useTranslation();

  const handleStart = () => {
    if (!selected) return;
    onStarted(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t("dashboard.pipelineModalTitle")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {t("dashboard.pipelineModalDesc")}
        </p>
        {niches.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">{t("dashboard.noNichesFound")}</p>
            <a href="/" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
              {t("dashboard.goHomepage")}
            </a>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">{t("dashboard.selectNiche")}</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 focus:border-indigo-500/50 focus:outline-none"
              >
                {niches.map((n) => (
                  <option key={n.id} value={n.slug}>{n.niche_name} (/{n.slug})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleStart}
              disabled={!selected}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("dashboard.startPipeline")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { agents, tasks, niches, pendingTasks, completedTasks, nicheCount, allNiches } = Route.useLoaderData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null);
  const [taskResults, setTaskResults] = useState<Record<string, unknown>>({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const { t } = useTranslation();

  const handleRunTask = async (taskId: string) => {
    setRunningTasks((prev) => new Set(prev).add(taskId));
    setTaskErrors((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    try {
      const result = await runTaskAction({ data: taskId });
      setTaskResults((prev) => ({ ...prev, [taskId]: result }));
      if (!result.success) {
        setTaskErrors((prev) => ({ ...prev, [taskId]: result.error || "Task failed" }));
      }
    } catch (err) {
      setTaskErrors((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      setRunningTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setRefreshKey((k) => k + 1);
    }
  };

  const handleStartPipeline = async (nicheSlug: string) => {
    setPipelineRunning(true);
    setPipelineResult(null);
    try {
      const result = await runPipelineAction({ data: nicheSlug });
      setPipelineResult(result as unknown as Record<string, unknown>);
    } catch (err) {
      setPipelineResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setPipelineRunning(false);
      setRefreshKey((k) => k + 1);
    }
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col" key={refreshKey}>
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("dashboard.title")}
              </h1>
              <p className="mt-2 text-gray-400">
                {t("dashboard.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPipelineModal(true)}
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition-all duration-300 hover:bg-cyan-500/20 hover:border-cyan-500/50"
              >
                {t("dashboard.runPipeline")}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40"
              >
                {t("dashboard.createTask")}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("dashboard.stats.agents")}</p>
              <p className="mt-1 text-3xl font-bold text-white">{agents.length}</p>
              <p className="mt-1 text-xs text-gray-400">
                {agents.filter((a: Record<string, unknown>) => a.status === "active").length} {t("dashboard.stats.active")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("dashboard.stats.tasksPending")}</p>
              <p className="mt-1 text-3xl font-bold text-yellow-400">{tasks.pending}</p>
              <p className="mt-1 text-xs text-gray-400">{tasks.completed} {t("dashboard.stats.completed")} · {tasks.in_progress} {t("dashboard.stats.inProgress")}</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("dashboard.stats.nicheProfiles")}</p>
              <p className="mt-1 text-3xl font-bold text-cyan-400">{nicheCount}</p>
              <p className="mt-1 text-xs text-gray-400">{t("dashboard.stats.activeNiches")}</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("dashboard.stats.totalTasks")}</p>
              <p className="mt-1 text-3xl font-bold text-white">{tasks.pending + tasks.completed + tasks.in_progress}</p>
              <p className="mt-1 text-xs text-gray-400">{t("dashboard.stats.acrossAllNiches")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline Status */}
      {pipelineRunning && (
        <section className="border-b border-gray-800/50 bg-blue-950/20 px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="glass-card rounded-xl p-5 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <Spinner />
                <div>
                  <h3 className="font-semibold text-blue-300 text-sm">{t("dashboard.pipelineRunning")}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("dashboard.pipelineRunningDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {pipelineResult && (
        <section className="border-b border-gray-800/50 bg-gray-900/30 px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <div className={`glass-card rounded-xl p-5 border ${pipelineResult.success ? "border-green-500/20" : "border-red-500/20"}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm">
                  {t("dashboard.pipelineResult")} {pipelineResult.nicheName ? String(pipelineResult.nicheName) : ""}
                </h3>
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                  pipelineResult.success
                    ? "bg-green-900/60 text-green-400 border border-green-500/30"
                    : "bg-red-900/60 text-red-400 border border-red-500/30"
                }`}>
                  {pipelineResult.success ? t("dashboard.complete") : t("dashboard.failed")}
                </span>
              </div>
              {pipelineResult.error && (
                <p className="text-sm text-red-400 mb-3">{t("dashboard.error")} {String(pipelineResult.error)}</p>
              )}
              {Array.isArray(pipelineResult.steps) && (
                <div className="space-y-2">
                  {(pipelineResult.steps as Array<Record<string, unknown>>).map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className={step.success ? "text-green-400" : "text-red-400"}>
                        {step.success ? "✓" : "✗"}
                      </span>
                      <span className="text-gray-300 font-medium">Step {String(step.step)}: {String(step.agent)}</span>
                      <span className="text-gray-500">{String(step.summary)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setPipelineResult(null)}
                className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t("dashboard.dismiss")}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent Niches */}
      {niches.length > 0 && (
        <section className="border-b border-gray-800/50 px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-bold tracking-tight">{t("dashboard.recentNiches")}</h2>
            <p className="mt-1 text-sm text-gray-400">{t("dashboard.recentNichesDesc", { count: niches.length })}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {niches.map((niche: Record<string, unknown>) => (
                <a
                  key={niche.id as string}
                  href={`/niche/${niche.slug}`}
                  className="glass-card rounded-xl p-5 transition-all duration-300 hover:border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{niche.niche_name as string}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">/{niche.slug as string}</p>
                    </div>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400">
                      {niche.task_count as number} {t("dashboard.tasks")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {t("dashboard.created")} {new Date(niche.created_at as string).toLocaleDateString()}
                  </p>
                </a>
              ))}
            </div>

            {nicheCount > 5 && (
              <p className="mt-4 text-center text-sm text-gray-500">
                {t("dashboard.showingOf", { shown: 5, total: nicheCount })}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Pending Tasks */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t("dashboard.pendingTasks")}</h2>
              <p className="mt-1 text-sm text-gray-400">{t("dashboard.pendingTasksDesc")}</p>
            </div>
            <button
              onClick={refresh}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              {t("dashboard.refresh")}
            </button>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="mt-6 glass-card rounded-xl p-8 text-center">
              <div className="text-4xl">📋</div>
              <p className="mt-3 text-lg font-medium text-white">{t("dashboard.noPendingTasks")}</p>
              <p className="mt-1 text-sm text-gray-400">
                {t("dashboard.noPendingTasksDesc")}
              </p>
              <a
                href="/"
                className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300"
              >
                {t("dashboard.createNiche")}
              </a>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {pendingTasks.map((task: Record<string, unknown>) => {
                const taskId = task.id as string;
                const isRunning = runningTasks.has(taskId);
                const taskResult = taskResults[taskId];
                const taskErr = taskErrors[taskId];

                return (
                  <div key={taskId} className="glass-card rounded-xl p-4 transition-all duration-300 hover:border-indigo-500/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-sm">{task.title as string}</h3>
                        {task.description && (
                          <p className="mt-1 text-xs text-gray-400 line-clamp-1">{task.description as string}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-indigo-400">{t("dashboard.agent")}</span> {task.agent_name as string}
                          </span>
                          <span>·</span>
                          <span>{new Date(task.created_at as string).toLocaleDateString()}</span>
                        </div>

                        {taskErr && (
                          <div className="mt-2 text-xs text-red-400 bg-red-900/20 rounded-lg p-2 border border-red-500/20">
                            {t("dashboard.error")} {taskErr}
                          </div>
                        )}

                        {taskResult && (
                          <div className="mt-2 text-xs text-green-400 bg-green-900/20 rounded-lg p-2 border border-green-500/20">
                            ✓ Task executed by {(taskResult as Record<string, unknown>).agentName as string || "agent"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TaskStatusBadge status={isRunning ? "in_progress" : (task.status as string)} />
                        <button
                          onClick={() => handleRunTask(taskId)}
                          disabled={isRunning}
                          className="rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-300 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          title="Run task with AI agent"
                        >
                          {isRunning ? (
                            <>
                              <Spinner />
                              {t("dashboard.running")}
                            </>
                          ) : (
                            t("dashboard.run")
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <section className="border-t border-gray-800/50 px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-bold tracking-tight">{t("dashboard.recentlyCompleted")}</h2>
            <p className="mt-1 text-sm text-gray-400">{t("dashboard.recentlyCompletedDesc")}</p>

            <div className="mt-6 space-y-3">
              {completedTasks.map((task: Record<string, unknown>) => {
                const taskId = task.id as string;
                const liveResult = taskResults[taskId];

                return (
                  <div key={taskId} className="glass-card rounded-xl p-4 transition-all duration-300 hover:border-green-500/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-sm">{task.title as string}</h3>
                        {task.description && (
                          <p className="mt-1 text-xs text-gray-400 line-clamp-1">{task.description as string}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-indigo-400">{t("dashboard.agent")}</span> {task.agent_name as string}
                          </span>
                          <span>·</span>
                          <span>{t("dashboard.completedOn")} {task.completed_at ? new Date(task.completed_at as string).toLocaleDateString() : "unknown"}</span>
                        </div>
                        <ResultDisplay result={liveResult?.result || task.result} />
                      </div>
                      <TaskStatusBadge status="completed" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Agent List */}
      <section className="border-t border-gray-800/50 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-bold tracking-tight">{t("dashboard.aiAgentTeam")}</h2>
          <p className="mt-1 text-sm text-gray-400">{t("dashboard.aiAgentTeamDesc")}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent: Record<string, unknown>) => (
              <div key={agent.id as string} className="glass-card rounded-xl p-5 transition-all duration-300 hover:border-indigo-500/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{agent.name as string}</h3>
                    <p className="mt-0.5 text-xs uppercase tracking-wider text-indigo-400">{agent.role as string}</p>
                  </div>
                  <StatusBadge status={agent.status as string} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-400 line-clamp-2">{agent.description as string}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{agent.tasks_completed as number} {t("dashboard.tasksDone")}</span>
                  <span>{t("dashboard.score")} {((agent.performance_score as number) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          agents={agents.map((a: Record<string, unknown>) => ({ id: a.id as string, name: a.name as string }))}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setRefreshKey((k) => k + 1);
            setTimeout(refresh, 500);
          }}
        />
      )}

      {/* Pipeline Modal */}
      {showPipelineModal && (
        <PipelineModal
          niches={allNiches.map((n: Record<string, unknown>) => ({
            id: n.id as string,
            niche_name: n.niche_name as string,
            slug: n.slug as string,
          }))}
          onClose={() => setShowPipelineModal(false)}
          onStarted={handleStartPipeline}
        />
      )}
    </div>
  );
}
