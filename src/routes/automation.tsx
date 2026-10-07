import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

// ── Types ──
type WorkflowStatus = "draft" | "active" | "paused";
type TriggerType = "manual" | "schedule" | "event";
type StepType = "create_article" | "create_social_post" | "send_email" | "http_request" | "delay";

interface Niche {
  id: string;
  niche_name: string;
  slug: string;
}

interface WorkflowStep {
  id: string;
  workflow_id: string;
  position: number;
  type: StepType;
  config: Record<string, unknown>;
  created_at: string;
}

interface Workflow {
  id: string;
  name: string;
  niche_id: string | null;
  niche_name?: string | null;
  description: string | null;
  status: WorkflowStatus;
  trigger_type: TriggerType;
  schedule_cron: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  steps: WorkflowStep[];
  step_count: number;
}

interface Run {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  log: string | null;
  created_at: string;
}

interface Kpis {
  workflows: number;
  activeWorkflows: number;
  totalSteps: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
}

interface AutomationData {
  workflows: Workflow[];
  runs: Run[];
  niches: Niche[];
  kpis: Kpis;
}

const STEP_TYPES: StepType[] = ["create_article", "create_social_post", "send_email", "http_request", "delay"];

// ── Server: read (GET) ──
const fetchAutomationData = createServerFn().handler(async () => {
  const sql = getSql();
  const num = (v: unknown) => Number(v ?? 0);
  const [workflows, steps, runs, niches, totalWorkflows, activeWorkflows, totalSteps, totalRuns, succeededRuns, failedRuns] =
    await Promise.all([
      sql`
        SELECT w.*, np.niche_name
        FROM automation_workflows w
        LEFT JOIN niche_profiles np ON w.niche_id = np.id
        ORDER BY w.created_at DESC
      `,
      sql`
        SELECT * FROM automation_steps
        ORDER BY workflow_id ASC, position ASC
      `,
      sql`
        SELECT * FROM automation_runs
        ORDER BY started_at DESC
        LIMIT 200
      `,
      sql`SELECT id, niche_name, slug FROM niche_profiles ORDER BY niche_name ASC`,
      sql`SELECT count(*) AS c FROM automation_workflows`,
      sql`SELECT count(*) AS c FROM automation_workflows WHERE status = 'active'`,
      sql`SELECT count(*) AS c FROM automation_steps`,
      sql`SELECT count(*) AS c FROM automation_runs`,
      sql`SELECT count(*) AS c FROM automation_runs WHERE status = 'succeeded'`,
      sql`SELECT count(*) AS c FROM automation_runs WHERE status = 'failed'`,
    ]);

  const stepRows = steps as Record<string, unknown>[];
  const byWorkflow: Record<string, WorkflowStep[]> = {};
  for (const st of stepRows) {
    const wid = st.workflow_id as string;
    if (!byWorkflow[wid]) byWorkflow[wid] = [];
    byWorkflow[wid].push({
      id: st.id as string,
      workflow_id: wid,
      position: num(st.position),
      type: st.type as StepType,
      config: (st.config as Record<string, unknown>) ?? {},
      created_at: String(st.created_at),
    });
  }

  return {
    workflows: (workflows as Record<string, unknown>[]).map((r) => {
      const wid = r.id as string;
      const wfSteps = (byWorkflow[wid] ?? []).sort((a, b) => a.position - b.position);
      return {
        id: wid,
        name: r.name as string,
        niche_id: (r.niche_id as string) ?? null,
        niche_name: (r.niche_name as string) ?? null,
        description: (r.description as string) ?? null,
        status: (r.status as WorkflowStatus) ?? "draft",
        trigger_type: (r.trigger_type as TriggerType) ?? "manual",
        schedule_cron: (r.schedule_cron as string) ?? null,
        last_run_at: r.last_run_at ? String(r.last_run_at) : null,
        next_run_at: r.next_run_at ? String(r.next_run_at) : null,
        created_at: String(r.created_at),
        steps: wfSteps.map((s) => ({ ...s, config: JSON.parse(JSON.stringify(s.config)) as Record<string, unknown> })),
        step_count: wfSteps.length,
      };
    }),
    runs: (runs as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      workflow_id: r.workflow_id as string,
      status: (r.status as string) ?? "running",
      started_at: String(r.started_at),
      finished_at: r.finished_at ? String(r.finished_at) : null,
      log: (r.log as string) ?? null,
      created_at: String(r.created_at),
    })),
    niches: (niches as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      niche_name: r.niche_name as string,
      slug: r.slug as string,
    })),
    kpis: {
      workflows: num(totalWorkflows[0]?.c),
      activeWorkflows: num(activeWorkflows[0]?.c),
      totalSteps: num(totalSteps[0]?.c),
      totalRuns: num(totalRuns[0]?.c),
      succeededRuns: num(succeededRuns[0]?.c),
      failedRuns: num(failedRuns[0]?.c),
    },
  };
});

// ── Server: write (POST) ──
const upsertWorkflow = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    name: string;
    nicheId?: string | null;
    triggerType?: string;
    scheduleCron?: string | null;
    description?: string | null;
    status?: string;
  };
  const sql = getSql();
  const triggerType = input.triggerType || "manual";
  const scheduleCron = triggerType === "schedule" ? (input.scheduleCron?.trim() || null) : null;
  // Cron parsing/daemon is out of scope — persist a +1 day placeholder so next_run_at is real data.
  const nextRunAt = triggerType === "schedule" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

  if (input.id) {
    await sql`
      UPDATE automation_workflows
      SET name = ${input.name},
          niche_id = ${input.nicheId ?? null},
          trigger_type = ${triggerType},
          schedule_cron = ${scheduleCron},
          description = ${input.description ?? null},
          next_run_at = ${nextRunAt},
          updated_at = now()
      WHERE id = ${input.id}
    `;
    return { success: true, id: input.id };
  } else {
    const rows = await sql`
      INSERT INTO automation_workflows (name, niche_id, trigger_type, schedule_cron, description, status, next_run_at)
      VALUES (${input.name}, ${input.nicheId ?? null}, ${triggerType}, ${scheduleCron},
              ${input.description ?? null}, ${input.status ?? "draft"}, ${nextRunAt})
      RETURNING id
    `;
    return { success: true, id: (rows as Record<string, unknown>[])[0]?.id as string };
  }
});

const setWorkflowStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: WorkflowStatus };
  const sql = getSql();
  await sql`
    UPDATE automation_workflows SET status = ${status}, updated_at = now() WHERE id = ${id}
  `;
  return { success: true };
});

const deleteWorkflow = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM automation_workflows WHERE id = ${id}`;
  return { success: true };
});

const upsertStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    workflowId: string;
    type: StepType;
    config: Record<string, unknown>;
  };
  const sql = getSql();
  const config = JSON.stringify(input.config ?? {});
  if (input.id) {
    await sql`
      UPDATE automation_steps
      SET type = ${input.type}, config = ${config}
      WHERE id = ${input.id}
    `;
    return { success: true };
  }
  const pos = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS p
    FROM automation_steps
    WHERE workflow_id = ${input.workflowId}
  `;
  const nextPos = Number((pos as Record<string, unknown>[])[0]?.p ?? 0);
  await sql`
    INSERT INTO automation_steps (workflow_id, position, type, config)
    VALUES (${input.workflowId}, ${nextPos}, ${input.type}, ${config})
  `;
  return { success: true };
});

const deleteStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM automation_steps WHERE id = ${id}`;
  return { success: true };
});

const reorderStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, workflowId, direction } = ctx.data as {
    id: string;
    workflowId: string;
    direction: "up" | "down";
  };
  const sql = getSql();
  const rows = (await sql`
    SELECT id, position FROM automation_steps
    WHERE workflow_id = ${workflowId}
    ORDER BY position ASC
  `) as Record<string, unknown>[];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false };
  const target = direction === "up" ? rows[idx - 1] : rows[idx + 1];
  if (!target) return { success: false };
  const currentPos = Number(rows[idx].position);
  const targetPos = Number(target.position);
  // Sentinel swap that never violates UNIQUE (workflow_id, position) — same pattern as email steps.
  await sql`UPDATE automation_steps SET position = -1 WHERE id = ${id}`;
  await sql`UPDATE automation_steps SET position = ${currentPos} WHERE id = ${target.id as string}`;
  await sql`UPDATE automation_steps SET position = ${targetPos} WHERE id = ${id}`;
  return { success: true };
});

// ── Step executor (honest side effects, all real DB rows) ──
async function executeStep(
  sql: ReturnType<typeof getSql>,
  workflow: Record<string, unknown>,
  st: Record<string, unknown>
): Promise<{ ok: boolean; line: string }> {
  let config: Record<string, unknown> = {};
  if (st.config) {
    config = typeof st.config === "string" ? (JSON.parse(st.config as string) as Record<string, unknown>) : (st.config as Record<string, unknown>);
  }
  const label = `[step ${Number(st.position) ?? 0} ${st.type as string}]`;
  const nicheId = (workflow.niche_id as string) ?? null;

  switch (st.type) {
    case "create_article": {
      const title = String(config.title ?? "").trim();
      if (!title) {
        return { ok: false, line: `${label} FAILED — create_article requires a "title" in config (got ${JSON.stringify(config)})` };
      }
      const content = String(config.content ?? "").trim();
      const baseSlug = String(config.slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      const slug = (baseSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)) + "-" + Date.now().toString(36);
      const rows = await sql`
        INSERT INTO articles (niche_id, title, slug, content, excerpt, word_count, status, seo_keywords)
        VALUES (${nicheId}, ${title}, ${slug}, ${content || title}, ${String(config.excerpt ?? "").trim() || null},
                ${Math.max(content.split(/\s+/).filter(Boolean).length, 1)}, 'draft', '{automation}')
        RETURNING id
      `;
      const id = (rows as Record<string, unknown>[])[0]?.id as string;
      return { ok: true, line: `${label} created article "${title}" (article id ${id}, slug ${slug})` };
    }
    case "create_social_post": {
      const title = String(config.title ?? "").trim();
      if (!title) {
        return { ok: false, line: `${label} FAILED — create_social_post requires a "title" in config (got ${JSON.stringify(config)})` };
      }
      const contentType = String(config.content ?? "").trim();
      const platform = String(config.platform ?? "x").trim() || "x";
      const platforms = [platform];
      const link = String(config.link ?? "").trim() || null;
      const rows = await sql`
        INSERT INTO social_posts (niche_id, platform, platforms, title, content, link, scheduled_at, status)
        VALUES (${nicheId}, ${platform}, ${platforms}, ${title}, ${contentType || title}, ${link},
                now(), 'draft')
        RETURNING id
      `;
      const id = (rows as Record<string, unknown>[])[0]?.id as string;
      return { ok: true, line: `${label} created social post "${title}" for ${platform} (social_posts id ${id})` };
    }
    case "send_email": {
      const to = String(config.to ?? "").trim();
      const subject = String(config.subject ?? "").trim();
      if (!to) {
        return {
          ok: true,
          line: `${label} send_email: no recipient configured and external email delivery is not wired (no SMTP provider) — nothing sent`,
        };
      }
      // If the address belongs to a subscriber, queue a pending outbox row (NoopSender-style);
      // otherwise log honestly that delivery can't happen yet.
      const subs = (await sql`
        SELECT id FROM subscribers WHERE email = ${to.toLowerCase()}
      `) as Record<string, unknown>[];
      if (subs.length > 0) {
        await sql`
          INSERT INTO email_sends (subscriber_id, type, status, subject)
          VALUES (${subs[0].id as string}, 'campaign', 'pending', ${subject || "(no subject)"})
        `;
        return { ok: true, line: `${label} send_email: queued pending outbox row for ${to} (email_sends) — real delivery pending provider` };
      }
      return {
        ok: true,
        line: `${label} send_email: no subscriber with address ${to} — external delivery not wired (no provider); nothing sent`,
      };
    }
    case "delay": {
      const seconds = Number(config.seconds ?? 0);
      return {
        ok: true,
        line: `${label} delay: ${seconds}s — delays are not executed synchronously in this build (logged only, no waiting)`,
      };
    }
    case "http_request": {
      const url = String(config.url ?? "").trim();
      const method = String(config.method ?? "GET").toUpperCase();
      return {
        ok: true,
        line: `${label} http_request: external calls are not wired in this build — NO request made (would have ${method}ed ${url || "(no url)"})`,
      };
    }
    default:
      return { ok: false, line: `${label} FAILED — unknown step type "${String(st.type)}"` };
  }
}

const runWorkflow = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id } = ctx.data as { id: string };
  const sql = getSql();

  const wfRows = (await sql`SELECT * FROM automation_workflows WHERE id = ${id}`) as Record<string, unknown>[];
  const workflow = wfRows[0];
  if (!workflow) return { success: false, error: "Workflow not found." };

  const stepRows = (await sql`
    SELECT * FROM automation_steps WHERE workflow_id = ${id} ORDER BY position ASC
  `) as Record<string, unknown>[];

  const runRows = (await sql`
    INSERT INTO automation_runs (workflow_id, status, started_at, log)
    VALUES (${id}, 'running', now(), '')
    RETURNING id
  `) as Record<string, unknown>[];
  const runId = runRows[0]?.id as string;

  const logLines: string[] = [
    `[started] run ${runId} — workflow "${String(workflow.name)}" (${String(workflow.trigger_type)} trigger) at ${new Date().toISOString()}`,
  ];

  if (stepRows.length === 0) {
    logLines.push("[skipped] workflow has no steps — nothing to execute");
  }

  let ok = true;
  for (const st of stepRows) {
    const result = await executeStep(sql, workflow, st);
    logLines.push(result.line);
    if (!result.ok) {
      ok = false;
      logLines.push(`[aborted] run marked failed — step ${Number(st.position)} (${String(st.type)}) did not complete`);
      break;
    }
  }
  logLines.push(`[finished] status=${ok ? "succeeded" : "failed"}`);

  const log = logLines.join("\n");
  const nextRunAt = workflow.trigger_type === "schedule" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
  await sql`
    UPDATE automation_runs
    SET status = ${ok ? "succeeded" : "failed"}, finished_at = now(), log = ${log}
    WHERE id = ${runId}
  `;
  await sql`
    UPDATE automation_workflows
    SET last_run_at = now(), next_run_at = ${nextRunAt}, updated_at = now()
    WHERE id = ${id}
  `;

  return { success: true, runId, status: ok ? "succeeded" : "failed" };
});

// ── Route ──
export const Route = createFileRoute("/automation")({
  loader: () => fetchAutomationData(),
  component: Automation,
});

// ── Shared UI helpers (mirror email/monetization/analytics) ──
const inputCls =
  "w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none";
const contentCls =
  "w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none min-h-[90px]";
const btnPrimary =
  "rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost =
  "rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white";
const btnDanger =
  "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-300 hover:bg-red-500/20";
const btnGhostSm =
  "rounded-lg border border-gray-700 px-2 py-1 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">{label}</label>
      {children}
    </div>
  );
}
function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500">{text}</p>;
}
function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="border-t border-gray-800/50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-400">{error}</div>
  );
}
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const hasData = value !== "0" && value.trim() !== "";
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-2xl font-bold ${hasData ? "text-white" : "text-gray-500"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  let color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  if (status === "succeeded" || status === "active") color = "bg-green-900/60 text-green-400 border-green-500/30";
  else if (status === "failed" || status === "paused") color = "bg-red-900/60 text-red-400 border-red-500/30";
  else if (status === "running" || status === "draft") color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  else if (status === "skipped") color = "bg-gray-800/60 text-gray-400 border-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

function stepLabel(type: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  return t(`automation.stepType.${type}`, { defaultValue: type });
}

// ── Workflow form (create / edit metadata) ──
function WorkflowForm({
  editing,
  niches,
  onSaved,
  onCancelEdit,
}: {
  editing: Workflow | null;
  niches: Niche[];
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [nicheId, setNicheId] = useState(editing?.niche_id ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(editing?.trigger_type ?? "manual");
  const [scheduleCron, setScheduleCron] = useState(editing?.schedule_cron ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertWorkflow({
        data: {
          id: editing?.id ?? null,
          name: name.trim(),
          nicheId: nicheId || null,
          triggerType,
          scheduleCron: scheduleCron || null,
          description: description.trim() || null,
        },
      });
      setName("");
      setNicheId("");
      setTriggerType("manual");
      setScheduleCron("");
      setDescription("");
      onCancelEdit();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("automation.errorSaveWorkflow"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card rounded-xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("automation.form.name")}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("automation.form.namePlaceholder")} required />
        </Field>
        <Field label={t("common.niche")}>
          <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
            <option value="">{t("common.none")}</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>{n.niche_name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("automation.form.triggerType")}>
          <select className={inputCls} value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)}>
            <option value="manual">{t("automation.form.triggerManual")}</option>
            <option value="schedule">{t("automation.form.triggerSchedule")}</option>
            <option value="event">{t("automation.form.triggerEvent")}</option>
          </select>
        </Field>
        <Field label={t("monetization.revenue.description")}>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("automation.form.descriptionPlaceholder")} />
        </Field>
      </div>
      {triggerType === "schedule" && (
        <Field label={t("automation.form.scheduleCron")}>
          <input className={inputCls} value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="0 6 * * *" />
          <p className="mt-1 text-xs text-gray-500">{t("automation.pipelineNote")}</p>
        </Field>
      )}
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
          {busy ? t("common.saving") : editing ? t("automation.form.update") : t("automation.form.create")}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className={btnGhost}>
            {t("common.cancelEdit")}
          </button>
        )}
      </div>
    </form>
  );
}

// ── Step builder (visual, typed config editor) ──
function StepEditor({ workflow, onChanged }: { workflow: Workflow; onChanged: () => void }) {
  const { t } = useTranslation();
  const [stepType, setStepType] = useState<StepType>("create_article");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("x");
  const [link, setLink] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [seconds, setSeconds] = useState("0");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStepType("create_article");
    setTitle("");
    setContent("");
    setPlatform("x");
    setLink("");
    setUrl("");
    setMethod("GET");
    setSeconds("0");
    setTo("");
    setSubject("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (st: WorkflowStep) => {
    const cfg = st.config ?? {};
    setEditingId(st.id);
    setStepType(st.type);
    setTitle(String(cfg.title ?? ""));
    setContent(String(cfg.content ?? ""));
    setPlatform(String(cfg.platform ?? "x"));
    setLink(String(cfg.link ?? ""));
    setUrl(String(cfg.url ?? ""));
    setMethod(String(cfg.method ?? "GET"));
    setSeconds(String(cfg.seconds ?? 0));
    setTo(String(cfg.to ?? ""));
    setSubject(String(cfg.subject ?? ""));
  };

  const buildConfig = (): Record<string, unknown> => {
    const cfg: Record<string, unknown> = {};
    if (stepType === "create_article") {
      if (title.trim()) cfg.title = title.trim();
      if (content.trim()) cfg.content = content.trim();
    } else if (stepType === "create_social_post") {
      if (title.trim()) cfg.title = title.trim();
      if (content.trim()) cfg.content = content.trim();
      if (platform) cfg.platform = platform;
      if (link.trim()) cfg.link = link.trim();
    } else if (stepType === "send_email") {
      if (to.trim()) cfg.to = to.trim();
      if (subject.trim()) cfg.subject = subject.trim();
      if (content.trim()) cfg.body = content.trim();
    } else if (stepType === "http_request") {
      if (url.trim()) cfg.url = url.trim();
      cfg.method = method;
    } else if (stepType === "delay") {
      cfg.seconds = Number(seconds) || 0;
    }
    return cfg;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertStep({
        data: { id: editingId, workflowId: workflow.id, type: stepType, config: buildConfig() },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("automation.errorSaveStep"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (st: WorkflowStep) => {
    if (!confirm(t("automation.confirmDeleteStep", { position: st.position, type: stepLabel(st.type, t) }))) return;
    await deleteStep({ data: st.id });
    await onChanged();
  };

  const move = async (st: WorkflowStep, direction: "up" | "down") => {
    await reorderStep({ data: { id: st.id, workflowId: workflow.id, direction } });
    await onChanged();
  };

  const steps = [...workflow.steps].sort((a, b) => a.position - b.position);
  const configSummary = (st: WorkflowStep) => {
    try {
      return JSON.stringify(st.config ?? {});
    } catch {
      return "{}";
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-gray-300">{steps.length}</span> {steps.length === 1 ? t("automation.stepEditor.stepsOne") : t("automation.stepEditor.stepsMany")} —
            <span className="text-gray-500"> {t("automation.stepEditor.stepsHint")}</span>
          </p>
        </div>
      </div>

      {/* Step list (visual builder) */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800/60">
        {steps.length === 0 ? (
          <EmptyHint text={t("automation.stepEditor.noSteps")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t("automation.stepEditor.colType")}</th>
                <th className="px-3 py-2">{t("automation.stepEditor.colConfig")}</th>
                <th className="px-3 py-2 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((st, i) => (
                <tr key={st.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-3 py-2 text-gray-500">{st.position}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-white">{stepLabel(st.type, t)}</span>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-gray-400" title={configSummary(st)}>
                    {configSummary(st)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => move(st, "up")} disabled={i === 0} className={btnGhostSm} title={t("automation.stepEditor.moveUp")}>↑</button>
                      <button onClick={() => move(st, "down")} disabled={i === steps.length - 1} className={btnGhostSm} title={t("automation.stepEditor.moveDown")}>↓</button>
                      <button onClick={() => startEdit(st)} className={btnGhostSm}>{t("common.edit")}</button>
                      <button onClick={() => remove(st)} className={btnDanger}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Step form — typed config editor */}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("automation.stepEditor.stepTypeLabel")}>
            <select className={inputCls} value={stepType} onChange={(e) => setStepType(e.target.value as StepType)}>
              {STEP_TYPES.map((st) => (
                <option key={st} value={st}>{stepLabel(st, t)}</option>
              ))}
            </select>
          </Field>
          {stepType === "create_article" || stepType === "create_social_post" ? (
            <Field label={t("common.col.title")}>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("automation.stepEditor.titlePlaceholder")} />
            </Field>
          ) : stepType === "send_email" ? (
            <Field label={t("automation.stepEditor.toLabel")}>
              <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("automation.stepEditor.toPlaceholder")} />
            </Field>
          ) : stepType === "http_request" ? (
            <Field label={t("monetization.links.url")}>
              <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("automation.stepEditor.urlPlaceholder")} />
            </Field>
          ) : (
            <Field label={t("automation.stepEditor.delayLabel")}>
              <input type="number" min={0} className={inputCls} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
            </Field>
          )}
        </div>
        {stepType === "create_social_post" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("common.platform")}>
              <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="x">X / Twitter</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
              </select>
            </Field>
            <Field label={t("monetization.revenue.link")}>
              <input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("social.compose.linkPlaceholder")} />
            </Field>
          </div>
        )}
        {stepType === "http_request" && (
          <Field label={t("automation.stepEditor.methodLabel")}>
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </Field>
        )}
        {stepType === "send_email" && (
          <Field label={t("automation.stepEditor.subjectLabel")}>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("automation.stepEditor.subjectPlaceholder")} />
          </Field>
        )}
        {(stepType === "create_article" || stepType === "create_social_post" || stepType === "send_email") && (
          <Field label={stepType === "send_email" ? t("automation.stepEditor.bodyLabel") : t("automation.stepEditor.contentLabel")}>
            <textarea className={contentCls} value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("automation.stepEditor.contentPlaceholder")} />
          </Field>
        )}
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("automation.stepEditor.update") : t("automation.stepEditor.add")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Run history per workflow ──
function RunHistory({ runs, workflowId }: { runs: Run[]; workflowId: string }) {
  const { t } = useTranslation();
  const wfRuns = runs.filter((r) => r.workflow_id === workflowId).slice(0, 10);
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800/60">
      {wfRuns.length === 0 ? (
        <EmptyHint text={t("automation.runHistory.noRuns")} />
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2">{t("common.col.status")}</th>
              <th className="px-3 py-2">{t("automation.runHistory.colStarted")}</th>
              <th className="px-3 py-2">{t("automation.runHistory.colFinished")}</th>
              <th className="px-3 py-2">{t("automation.runHistory.colLog")}</th>
            </tr>
          </thead>
          <tbody>
            {wfRuns.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 last:border-0">
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2 text-xs text-gray-400">{r.started_at?.replace("T", " ").slice(0, 19)}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{r.finished_at ? r.finished_at.replace("T", " ").slice(0, 19) : "—"}</td>
                <td className="px-3 py-2">
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300">{t("automation.runHistory.viewLog")}</summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-2 font-mono text-[11px] leading-relaxed text-gray-300">
                      {r.log ?? t("automation.runHistory.noLog")}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Workflow card (metadata + run control + step builder + history) ──
function WorkflowCard({
  workflow,
  runs,
  onChanged,
  onEdit,
}: {
  workflow: Workflow;
  runs: Run[];
  onChanged: () => void;
  onEdit: (w: Workflow) => void;
}) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    setRunNote(null);
    try {
      const res = (await runWorkflow({ data: { id: workflow.id } })) as { success: boolean; status?: string; error?: string };
      if (!res.success) {
        setRunError(res.error ?? t("automation.card.runFailed"));
      } else {
        setRunNote(res.status === "succeeded" ? t("automation.card.runSucceeded") : t("automation.card.runRecordedFailed"));
      }
      await onChanged();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : t("automation.card.runFailed"));
    } finally {
      setRunning(false);
    }
  };

  const toggleStatus = async () => {
    const next: WorkflowStatus = workflow.status === "active" ? "paused" : workflow.status === "paused" ? "draft" : "active";
    await setWorkflowStatus({ data: { id: workflow.id, status: next } });
    await onChanged();
  };

  const remove = async () => {
    if (!confirm(t("automation.confirmDeleteWorkflow", { name: workflow.name }))) return;
    await deleteWorkflow({ data: workflow.id });
    await onChanged();
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
          <StatusPill status={workflow.status} />
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs capitalize text-indigo-300">{t(`automation.trigger.${workflow.trigger_type}`, { defaultValue: workflow.trigger_type })}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runNow} disabled={running} className={btnPrimary + " !px-3 !py-1.5"} title={t("automation.card.runNowTitle")}>
            {running ? t("automation.card.running") : t("automation.card.runNow")}
          </button>
          <button onClick={() => onEdit(workflow)} className={btnGhost} title={t("automation.card.editTitle")}>{t("common.edit")}</button>
          <button onClick={toggleStatus} className={btnGhost} title={t("automation.card.toggleTitle")}>
            {workflow.status === "active" ? t("monetization.pause") : workflow.status === "paused" ? t("automation.card.setDraft") : t("monetization.activate")}
          </button>
          <button onClick={remove} className={btnDanger}>{t("common.delete")}</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {workflow.niche_name ? `${t("automation.card.nichePrefix")}: ${workflow.niche_name} · ` : `${t("automation.card.noNiche")} · `}
        {workflow.step_count} {workflow.step_count === 1 ? t("automation.stepEditor.stepsOne") : t("automation.stepEditor.stepsMany")}
        {workflow.schedule_cron ? ` · ${t("automation.card.cronPrefix")}: ${workflow.schedule_cron}` : ""}
        {workflow.last_run_at ? ` · ${t("automation.card.lastRunPrefix")}: ${workflow.last_run_at.replace("T", " ").slice(0, 19)}` : ""}
        {workflow.next_run_at ? ` · ${t("automation.card.nextRunPrefix")}: ${workflow.next_run_at.replace("T", " ").slice(0, 19)}` : ""}
      </p>
      {workflow.description && <p className="mt-1 max-w-2xl text-sm text-gray-300">{workflow.description}</p>}
      <ErrorNote error={runError} />
      {runNote && <div className="mt-2 rounded-lg border border-green-500/30 bg-green-900/20 p-3 text-xs text-green-400">{runNote}</div>}

      <StepEditor workflow={workflow} onChanged={onChanged} />
      <RunHistory runs={runs} workflowId={workflow.id} />
    </div>
  );
}

// ── Page ──
function Automation() {
  const { t } = useTranslation();
  const initial = Route.useLoaderData();
  const [data, setData] = useState<AutomationData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchAutomationData());
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = data.kpis;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("automation.title")}</h1>
              <p className="mt-2 max-w-2xl text-gray-400">
                {t("automation.subtitle")} {t("automation.pipelineNote")}
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white disabled:opacity-50">
              {refreshing ? t("analytics.refreshing") : t("analytics.refresh")}
            </button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t("analytics.engagement.workflows")} value={String(kpis.workflows)} sub={t("analytics.active", { n: kpis.activeWorkflows })} />
            <KpiCard label={t("automation.kpi.steps")} value={String(kpis.totalSteps)} sub={t("automation.kpi.acrossAll")} />
            <KpiCard label={t("automation.kpi.runs")} value={String(kpis.totalRuns)} sub={t("automation.kpi.succeeded", { n: kpis.succeededRuns })} />
            <KpiCard label={t("automation.kpi.failedRuns")} value={String(kpis.failedRuns)} sub={t("automation.kpi.recordedWithLogs")} />
          </div>
        </div>
      </section>

      {/* Create / edit workflow */}
      <Section title={t("automation.buildTitle")} description={t("automation.buildDesc")}>
        <WorkflowForm
          editing={editing}
          niches={data.niches}
          onSaved={refresh}
          onCancelEdit={() => setEditing(null)}
        />
        {editing && (
          <p className="mt-2 text-xs text-gray-500">
            {t("automation.editingPrefix")} <span className="text-indigo-400">{editing.name}</span> {t("automation.editingSuffix")}
          </p>
        )}
      </Section>

      {/* Workflows */}
      <Section title={t("analytics.engagement.workflows")} description={t("automation.workflowsDesc")}>
        {data.workflows.length === 0 ? (
          <div className="glass-card rounded-xl p-5">
            <EmptyHint text={t("automation.noWorkflows")} />
          </div>
        ) : (
          <div className="space-y-6">
            {data.workflows.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                runs={data.runs}
                onChanged={refresh}
                onEdit={(wf) => {
                  setEditing(wf);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}