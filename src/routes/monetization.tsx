import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// ── Types ──

interface Program {
  id: string;
  name: string;
  network: string | null;
  commission_rate: number | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Link {
  id: string;
  label: string;
  url: string;
  program_id: string | null;
  niche_id: string | null;
  tracking_code: string | null;
  status: string;
  created_at: string;
  program_name?: string | null;
  niche_name?: string | null;
}

interface AdSlot {
  id: string;
  name: string;
  page_location: string | null;
  format: string | null;
  status: string;
  created_at: string;
}

interface RevenueEntry {
  id: string;
  source: string;
  amount: number;
  currency: string;
  description: string | null;
  entry_date: string;
  niche_id: string | null;
  link_id: string | null;
  niche_name?: string | null;
  link_label?: string | null;
  created_at: string;
}

interface Niche {
  id: string;
  niche_name: string;
  slug: string;
}

interface MonthlyTotal {
  month: string;
  total: number;
}

interface Kpis {
  total: number;
  month: number;
  top_source: string | null;
  top_source_total: number;
  top_niche: string | null;
  top_niche_total: number;
}

interface MonetizationData {
  programs: Program[];
  links: Link[];
  adSlots: AdSlot[];
  revenue: RevenueEntry[];
  niches: Niche[];
  kpis: Kpis;
  monthly: MonthlyTotal[];
}

// ── Server functions ──

const fetchMonetizationData = createServerFn().handler(async () => {
  const sql = getSql();

  const [programs, links, adSlots, revenue, niches, totals, monthTotals, topSource, topNiche, monthly] =
    await Promise.all([
      sql`SELECT * FROM affiliate_programs ORDER BY created_at DESC`,
      sql`
        SELECT al.*, ap.name AS program_name, np.niche_name
        FROM affiliate_links al
        LEFT JOIN affiliate_programs ap ON al.program_id = ap.id
        LEFT JOIN niche_profiles np ON al.niche_id = np.id
        ORDER BY al.created_at DESC
      `,
      sql`SELECT * FROM ad_slots ORDER BY created_at DESC`,
      sql`
        SELECT re.*, np.niche_name, al.label AS link_label
        FROM revenue_entries re
        LEFT JOIN niche_profiles np ON re.niche_id = np.id
        LEFT JOIN affiliate_links al ON re.link_id = al.id
        ORDER BY re.entry_date DESC, re.created_at DESC
        LIMIT 50
      `,
      sql`SELECT id, niche_name, slug FROM niche_profiles ORDER BY niche_name ASC`,
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM revenue_entries`,
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM revenue_entries
        WHERE entry_date >= date_trunc('month', CURRENT_DATE)
      `,
      sql`
        SELECT source, SUM(amount) AS total
        FROM revenue_entries
        GROUP BY source
        ORDER BY total DESC
        LIMIT 1
      `,
      sql`
        SELECT COALESCE(np.niche_name, 'Unassigned') AS niche_name, SUM(re.amount) AS total
        FROM revenue_entries re
        LEFT JOIN niche_profiles np ON re.niche_id = np.id
        GROUP BY COALESCE(np.niche_name, 'Unassigned')
        ORDER BY total DESC
        LIMIT 1
      `,
      sql`
        SELECT to_char(entry_date, 'YYYY-MM') AS month, SUM(amount) AS total
        FROM revenue_entries
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
      `,
    ]);

  const num = (v: unknown) => Number(v ?? 0);

  return {
    programs: (programs as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      network: (r.network as string) ?? null,
      commission_rate: r.commission_rate !== null && r.commission_rate !== undefined ? num(r.commission_rate) : null,
      notes: (r.notes as string) ?? null,
      status: (r.status as string) ?? "active",
      created_at: String(r.created_at),
    })),
    links: (links as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      label: r.label as string,
      url: r.url as string,
      program_id: (r.program_id as string) ?? null,
      niche_id: (r.niche_id as string) ?? null,
      tracking_code: (r.tracking_code as string) ?? null,
      status: (r.status as string) ?? "active",
      created_at: String(r.created_at),
      program_name: (r.program_name as string) ?? null,
      niche_name: (r.niche_name as string) ?? null,
    })),
    adSlots: (adSlots as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      page_location: (r.page_location as string) ?? null,
      format: (r.format as string) ?? null,
      status: (r.status as string) ?? "active",
      created_at: String(r.created_at),
    })),
    revenue: (revenue as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      source: r.source as string,
      amount: num(r.amount),
      currency: (r.currency as string) ?? "USD",
      description: (r.description as string) ?? null,
      entry_date: String(r.entry_date).slice(0, 10),
      niche_id: (r.niche_id as string) ?? null,
      link_id: (r.link_id as string) ?? null,
      niche_name: (r.niche_name as string) ?? null,
      link_label: (r.link_label as string) ?? null,
      created_at: String(r.created_at),
    })),
    niches: (niches as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      niche_name: r.niche_name as string,
      slug: r.slug as string,
    })),
    kpis: {
      total: num(totals[0]?.total),
      month: num(monthTotals[0]?.total),
      top_source: (topSource[0]?.source as string) ?? null,
      top_source_total: num(topSource[0]?.total),
      top_niche: (topNiche[0]?.niche_name as string) ?? null,
      top_niche_total: num(topNiche[0]?.total),
    },
    monthly: (monthly as Record<string, unknown>[]).map((r) => ({
      month: r.month as string,
      total: num(r.total),
    })),
  };
});

const upsertProgram = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const input = ctx.data as {
      id?: string | null;
      name: string;
      network?: string | null;
      commissionRate?: number | null;
      notes?: string | null;
      status?: string;
    };
    const sql = getSql();
    if (input.id) {
      await sql`
        UPDATE affiliate_programs
        SET name = ${input.name},
            network = ${input.network ?? null},
            commission_rate = ${input.commissionRate ?? null},
            notes = ${input.notes ?? null}
        WHERE id = ${input.id}
      `;
    } else {
      await sql`
        INSERT INTO affiliate_programs (name, network, commission_rate, notes, status)
        VALUES (${input.name}, ${input.network ?? null}, ${input.commissionRate ?? null}, ${input.notes ?? null}, ${input.status ?? "active"})
      `;
    }
    return { success: true };
  }
);

const setProgramStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  await sql`UPDATE affiliate_programs SET status = ${status} WHERE id = ${id}`;
  return { success: true };
});

const deleteProgram = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM affiliate_programs WHERE id = ${id}`;
  return { success: true };
});

const upsertLink = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const input = ctx.data as {
      id?: string | null;
      label: string;
      url: string;
      programId?: string | null;
      nicheId?: string | null;
      trackingCode?: string | null;
      status?: string;
    };
    const sql = getSql();
    if (input.id) {
      await sql`
        UPDATE affiliate_links
        SET label = ${input.label},
            url = ${input.url},
            program_id = ${input.programId ?? null},
            niche_id = ${input.nicheId ?? null},
            tracking_code = ${input.trackingCode ?? null}
        WHERE id = ${input.id}
      `;
    } else {
      await sql`
        INSERT INTO affiliate_links (label, url, program_id, niche_id, tracking_code, status)
        VALUES (${input.label}, ${input.url}, ${input.programId ?? null}, ${input.nicheId ?? null}, ${input.trackingCode ?? null}, ${input.status ?? "active"})
      `;
    }
    return { success: true };
  }
);

const setLinkStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  await sql`UPDATE affiliate_links SET status = ${status} WHERE id = ${id}`;
  return { success: true };
});

const deleteLink = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM affiliate_links WHERE id = ${id}`;
  return { success: true };
});

const upsertAdSlot = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const input = ctx.data as { id?: string | null; name: string; pageLocation?: string | null; format?: string | null; status?: string };
    const sql = getSql();
    if (input.id) {
      await sql`
        UPDATE ad_slots
        SET name = ${input.name},
            page_location = ${input.pageLocation ?? null},
            format = ${input.format ?? null}
        WHERE id = ${input.id}
      `;
    } else {
      await sql`
        INSERT INTO ad_slots (name, page_location, format, status)
        VALUES (${input.name}, ${input.pageLocation ?? null}, ${input.format ?? null}, ${input.status ?? "active"})
      `;
    }
    return { success: true };
  }
);

const setAdSlotStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  await sql`UPDATE ad_slots SET status = ${status} WHERE id = ${id}`;
  return { success: true };
});

const deleteAdSlot = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM ad_slots WHERE id = ${id}`;
  return { success: true };
});

const addRevenueEntry = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const input = ctx.data as {
      source: string;
      amount: number;
      currency?: string;
      description?: string | null;
      entryDate?: string | null;
      nicheId?: string | null;
      linkId?: string | null;
    };
    const sql = getSql();
    await sql`
      INSERT INTO revenue_entries (source, amount, currency, description, entry_date, niche_id, link_id)
      VALUES (${input.source}, ${input.amount}, ${input.currency ?? "USD"}, ${input.description ?? null}, ${input.entryDate ?? null}, ${input.nicheId ?? null}, ${input.linkId ?? null})
    `;
    return { success: true };
  }
);

const deleteRevenueEntry = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM revenue_entries WHERE id = ${id}`;
  return { success: true };
});

// ── Route ──

export const Route = createFileRoute("/monetization")({
  loader: () => fetchMonetizationData(),
  component: Monetization,
});

// ── Shared UI helpers ──

const inputCls =
  "w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none";

const btnPrimary =
  "rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

const btnGhost =
  "rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white";

const btnDanger =
  "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-300 hover:bg-red-500/20";

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active ? "bg-green-900/60 text-green-400 border-green-500/30" : "bg-yellow-900/60 text-yellow-400 border-yellow-500/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-current animate-pulse" : "bg-current"}`} />
      {active ? t("status.active") : t("status.paused")}
    </span>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  affiliate: "bg-indigo-900/60 text-indigo-400 border-indigo-500/30",
  ads: "bg-cyan-900/60 text-cyan-400 border-cyan-500/30",
  product: "bg-green-900/60 text-green-400 border-green-500/30",
  leadgen: "bg-purple-900/60 text-purple-400 border-purple-500/30",
};

function SourceBadge({ source }: { source: string }) {
  const { t } = useTranslation();
  const c = SOURCE_COLORS[source] ?? SOURCE_COLORS.product;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${c}`}>
      {t(`source.${source}`, { defaultValue: source })}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500">{text}</p>;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

// ── KPI cards ──

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white break-words">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Monthly totals bar chart (lightweight CSS) ──

function MonthlyBars({ monthly }: { monthly: MonthlyTotal[] }) {
  const { t } = useTranslation();
  if (monthly.length === 0) return <EmptyHint text={t("monetization.noRevenueLogged")} />;
  const max = Math.max(...monthly.map((m) => m.total), 1);
  return (
    <div className="space-y-2">
      {[...monthly].reverse().map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <span className="w-16 flex-shrink-0 text-xs text-gray-400">{m.month}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-800/60">
            <div
              className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-cyan-500"
              style={{ width: `${Math.max((m.total / max) * 100, m.total > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-300">${fmtMoney(m.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Affiliate Programs ──

function ProgramSection({ programs, onChanged }: { programs: Program[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [network, setNetwork] = useState("");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setNetwork("");
    setRate("");
    setNotes("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (p: Program) => {
    setEditingId(p.id);
    setName(p.name);
    setNetwork(p.network ?? "");
    setRate(p.commission_rate !== null ? String(p.commission_rate) : "");
    setNotes(p.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertProgram({
        data: {
          id: editingId,
          name: name.trim(),
          network: network.trim() || null,
          commissionRate: rate ? Number(rate) : null,
          notes: notes.trim() || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("monetization.programs.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: Program) => {
    await setProgramStatus({ data: { id: p.id, status: p.status === "active" ? "paused" : "active" } });
    await onChanged();
  };

  const remove = async (p: Program) => {
    if (!confirm(t("monetization.programs.confirmDelete", { name: p.name }))) return;
    await deleteProgram({ data: p.id });
    await onChanged();
  };

  return (
    <Section title={t("monetization.programs.title")} description={t("monetization.programs.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("common.col.name")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("monetization.programs.namePlaceholder")} required />
          </Field>
          <Field label={t("monetization.programs.network")}>
            <input className={inputCls} value={network} onChange={(e) => setNetwork(e.target.value)} placeholder={t("monetization.programs.networkPlaceholder")} />
          </Field>
          <Field label={t("monetization.programs.rate")}>
            <input className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="5.00" type="number" step="0.01" min="0" />
          </Field>
          <Field label={t("common.notes")}>
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("monetization.programs.notesPlaceholder")} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("monetization.programs.update") : t("monetization.programs.add")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>
              {t("common.cancelEdit")}
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {programs.length === 0 ? (
          <EmptyHint text={t("monetization.programs.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("common.col.name")}</th>
                <th className="px-4 py-3">{t("monetization.programs.network")}</th>
                <th className="px-4 py-3">{t("monetization.programs.colRate")}</th>
                <th className="px-4 py-3">{t("common.notes")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3 text-gray-400">{p.network ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{p.commission_rate !== null ? `${p.commission_rate}%` : "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{p.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={p.status} />
                      <button onClick={() => toggle(p)} className="text-xs text-gray-500 hover:text-gray-300">
                        {p.status === "active" ? t("monetization.pause") : t("monetization.activate")}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(p)} className={btnGhost}>{t("common.edit")}</button>
                      <button onClick={() => remove(p)} className={btnDanger}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ── Affiliate Links ──

function LinkSection({
  links,
  programs,
  niches,
  onChanged,
}: {
  links: Link[];
  programs: Program[];
  niches: Niche[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [programId, setProgramId] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterNiche, setFilterNiche] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setUrl("");
    setProgramId("");
    setNicheId("");
    setTrackingCode("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (l: Link) => {
    setEditingId(l.id);
    setLabel(l.label);
    setUrl(l.url);
    setProgramId(l.program_id ?? "");
    setNicheId(l.niche_id ?? "");
    setTrackingCode(l.tracking_code ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertLink({
        data: {
          id: editingId,
          label: label.trim(),
          url: url.trim(),
          programId: programId || null,
          nicheId: nicheId || null,
          trackingCode: trackingCode.trim() || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("monetization.links.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (l: Link) => {
    await setLinkStatus({ data: { id: l.id, status: l.status === "active" ? "paused" : "active" } });
    await onChanged();
  };

  const remove = async (l: Link) => {
    if (!confirm(t("monetization.links.confirmDelete", { label: l.label }))) return;
    await deleteLink({ data: l.id });
    await onChanged();
  };

  const visible = filterNiche ? links.filter((l) => l.niche_id === filterNiche) : links;

  return (
    <Section title={t("monetization.links.title")} description={t("monetization.links.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("monetization.links.label")}>
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("monetization.links.labelPlaceholder")} required />
          </Field>
          <Field label={t("monetization.links.url")}>
            <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("monetization.links.urlPlaceholder")} required />
          </Field>
          <Field label={t("monetization.links.trackingCode")}>
            <input className={inputCls} value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder={t("monetization.links.trackingPlaceholder")} />
          </Field>
          <Field label={t("monetization.links.program")}>
            <select className={inputCls} value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("common.niche")}>
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !label.trim() || !url.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("monetization.links.update") : t("monetization.links.add")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("monetization.links.filterByNiche")}</label>
        <select
          className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-100 focus:border-indigo-500/50 focus:outline-none"
          value={filterNiche}
          onChange={(e) => setFilterNiche(e.target.value)}
        >
          <option value="">{t("common.allNiches")}</option>
          {niches.map((n) => (
            <option key={n.id} value={n.id}>{n.niche_name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{visible.length === 1 ? t("monetization.links.countOne", { n: visible.length }) : t("monetization.links.countMany", { n: visible.length })}</span>
      </div>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyHint text={t("monetization.links.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("monetization.links.label")}</th>
                <th className="px-4 py-3">{t("monetization.links.url")}</th>
                <th className="px-4 py-3">{t("monetization.links.program")}</th>
                <th className="px-4 py-3">{t("common.niche")}</th>
                <th className="px-4 py-3">{t("monetization.links.colTracking")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{l.label}</td>
                  <td className="px-4 py-3">
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 max-w-[220px] truncate inline-block align-bottom">
                      {l.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{l.program_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{l.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{l.tracking_code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={l.status} />
                      <button onClick={() => toggle(l)} className="text-xs text-gray-500 hover:text-gray-300">
                        {l.status === "active" ? t("monetization.pause") : t("monetization.activate")}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(l)} className={btnGhost}>{t("common.edit")}</button>
                      <button onClick={() => remove(l)} className={btnDanger}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ── Ad Slots ──

function AdSlotSection({ adSlots, onChanged }: { adSlots: AdSlot[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [pageLocation, setPageLocation] = useState("");
  const [format, setFormat] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setPageLocation("");
    setFormat("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (s: AdSlot) => {
    setEditingId(s.id);
    setName(s.name);
    setPageLocation(s.page_location ?? "");
    setFormat(s.format ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAdSlot({
        data: {
          id: editingId,
          name: name.trim(),
          pageLocation: pageLocation.trim() || null,
          format: format.trim() || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("monetization.ads.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: AdSlot) => {
    await setAdSlotStatus({ data: { id: s.id, status: s.status === "active" ? "paused" : "active" } });
    await onChanged();
  };

  const remove = async (s: AdSlot) => {
    if (!confirm(t("monetization.ads.confirmDelete", { name: s.name }))) return;
    await deleteAdSlot({ data: s.id });
    await onChanged();
  };

  return (
    <Section title={t("monetization.ads.title")} description={t("monetization.ads.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("monetization.ads.slotName")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("monetization.ads.slotNamePlaceholder")} required />
          </Field>
          <Field label={t("monetization.ads.pageLocation")}>
            <input className={inputCls} value={pageLocation} onChange={(e) => setPageLocation(e.target.value)} placeholder={t("monetization.ads.pageLocationPlaceholder")} />
          </Field>
          <Field label={t("monetization.ads.format")}>
            <input className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)} placeholder={t("monetization.ads.formatPlaceholder")} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("monetization.ads.update") : t("monetization.ads.add")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {adSlots.length === 0 ? (
          <EmptyHint text={t("monetization.ads.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("common.col.name")}</th>
                <th className="px-4 py-3">{t("monetization.ads.pageLocation")}</th>
                <th className="px-4 py-3">{t("monetization.ads.format")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {adSlots.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3 text-gray-400">{s.page_location ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{s.format ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={s.status} />
                      <button onClick={() => toggle(s)} className="text-xs text-gray-500 hover:text-gray-300">
                        {s.status === "active" ? t("monetization.pause") : t("monetization.activate")}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(s)} className={btnGhost}>{t("common.edit")}</button>
                      <button onClick={() => remove(s)} className={btnDanger}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ── Revenue log ──

function RevenueSection({
  revenue,
  niches,
  links,
  onChanged,
}: {
  revenue: RevenueEntry[];
  niches: Niche[];
  links: Link[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState("affiliate");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [nicheId, setNicheId] = useState("");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addRevenueEntry({
        data: {
          source,
          amount: Number(amount),
          currency: currency || "USD",
          description: description.trim() || null,
          entryDate: entryDate || null,
          nicheId: nicheId || null,
          linkId: linkId || null,
        },
      });
      setAmount("");
      setDescription("");
      setNicheId("");
      setLinkId("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("monetization.revenue.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: RevenueEntry) => {
    if (!confirm(t("monetization.revenue.confirmDelete", { amount: fmtMoney(r.amount) }))) return;
    await deleteRevenueEntry({ data: r.id });
    await onChanged();
  };

  return (
    <Section title={t("monetization.revenue.title")} description={t("monetization.revenue.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("monetization.revenue.source")}>
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="affiliate">{t("source.affiliate")}</option>
              <option value="ads">{t("source.ads")}</option>
              <option value="product">{t("source.product")}</option>
              <option value="leadgen">{t("source.leadgen")}</option>
            </select>
          </Field>
          <Field label={t("monetization.revenue.amount")}>
            <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12.50" type="number" step="0.01" min="0" required />
          </Field>
          <Field label={t("monetization.revenue.currency")}>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
          </Field>
          <Field label={t("monetization.revenue.date")}>
            <input className={inputCls} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} type="date" />
          </Field>
          <Field label={t("monetization.revenue.description")}>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("monetization.revenue.descriptionPlaceholder")} />
          </Field>
          <Field label={t("common.niche")}>
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("monetization.revenue.link")}>
            <select className={inputCls} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNote error={error} />
        <button type="submit" disabled={busy || !amount || Number(amount) <= 0} className={btnPrimary}>
          {busy ? t("common.saving") : t("monetization.revenue.logRevenue")}
        </button>
      </form>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {revenue.length === 0 ? (
          <EmptyHint text={t("monetization.revenue.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("monetization.revenue.date")}</th>
                <th className="px-4 py-3">{t("monetization.revenue.source")}</th>
                <th className="px-4 py-3">{t("monetization.revenue.amount")}</th>
                <th className="px-4 py-3">{t("monetization.revenue.description")}</th>
                <th className="px-4 py-3">{t("common.niche")}</th>
                <th className="px-4 py-3">{t("monetization.revenue.link")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-gray-400">{r.entry_date}</td>
                  <td className="px-4 py-3"><SourceBadge source={r.source} /></td>
                  <td className="px-4 py-3 font-semibold text-white">{r.currency} {fmtMoney(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{r.description ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{r.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{r.link_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button onClick={() => remove(r)} className={btnDanger}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ── Page ──

function Monetization() {
  const { t } = useTranslation();
  const initial = Route.useLoaderData();
  const [data, setData] = useState<MonetizationData>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchMonetizationData());
    } finally {
      setRefreshing(false);
    }
  };

  const { kpis, monthly } = data;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("monetization.title")}</h1>
              <p className="mt-2 text-gray-400">
                {t("monetization.subtitle")}
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className={btnGhost}>
              {refreshing ? t("analytics.refreshing") : t("analytics.refresh")}
            </button>
          </div>

          {/* KPI cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t("monetization.kpi.totalRevenue")} value={`$${fmtMoney(kpis.total)}`} sub={t("monetization.kpi.allTime")} />
            <KpiCard label={t("monetization.kpi.thisMonth")} value={`$${fmtMoney(kpis.month)}`} sub={t("monetization.kpi.currentMonth")} />
            <KpiCard
              label={t("monetization.kpi.topSource")}
              value={kpis.top_source ? kpis.top_source : "—"}
              sub={kpis.top_source ? `$${fmtMoney(kpis.top_source_total)}` : t("monetization.kpi.logTopSource")}
            />
            <KpiCard
              label={t("monetization.kpi.topNiche")}
              value={kpis.top_niche ? kpis.top_niche : "—"}
              sub={kpis.top_niche ? `$${fmtMoney(kpis.top_niche_total)}` : t("monetization.kpi.logTopNiche")}
            />
          </div>

          {/* Monthly chart */}
          <div className="mt-4 glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">{t("monetization.monthlyTotals")}</h3>
            <p className="mt-0.5 text-xs text-gray-400">{t("monetization.monthlyDesc", { n: monthly.length || 0 })}</p>
            <div className="mt-4">
              <MonthlyBars monthly={monthly} />
            </div>
          </div>
        </div>
      </section>

      <RevenueSection revenue={data.revenue} niches={data.niches} links={data.links} onChanged={refresh} />
      <ProgramSection programs={data.programs} onChanged={refresh} />
      <LinkSection links={data.links} programs={data.programs} niches={data.niches} onChanged={refresh} />
      <AdSlotSection adSlots={data.adSlots} onChanged={refresh} />
    </div>
  );
}
