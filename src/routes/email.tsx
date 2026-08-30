import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";

// ── Types ──

interface List {
  id: string;
  name: string;
  niche_id: string | null;
  description: string | null;
  status: string;
  created_at: string;
  subscriber_count: number;
  niche_name?: string | null;
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  source: string | null;
  consent_source: string | null;
  niche_id: string | null;
  niche_name?: string | null;
  lists: { id: string; name: string }[];
  created_at: string;
}

interface Niche {
  id: string;
  niche_name: string;
  slug: string;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  position: number;
  delay_days: number;
  subject: string | null;
  body_html: string | null;
  created_at: string;
}

interface Sequence {
  id: string;
  name: string;
  niche_id: string | null;
  niche_name?: string | null;
  trigger_type: string;
  status: string;
  description: string | null;
  created_at: string;
  steps: SequenceStep[];
  step_count: number;
  total_delay: number;
}

interface Campaign {
  id: string;
  name: string;
  niche_id: string | null;
  niche_name?: string | null;
  list_id: string | null;
  list_name?: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface Kpis {
  subscribed: number;
  activeLists: number;
  draftCampaigns: number;
  sentCampaigns: number;
}

interface EmailData {
  lists: List[];
  subscribers: Subscriber[];
  niches: Niche[];
  sequences: Sequence[];
  campaigns: Campaign[];
  kpis: Kpis;
}

// ── Server functions ──

const fetchEmailData = createServerFn().handler(async () => {
  const sql = getSql();

  const [lists, subscribers, memberships, niches, subscribed, activeLists, draftCampaigns, sentCampaigns, sequences, steps, campaigns] =
    await Promise.all([
      sql`
        SELECT el.*, np.niche_name, COUNT(sl.subscriber_id) AS subscriber_count
        FROM email_lists el
        LEFT JOIN niche_profiles np ON el.niche_id = np.id
        LEFT JOIN subscriber_lists sl ON sl.list_id = el.id
        GROUP BY el.id, np.niche_name
        ORDER BY el.created_at DESC
      `,
      sql`
        SELECT s.*, np.niche_name
        FROM subscribers s
        LEFT JOIN niche_profiles np ON s.niche_id = np.id
        ORDER BY s.created_at DESC
      `,
      sql`
        SELECT sl.subscriber_id, el.id AS list_id, el.name AS list_name
        FROM subscriber_lists sl
        JOIN email_lists el ON el.id = sl.list_id
        ORDER BY el.name ASC
      `,
      sql`SELECT id, niche_name, slug FROM niche_profiles ORDER BY niche_name ASC`,
      sql`SELECT count(*) AS c FROM subscribers WHERE status = 'subscribed'`,
      sql`SELECT count(*) AS c FROM email_lists WHERE status = 'active'`,
      sql`SELECT count(*) AS c FROM email_campaigns WHERE status = 'draft'`,
      sql`SELECT count(*) AS c FROM email_campaigns WHERE status = 'sent'`,
      sql`
        SELECT es.*, np.niche_name
        FROM email_sequences es
        LEFT JOIN niche_profiles np ON es.niche_id = np.id
        ORDER BY es.created_at DESC
      `,
      sql`
        SELECT st.*
        FROM email_sequence_steps st
        ORDER BY st.sequence_id ASC, st.position ASC
      `,
      sql`
        SELECT ec.*, np.niche_name, el.name AS list_name
        FROM email_campaigns ec
        LEFT JOIN niche_profiles np ON ec.niche_id = np.id
        LEFT JOIN email_lists el ON ec.list_id = el.id
        ORDER BY ec.created_at DESC
      `,
    ]);

  const num = (v: unknown) => Number(v ?? 0);
  const membershipBySub: Record<string, { id: string; name: string }[]> = {};
  for (const m of memberships as Record<string, unknown>[]) {
    const sid = m.subscriber_id as string;
    if (!membershipBySub[sid]) membershipBySub[sid] = [];
    membershipBySub[sid].push({ id: m.list_id as string, name: m.list_name as string });
  }

  return {
    lists: (lists as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      niche_id: (r.niche_id as string) ?? null,
      description: (r.description as string) ?? null,
      status: (r.status as string) ?? "active",
      created_at: String(r.created_at),
      subscriber_count: num(r.subscriber_count),
      niche_name: (r.niche_name as string) ?? null,
    })),
    subscribers: (subscribers as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      first_name: (r.first_name as string) ?? null,
      last_name: (r.last_name as string) ?? null,
      status: (r.status as string) ?? "unconfirmed",
      source: (r.source as string) ?? "manual",
      consent_source: (r.consent_source as string) ?? null,
      niche_id: (r.niche_id as string) ?? null,
      niche_name: (r.niche_name as string) ?? null,
      lists: membershipBySub[r.id as string] ?? [],
      created_at: String(r.created_at),
    })),
    niches: (niches as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      niche_name: r.niche_name as string,
      slug: r.slug as string,
    })),
    sequences: (() => {
      const stepRows = steps as Record<string, unknown>[];
      const bySeq: Record<string, SequenceStep[]> = {};
      for (const st of stepRows) {
        const sid = st.sequence_id as string;
        if (!bySeq[sid]) bySeq[sid] = [];
        bySeq[sid].push({
          id: st.id as string,
          sequence_id: sid,
          position: num(st.position),
          delay_days: num(st.delay_days),
          subject: (st.subject as string) ?? null,
          body_html: (st.body_html as string) ?? null,
          created_at: String(st.created_at),
        });
      }
      return (sequences as Record<string, unknown>[]).map((r) => {
        const sid = r.id as string;
        const seqSteps = (bySeq[sid] ?? []).sort((a, b) => a.position - b.position);
        return {
          id: sid,
          name: r.name as string,
          niche_id: (r.niche_id as string) ?? null,
          niche_name: (r.niche_name as string) ?? null,
          trigger_type: (r.trigger_type as string) ?? "manual",
          status: (r.status as string) ?? "draft",
          description: (r.description as string) ?? null,
          created_at: String(r.created_at),
          steps: seqSteps,
          step_count: seqSteps.length,
          total_delay: seqSteps.reduce((a, s) => a + s.delay_days, 0),
        };
      });
    })(),
    campaigns: (campaigns as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      niche_id: (r.niche_id as string) ?? null,
      niche_name: (r.niche_name as string) ?? null,
      list_id: (r.list_id as string) ?? null,
      list_name: (r.list_name as string) ?? null,
      subject: (r.subject as string) ?? null,
      body_html: (r.body_html as string) ?? null,
      body_text: (r.body_text as string) ?? null,
      status: (r.status as string) ?? "draft",
      sent_at: r.sent_at ? String(r.sent_at) : null,
      created_at: String(r.created_at),
    })),
    kpis: {
      subscribed: num(subscribed[0]?.c),
      activeLists: num(activeLists[0]?.c),
      draftCampaigns: num(draftCampaigns[0]?.c),
      sentCampaigns: num(sentCampaigns[0]?.c),
    },
  };
});

const upsertSubscriber = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    listId?: string | null;
    nicheId?: string | null;
    source?: string;
    consentSource?: string;
  };
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const source = input.source || "manual";
  const consentSource = input.consentSource || (source === "import" ? "Imported list (user confirmed opt-in)" : "Manual entry");
  let subscriberId = input.id ?? null;

  if (subscriberId) {
    await sql`
      UPDATE subscribers
      SET email = ${email},
          first_name = ${input.firstName ?? null},
          last_name = ${input.lastName ?? null},
          niche_id = ${input.nicheId ?? null},
          updated_at = now()
      WHERE id = ${subscriberId}
    `;
  } else {
    const rows = await sql`
      INSERT INTO subscribers (email, first_name, last_name, status, source, consent_source, consent_at, niche_id)
      VALUES (${email}, ${input.firstName ?? null}, ${input.lastName ?? null}, 'unconfirmed',
              ${source}, ${consentSource}, now(), ${input.nicheId ?? null})
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, subscribers.first_name),
        last_name = COALESCE(EXCLUDED.last_name, subscribers.last_name),
        niche_id = COALESCE(EXCLUDED.niche_id, subscribers.niche_id),
        source = subscribers.source,
        updated_at = now()
      RETURNING id
    `;
    subscriberId = (rows as Record<string, unknown>[])[0]?.id as string;
  }

  if (input.listId && subscriberId) {
    await sql`
      INSERT INTO subscriber_lists (subscriber_id, list_id)
      VALUES (${subscriberId}, ${input.listId})
      ON CONFLICT (subscriber_id, list_id) DO NOTHING
    `;
  }

  return { success: true, id: subscriberId };
});

const unsubscribeSubscriber = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`
    UPDATE subscribers SET status = 'unsubscribed', updated_at = now() WHERE id = ${id}
  `;
  await sql`
    UPDATE subscriber_lists
    SET status = 'unsubscribed', unsubscribed_at = now()
    WHERE subscriber_id = ${id}
  `;
  return { success: true };
});

const upsertList = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    name: string;
    nicheId?: string | null;
    description?: string | null;
    status?: string;
  };
  const sql = getSql();
  if (input.id) {
    await sql`
      UPDATE email_lists
      SET name = ${input.name},
          niche_id = ${input.nicheId ?? null},
          description = ${input.description ?? null}
      WHERE id = ${input.id}
    `;
  } else {
    await sql`
      INSERT INTO email_lists (name, niche_id, description, status)
      VALUES (${input.name}, ${input.nicheId ?? null}, ${input.description ?? null}, ${input.status ?? "active"})
    `;
  }
  return { success: true };
});

const setListStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  await sql`UPDATE email_lists SET status = ${status} WHERE id = ${id}`;
  return { success: true };
});

const deleteList = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM email_lists WHERE id = ${id}`;
  return { success: true };
});

const sqlDeleteSubscriber = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM subscribers WHERE id = ${id}`;
  return { success: true };
});

const upsertSequence = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    name: string;
    nicheId?: string | null;
    triggerType?: string;
    description?: string | null;
  };
  const sql = getSql();
  const triggerType = input.triggerType || "manual";
  if (input.id) {
    await sql`
      UPDATE email_sequences
      SET name = ${input.name},
          niche_id = ${input.nicheId ?? null},
          trigger_type = ${triggerType},
          description = ${input.description ?? null},
          updated_at = now()
      WHERE id = ${input.id}
    `;
  } else {
    await sql`
      INSERT INTO email_sequences (name, niche_id, trigger_type, status, description)
      VALUES (${input.name}, ${input.nicheId ?? null}, ${triggerType}, 'draft', ${input.description ?? null})
    `;
  }
  return { success: true };
});

const upsertSequenceStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    sequenceId: string;
    delayDays?: number;
    subject?: string | null;
    bodyHtml?: string | null;
  };
  const sql = getSql();
  const delayDays = Number(input.delayDays ?? 0);
  if (input.id) {
    await sql`
      UPDATE email_sequence_steps
      SET delay_days = ${delayDays},
          subject = ${input.subject ?? null},
          body_html = ${input.bodyHtml ?? null}
      WHERE id = ${input.id}
    `;
  } else {
    const pos = await sql`
      SELECT COALESCE(MAX(position), -1) + 1 AS p
      FROM email_sequence_steps
      WHERE sequence_id = ${input.sequenceId}
    `;
    const nextPos = Number((pos as Record<string, unknown>[])[0]?.p ?? 0);
    await sql`
      INSERT INTO email_sequence_steps (sequence_id, position, delay_days, subject, body_html)
      VALUES (${input.sequenceId}, ${nextPos}, ${delayDays}, ${input.subject ?? null}, ${input.bodyHtml ?? null})
    `;
  }
  return { success: true };
});

const deleteSequenceStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM email_sequence_steps WHERE id = ${id}`;
  return { success: true };
});

const reorderSequenceStep = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, sequenceId, direction } = ctx.data as {
    id: string;
    sequenceId: string;
    direction: "up" | "down";
  };
  const sql = getSql();
  const rows = (await sql`
    SELECT id, position FROM email_sequence_steps
    WHERE sequence_id = ${sequenceId}
    ORDER BY position ASC
  `) as Record<string, unknown>[];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false };
  const target = direction === "up" ? rows[idx - 1] : rows[idx + 1];
  if (!target) return { success: false };
  const currentPos = Number(rows[idx].position);
  const targetPos = Number(target.position);
  // Atomic swap that never violates UNIQUE (sequence_id, position): move the step to a
  // sentinel position first, then the target into its slot, then the step into the target's
  // slot. Positions are always >= 0, so -1 is guaranteed free.
  await sql`UPDATE email_sequence_steps SET position = -1 WHERE id = ${id}`;
  await sql`UPDATE email_sequence_steps SET position = ${currentPos} WHERE id = ${target.id as string}`;
  await sql`UPDATE email_sequence_steps SET position = ${targetPos} WHERE id = ${id}`;
  return { success: true };
});

const upsertCampaign = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    name: string;
    nicheId?: string | null;
    listId?: string | null;
    subject?: string | null;
    bodyHtml?: string | null;
  };
  const sql = getSql();
  if (input.id) {
    await sql`
      UPDATE email_campaigns
      SET name = ${input.name},
          niche_id = ${input.nicheId ?? null},
          list_id = ${input.listId ?? null},
          subject = ${input.subject ?? null},
          body_html = ${input.bodyHtml ?? null},
          updated_at = now()
      WHERE id = ${input.id}
    `;
  } else {
    await sql`
      INSERT INTO email_campaigns (name, niche_id, list_id, subject, body_html, status)
      VALUES (${input.name}, ${input.nicheId ?? null}, ${input.listId ?? null}, ${input.subject ?? null}, ${input.bodyHtml ?? null}, 'draft')
    `;
  }
  return { success: true };
});

const setCampaignStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  if (status === "sent") {
    await sql`
      UPDATE email_campaigns SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE email_campaigns SET status = ${status}, sent_at = NULL, updated_at = now() WHERE id = ${id}
    `;
  }
  return { success: true };
});

// ── Route ──

export const Route = createFileRoute("/email")({
  loader: () => fetchEmailData(),
  component: Email,
});

// ── Shared UI helpers ──

const inputCls =
  "w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none";

const contentCls =
  "w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none min-h-[120px]";

const btnPrimary =
  "rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

const btnGhost =
  "rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white";

const btnDanger =
  "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-300 hover:bg-red-500/20";

const btnGhostSm = "rounded-lg border border-gray-700 px-2 py-1 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  let color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  if (status === "subscribed" || status === "sent" || status === "active")
    color = "bg-green-900/60 text-green-400 border-green-500/30";
  else if (status === "unsubscribed" || status === "bounced" || status === "complained" || status === "cancelled" || status === "archived" || status === "paused")
    color = "bg-red-900/60 text-red-400 border-red-500/30";
  else if (status === "unconfirmed" || status === "draft") color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
      {status}
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white break-words">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Lists section ──

function ListSection({ lists, niches, onChanged }: { lists: List[]; niches: Niche[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setNicheId("");
    setDescription("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (l: List) => {
    setEditingId(l.id);
    setName(l.name);
    setNicheId(l.niche_id ?? "");
    setDescription(l.description ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertList({
        data: { id: editingId, name: name.trim(), nicheId: nicheId || null, description: description.trim() || null },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save list");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (l: List) => {
    await setListStatus({ data: { id: l.id, status: l.status === "active" ? "paused" : "active" } });
    await onChanged();
  };

  const remove = async (l: List) => {
    if (!confirm(`Delete list "${l.name}"? This removes ${l.subscriber_count} list membership(s) but not the subscribers themselves.`)) return;
    await deleteList({ data: l.id });
    await onChanged();
  };

  return (
    <Section title="📋 Email Lists" description="Mailing lists / groups, scoped to a niche when useful. Subscribers join lists via subscriber_lists membership.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="List name *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly newsletter" required />
          </Field>
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— none —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this list is for" />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? "Saving…" : editingId ? "Update List" : "Create List"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>Cancel edit</button>
          )}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {lists.length === 0 ? (
          <EmptyHint text="No lists yet — create your first list above." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3">Subscribers</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                  <td className="px-4 py-3 text-gray-400">{l.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{l.subscriber_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={l.status} />
                      <button onClick={() => toggle(l)} className="text-xs text-gray-500 hover:text-gray-300">
                        {l.status === "active" ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(l)} className={btnGhost}>Edit</button>
                      <button onClick={() => remove(l)} className={btnDanger}>Delete</button>
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

// ── Subscribers section ──

function SubscriberSection({
  subscribers,
  lists,
  niches,
  onChanged,
}: {
  subscribers: Subscriber[];
  lists: List[];
  niches: Niche[];
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [listId, setListId] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [source, setSource] = useState("manual");
  const [importText, setImportText] = useState("");
  const [filterList, setFilterList] = useState("");
  const [filterNiche, setFilterNiche] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setListId("");
    setNicheId("");
    setSource("manual");
    setError(null);
  };

  const addOne = async () => {
    if (!email.trim()) return;
    await upsertSubscriber({
      data: {
        email: email.trim(),
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        listId: listId || null,
        nicheId: nicheId || null,
        source: source || "manual",
      },
    });
    reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addOne();
      setNote("Subscriber added (status unconfirmed until verified).");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subscriber");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const emails = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    if (!confirm("Only import addresses people explicitly gave you. Scraped or purchased lists are prohibited. Proceed?")) return;
    setBusy(true);
    setError(null);
    try {
      for (const em of emails) {
        await upsertSubscriber({
          data: { email: em, listId: listId || null, nicheId: nicheId || null, source: "import" },
        });
      }
      setImportText("");
      setNote(`${emails.length} address(es) imported as unconfirmed.`);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async (s: Subscriber) => {
    if (s.status === "unsubscribed") return;
    if (!confirm(`Unsubscribe ${s.email}? This is a soft opt-out — they stay in the DB but are marked unsubscribed.`)) return;
    await unsubscribeSubscriber({ data: s.id });
    await onChanged();
  };

  const remove = async (s: Subscriber) => {
    if (!confirm(`Delete subscriber ${s.email}? This permanently removes them and their list memberships.`)) return;
    await sqlDeleteSubscriber({ data: s.id });
    await onChanged();
  };

  const visible = subscribers.filter(
    (s) =>
      (!filterList || s.lists.some((l) => l.id === filterList)) &&
      (!filterNiche || s.niche_id === filterNiche)
  );

  return (
    <Section title="👥 Subscribers" description="Plain opt-in subscribers. New addresses start as unconfirmed until verified — never pre-checked.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email *">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" required />
          </Field>
          <Field label="First name">
            <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
          </Field>
          <Field label="Last name">
            <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
          </Field>
          <Field label="List">
            <select className={inputCls} value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">— none —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— none —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="manual">Manual</option>
              <option value="form">Form</option>
              <option value="lead_magnet">Lead magnet</option>
              <option value="import">Import</option>
            </select>
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !email.trim()} className={btnPrimary}>
            {busy ? "Saving…" : "Add Subscriber"}
          </button>
          {note && <span className="text-xs text-green-400">{note}</span>}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl p-5 space-y-3">
        <Field label="Import addresses (newline-separated)">
          <textarea
            className={contentCls}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"one@example.com\ntwo@example.com"}
          />
        </Field>
        <p className="text-xs text-gray-500">
          Only import addresses people explicitly gave you. Imported addresses are recorded as <code>source=import</code> and start as <strong>unconfirmed</strong>.
        </p>
        <button type="button" onClick={doImport} disabled={busy || !importText.trim()} className={btnGhost}>
          Import
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter list</label>
          <select
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-100 focus:border-indigo-500/50 focus:outline-none"
            value={filterList}
            onChange={(e) => setFilterList(e.target.value)}
          >
            <option value="">All lists</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter niche</label>
          <select
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-100 focus:border-indigo-500/50 focus:outline-none"
            value={filterNiche}
            onChange={(e) => setFilterNiche(e.target.value)}
          >
            <option value="">All niches</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>{n.niche_name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-500">{visible.length} subscriber{visible.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyHint text="No subscribers match — add one above or change the filters." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Lists</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{s.email}</td>
                  <td className="px-4 py-3 text-gray-400">{[s.first_name, s.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {s.lists.length ? s.lists.map((l) => l.name).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{s.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{s.source ?? "manual"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => unsubscribe(s)}
                        disabled={s.status === "unsubscribed"}
                        className={btnGhostSm}
                        title={s.status === "unsubscribed" ? "Already unsubscribed" : "Soft opt-out (keeps the row)"}
                      >
                        Unsubscribe
                      </button>
                      <button onClick={() => remove(s)} className={btnDanger}>Delete</button>
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

// ── Sequences section ──

const SEND_TOOLTIP = "Sending requires a connected email provider — not available yet.";

function StepEditor({ sequence, onEdit, onChanged }: { sequence: Sequence; onEdit: (s: Sequence) => void; onChanged: () => void }) {
  const [subject, setSubject] = useState("");
  const [delayDays, setDelayDays] = useState("0");
  const [bodyHtml, setBodyHtml] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSubject("");
    setDelayDays("0");
    setBodyHtml("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (st: SequenceStep) => {
    setEditingId(st.id);
    setSubject(st.subject ?? "");
    setDelayDays(String(st.delay_days));
    setBodyHtml(st.body_html ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertSequenceStep({
        data: {
          id: editingId,
          sequenceId: sequence.id,
          delayDays: Number(delayDays),
          subject: subject.trim() || null,
          bodyHtml: bodyHtml || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save step");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (st: SequenceStep) => {
    if (!confirm(`Delete step "${st.subject || `#${st.position}`}"? This cannot be undone.`)) return;
    await deleteSequenceStep({ data: st.id });
    await onChanged();
  };

  const move = async (st: SequenceStep, direction: "up" | "down") => {
    await reorderSequenceStep({ data: { id: st.id, sequenceId: sequence.id, direction } });
    await onChanged();
  };

  const steps = [...sequence.steps].sort((a, b) => a.position - b.position);

  return (
    <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-white">{sequence.name}</h4>
            <button onClick={() => onEdit(sequence)} className={btnGhostSm} title="Edit sequence details">Edit sequence</button>
          </div>
          <p className="text-xs text-gray-400">
            <span className="capitalize">{sequence.trigger_type}</span> trigger · {sequence.step_count} step{sequence.step_count === 1 ? "" : "s"} · {sequence.total_delay}d total delay
            {sequence.niche_name ? ` · ${sequence.niche_name}` : ""}
          </p>
        </div>
        {sequence.description && <p className="text-xs text-gray-500 max-w-sm">{sequence.description}</p>}
      </div>

      {/* Step table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800/60">
        {steps.length === 0 ? (
          <EmptyHint text="No steps yet — add your first step below." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Delay</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Body</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((st, i) => (
                <tr key={st.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-3 py-2 text-gray-500">{st.position}</td>
                  <td className="px-3 py-2 text-gray-300">{st.delay_days}d</td>
                  <td className="px-3 py-2 font-medium text-white">{st.subject ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {st.body_html ? (st.body_html.length > 60 ? st.body_html.slice(0, 60) + "…" : st.body_html) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => move(st, "up")} disabled={i === 0} className={btnGhostSm} title="Move up">↑</button>
                      <button onClick={() => move(st, "down")} disabled={i === steps.length - 1} className={btnGhostSm} title="Move down">↓</button>
                      <button onClick={() => startEdit(st)} className={btnGhostSm}>Edit</button>
                      <button onClick={() => remove(st)} className={btnDanger}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Step form */}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <Field label="Delay (days)">
            <input type="number" min={0} className={inputCls} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
          </Field>
          <Field label="Subject">
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Step subject line" />
          </Field>
        </div>
        <Field label="Body (HTML)">
          <textarea className={contentCls} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder="<p>Step body content…</p>" />
        </Field>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : editingId ? "Update Step" : "Add Step"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>Cancel edit</button>
          )}
        </div>
      </form>
    </div>
  );
}

function SequenceSection({ sequences, niches, onChanged }: { sequences: Sequence[]; niches: Niche[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setNicheId("");
    setTriggerType("manual");
    setDescription("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (s: Sequence) => {
    setEditingId(s.id);
    setName(s.name);
    setNicheId(s.niche_id ?? "");
    setTriggerType(s.trigger_type);
    setDescription(s.description ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertSequence({
        data: { id: editingId, name: name.trim(), nicheId: nicheId || null, triggerType, description: description.trim() || null },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sequence");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="🔁 Sequences" description="Automated email sequences (welcome / lead-magnet / manual). Build ordered steps with per-step delays — nothing sends until a provider is connected.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Sequence name *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome sequence" required />
          </Field>
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— none —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Trigger type">
            <select className={inputCls} value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              <option value="welcome">Welcome</option>
              <option value="lead_magnet">Lead magnet</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Description">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this sequence does" />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? "Saving…" : editingId ? "Update Sequence" : "Create Sequence"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>Cancel edit</button>
          )}
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {sequences.length === 0 ? (
          <EmptyHint text="No sequences yet — create your first sequence above, then build its steps." />
        ) : (
          sequences.map((s) => <StepEditor key={s.id} sequence={s} onEdit={startEdit} onChanged={onChanged} />)
        )}
      </div>
    </Section>
  );
}

// ── Campaigns / Newsletter composer ──

function CampaignSection({ campaigns, lists, niches, onChanged }: { campaigns: Campaign[]; lists: List[]; niches: Niche[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [listId, setListId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setNicheId("");
    setListId("");
    setSubject("");
    setBodyHtml("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (c: Campaign) => {
    setEditingId(c.id);
    setName(c.name);
    setNicheId(c.niche_id ?? "");
    setListId(c.list_id ?? "");
    setSubject(c.subject ?? "");
    setBodyHtml(c.body_html ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertCampaign({
        data: {
          id: editingId,
          name: name.trim(),
          nicheId: nicheId || null,
          listId: listId || null,
          subject: subject.trim() || null,
          bodyHtml: bodyHtml || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setBusy(false);
    }
  };

  const markSent = async (c: Campaign) => {
    if (!confirm(`Mark "${c.name}" as SENT (manual placeholder — no email was actually delivered)?`)) return;
    await setCampaignStatus({ data: { id: c.id, status: "sent" } });
    await onChanged();
  };

  const revertDraft = async (c: Campaign) => {
    await setCampaignStatus({ data: { id: c.id, status: "draft" } });
    await onChanged();
  };

  return (
    <Section title="📨 Campaigns / Newsletter Composer" description="One-off newsletters. Compose a draft targeting a list now — real sending is a later provider-integration step.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Campaign name *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="October newsletter" required />
          </Field>
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— none —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Target list">
            <select className={inputCls} value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">— none —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          </Field>
        </div>
        <Field label="Body (HTML)">
          <textarea className={contentCls} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder="<h1>Hi there!</h1><p>Your newsletter content…</p>" />
        </Field>
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? "Saving…" : editingId ? "Update Campaign" : "Save Draft"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>Cancel edit</button>
          )}
          <button type="button" disabled className={btnPrimary} title={SEND_TOOLTIP}>Send</button>
          <span className="text-xs text-gray-500">Send is disabled — no email provider connected yet.</span>
        </div>
      </form>

      <div className="mt-6 glass-card rounded-xl overflow-x-auto">
        {campaigns.length === 0 ? (
          <EmptyHint text="No campaigns yet — compose your first newsletter above and save a draft." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">List</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-400">{c.list_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{c.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{c.subject ?? "—"}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button onClick={() => startEdit(c)} className={btnGhost}>Edit</button>
                      {c.status === "sent" ? (
                        <button onClick={() => revertDraft(c)} className={btnGhost} title="Move back to draft (manual placeholder)">
                          Revert to draft
                        </button>
                      ) : (
                        <button onClick={() => markSent(c)} className={btnGhost} title="MANUAL PLACEHOLDER — marks as sent without actually delivering email">
                          Mark sent (manual)
                        </button>
                      )}
                      <button disabled className={btnPrimary} title={SEND_TOOLTIP}>Send</button>
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

function Email() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<EmailData>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchEmailData());
    } finally {
      setRefreshing(false);
    }
  };

  const { kpis } = data;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">📧 Email Marketing</h1>
              <p className="mt-2 text-gray-400">
                Subscribers, lists, and newsletter management. Sending is queued via a pluggable provider seam.
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className={btnGhost}>
              {refreshing ? "Refreshing…" : "⟳ Refresh"}
            </button>
          </div>

          {/* KPI cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Subscribed Subscribers" value={String(kpis.subscribed)} sub="currently subscribed" />
            <KpiCard label="Active Lists" value={String(kpis.activeLists)} sub="email lists running" />
            <KpiCard label="Draft Campaigns" value={String(kpis.draftCampaigns)} sub="not yet sent" />
            <KpiCard label="Sent Campaigns" value={String(kpis.sentCampaigns)} sub="newsletters delivered" />
          </div>
        </div>
      </section>

      <ListSection lists={data.lists} niches={data.niches} onChanged={refresh} />
      <SubscriberSection subscribers={data.subscribers} lists={data.lists} niches={data.niches} onChanged={refresh} />
      <SequenceSection sequences={data.sequences} niches={data.niches} onChanged={refresh} />
      <CampaignSection campaigns={data.campaigns} lists={data.lists} niches={data.niches} onChanged={refresh} />
    </div>
  );
}
