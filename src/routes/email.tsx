import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { getEmailSender } from "~/services/email";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  opens: number;
  clicks: number;
  created_at: string;
}

interface GrowthPoint {
  month: string;
  count: number;
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
  growth: GrowthPoint[];
}

// ── Server functions ──

const fetchEmailData = createServerFn().handler(async () => {
  const sql = getSql();

  const [lists, subscribers, memberships, niches, subscribed, activeLists, draftCampaigns, sentCampaigns, sequences, steps, campaigns, growth] =
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
      // Subscribers by month — last 6 months (including the current, partial one),
      // counting rows by subscribers.created_at bucket.
      sql`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS c
        FROM subscribers
        WHERE created_at >= date_trunc('month', now()) - interval '5 months'
        GROUP BY month
        ORDER BY month ASC
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
      opens: num(r.opens),
      clicks: num(r.clicks),
      created_at: String(r.created_at),
    })),
    kpis: {
      subscribed: num(subscribed[0]?.c),
      activeLists: num(activeLists[0]?.c),
      draftCampaigns: num(draftCampaigns[0]?.c),
      sentCampaigns: num(sentCampaigns[0]?.c),
    },
    growth: (growth as Record<string, unknown>[]).map((r) => ({
      month: r.month as string,
      count: num(r.c),
    })),
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
    return { success: true, id: input.id };
  } else {
    const rows = await sql`
      INSERT INTO email_campaigns (name, niche_id, list_id, subject, body_html, status)
      VALUES (${input.name}, ${input.nicheId ?? null}, ${input.listId ?? null}, ${input.subject ?? null}, ${input.bodyHtml ?? null}, 'draft')
      RETURNING id
    `;
    return { success: true, id: (rows as Record<string, unknown>[])[0]?.id as string };
  }
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

// Chunk 3: campaign send through the EmailSender seam. The feature layer only talks
// to getEmailSender().send() — never to a concrete provider class. The default
// NoopSender records every outgoing email as an email_sends row (status 'pending')
// in the outbox; a real provider (SMTP/Resend/...) later swaps in behind the same
// interface. Pending rows are queued for a future sender worker — nothing is
// delivered to a network in the meantime, and actual delivery MUST re-check
// subscribers.status (never deliver to unconfirmed/unsubscribed/bounced).
const sendCampaign = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id } = ctx.data as { id: string };
  const sql = getSql();

  const cards = (await sql`
    SELECT id, name, subject, body_html, body_text, list_id, status
    FROM email_campaigns
    WHERE id = ${id}
  `) as Record<string, unknown>[];
  const campaign = cards[0];
  if (!campaign) return { success: false, error: "Campaign not found." };
  if (!campaign.list_id)
    return { success: false, error: "Campaign has no target list — pick a list before sending." };
  if (campaign.status === "sent")
    return { success: false, error: "Campaign is already sent." };

  // Targeted subscribers = current members of the campaign's target list (membership
  // status 'subscribed'), excluding hard-opted-out/bounced/complained rows. Unconfirmed
  // addresses are queued as pending placeholders only — real delivery stays gated on
  // confirmation (see note above).
  const recipients = (await sql`
    SELECT s.id, s.email, s.first_name, s.last_name
    FROM subscriber_lists sl
    JOIN subscribers s ON s.id = sl.subscriber_id
    WHERE sl.list_id = ${campaign.list_id as string}
      AND sl.status = 'subscribed'
      AND s.status IN ('subscribed', 'unconfirmed')
    ORDER BY s.created_at ASC
  `) as Record<string, unknown>[];

  if (recipients.length === 0)
    return { success: false, error: "Target list has no subscribers — add subscribers to the list first." };

  const subject = (campaign.subject as string) ?? "";
  const html = (campaign.body_html as string) ?? "";
  const text = (campaign.body_text as string) ?? undefined;

  const sender = getEmailSender();
  let pending = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sender.send({
      to: r.email as string,
      toName: [r.first_name, r.last_name].filter(Boolean).join(" ") || undefined,
      subject,
      html,
      text,
      metadata: {
        subscriberId: r.id as string,
        campaignId: id,
        listId: campaign.list_id as string,
      },
    });
    if (result.ok) pending += 1;
    else failed += 1;
    await sql`
      INSERT INTO email_sends (subscriber_id, campaign_id, type, status, provider_message_id, subject)
      VALUES (${r.id as string}, ${id}, 'campaign', ${result.ok ? "pending" : "failed"},
              ${result.providerMessageId ?? null}, ${subject})
    `;
  }

  if (pending > 0) {
    await sql`
      UPDATE email_campaigns SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = ${id}
    `;
  }
  return { success: true, pending, failed, provider: sender.name };
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
  const { t } = useTranslation();
  let color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  if (status === "subscribed" || status === "sent" || status === "active")
    color = "bg-green-900/60 text-green-400 border-green-500/30";
  else if (status === "unsubscribed" || status === "bounced" || status === "complained" || status === "cancelled" || status === "archived" || status === "paused")
    color = "bg-red-900/60 text-red-400 border-red-500/30";
  else if (status === "unconfirmed" || status === "draft") color = "bg-yellow-900/60 text-yellow-400 border-yellow-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
      {t(`status.${status}`, { defaultValue: status })}
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

// ── Subscribers-by-month bar chart (lightweight CSS, mirrors monetization's MonthlyBars) ──

function GrowthBars({ growth }: { growth: GrowthPoint[] }) {
  const { t } = useTranslation();
  if (growth.length === 0) return <EmptyHint text={t("email.noGrowth")} />;
  const max = Math.max(...growth.map((g) => g.count), 1);
  return (
    <div className="space-y-2">
      {growth.map((g) => (
        <div key={g.month} className="flex items-center gap-3">
          <span className="w-16 flex-shrink-0 text-xs text-gray-400">{g.month}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-800/60">
            <div
              className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-cyan-500"
              style={{ width: `${Math.max((g.count / max) * 100, g.count > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-12 flex-shrink-0 text-right text-xs font-medium text-gray-300">{g.count}</span>
        </div>
      ))}
    </div>
  );
}

interface SendCampaignResult {
  success: boolean;
  pending?: number;
  failed?: number;
  provider?: string;
  error?: string;
}

// ── Lists section ──

function ListSection({ lists, niches, onChanged }: { lists: List[]; niches: Niche[]; onChanged: () => void }) {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("email.lists.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (l: List) => {
    await setListStatus({ data: { id: l.id, status: l.status === "active" ? "paused" : "active" } });
    await onChanged();
  };

  const remove = async (l: List) => {
    if (!confirm(t("email.lists.confirmDelete", { name: l.name, n: l.subscriber_count }))) return;
    await deleteList({ data: l.id });
    await onChanged();
  };

  return (
    <Section title={t("email.lists.title")} description={t("email.lists.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("email.lists.listName")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("email.lists.listNamePlaceholder")} required />
          </Field>
          <Field label={t("common.niche")}>
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("common.description")}>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("email.lists.listDescPlaceholder")} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("email.lists.update") : t("email.lists.create")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {lists.length === 0 ? (
          <EmptyHint text={t("email.lists.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("common.col.name")}</th>
                <th className="px-4 py-3">{t("common.niche")}</th>
                <th className="px-4 py-3">{t("analytics.cols.subscribers")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
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
  const { t } = useTranslation();
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
      setNote(t("email.subscribers.addedNote"));
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.subscribers.errorAdd"));
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
    if (!confirm(t("email.subscribers.confirmImport"))) return;
    setBusy(true);
    setError(null);
    try {
      for (const em of emails) {
        await upsertSubscriber({
          data: { email: em, listId: listId || null, nicheId: nicheId || null, source: "import" },
        });
      }
      setImportText("");
      setNote(t("email.subscribers.importedNote", { n: emails.length }));
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.subscribers.errorImport"));
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async (s: Subscriber) => {
    if (s.status === "unsubscribed") return;
    if (!confirm(t("email.subscribers.confirmUnsubscribe", { email: s.email }))) return;
    await unsubscribeSubscriber({ data: s.id });
    await onChanged();
  };

  const remove = async (s: Subscriber) => {
    if (!confirm(t("email.subscribers.confirmDelete", { email: s.email }))) return;
    await sqlDeleteSubscriber({ data: s.id });
    await onChanged();
  };

  const visible = subscribers.filter(
    (s) =>
      (!filterList || s.lists.some((l) => l.id === filterList)) &&
      (!filterNiche || s.niche_id === filterNiche)
  );

  return (
    <Section title={t("email.subscribers.title")} description={t("email.subscribers.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("email.subscribers.email")}>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" required />
          </Field>
          <Field label={t("email.subscribers.firstName")}>
            <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("email.subscribers.firstNamePlaceholder")} />
          </Field>
          <Field label={t("email.subscribers.lastName")}>
            <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("email.subscribers.lastNamePlaceholder")} />
          </Field>
          <Field label={t("email.subscribers.list")}>
            <select className={inputCls} value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
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
          <Field label={t("email.subscribers.source")}>
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="manual">{t("email.source.manual")}</option>
              <option value="form">{t("email.source.form")}</option>
              <option value="lead_magnet">{t("email.source.leadMagnet")}</option>
              <option value="import">{t("email.source.import")}</option>
            </select>
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !email.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : t("email.subscribers.addSubscriber")}
          </button>
          {note && <span className="text-xs text-green-400">{note}</span>}
        </div>
      </form>

      <div className="mt-4 glass-card rounded-xl p-5 space-y-3">
        <Field label={t("email.subscribers.importLabel")}>
          <textarea
            className={contentCls}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"one@example.com\ntwo@example.com"}
          />
        </Field>
        <p className="text-xs text-gray-500">
          {t("email.subscribers.importHintP1")} <code>source=import</code> {t("email.subscribers.importHintP2")} <strong>{t("email.subscribers.importHintP3")}</strong>.
        </p>
        <button type="button" onClick={doImport} disabled={busy || !importText.trim()} className={btnGhost}>
          {t("email.subscribers.import")}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("email.subscribers.filterList")}</label>
          <select
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-100 focus:border-indigo-500/50 focus:outline-none"
            value={filterList}
            onChange={(e) => setFilterList(e.target.value)}
          >
            <option value="">{t("common.allLists")}</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("email.subscribers.filterNiche")}</label>
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
        </div>
        <span className="text-xs text-gray-500">{visible.length === 1 ? t("email.subscribers.countOne", { n: visible.length }) : t("email.subscribers.countMany", { n: visible.length })}</span>
      </div>

      <div className="mt-4 glass-card rounded-xl overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyHint text={t("email.subscribers.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("email.subscribers.email")}</th>
                <th className="px-4 py-3">{t("common.col.name")}</th>
                <th className="px-4 py-3">{t("email.subscribers.colLists")}</th>
                <th className="px-4 py-3">{t("common.niche")}</th>
                <th className="px-4 py-3">{t("email.subscribers.source")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
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
                  <td className="px-4 py-3 text-gray-400">{t(`email.source.${s.source ?? "manual"}`, { defaultValue: s.source ?? "manual" })}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => unsubscribe(s)}
                        disabled={s.status === "unsubscribed"}
                        className={btnGhostSm}
                        title={s.status === "unsubscribed" ? t("email.subscribers.alreadyUnsubscribed") : t("email.subscribers.unsubscribeTitle")}
                      >
                        {t("email.subscribers.unsubscribe")}
                      </button>
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

// ── Sequences section ──


function StepEditor({ sequence, onEdit, onChanged }: { sequence: Sequence; onEdit: (s: Sequence) => void; onChanged: () => void }) {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("email.sequences.errorSaveStep"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (st: SequenceStep) => {
    if (!confirm(t("email.sequences.confirmDeleteStep", { name: st.subject || `#${st.position}` }))) return;
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
            <button onClick={() => onEdit(sequence)} className={btnGhostSm} title={t("email.sequences.editSequenceTitle")}>{t("email.sequences.editSequence")}</button>
          </div>
          <p className="text-xs text-gray-400">
            <span>{t(`email.trigger.${sequence.trigger_type}`, { defaultValue: sequence.trigger_type })}</span> {t("email.sequences.triggerSuffix")} · {sequence.step_count} {sequence.step_count === 1 ? t("email.sequences.stepsOne") : t("email.sequences.stepsMany")} · {t("email.sequences.totalDelay", { n: sequence.total_delay })}
            {sequence.niche_name ? ` · ${sequence.niche_name}` : ""}
          </p>
        </div>
        {sequence.description && <p className="text-xs text-gray-500 max-w-sm">{sequence.description}</p>}
      </div>

      {/* Step table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800/60">
        {steps.length === 0 ? (
          <EmptyHint text={t("email.sequences.noSteps")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t("email.sequences.colDelay")}</th>
                <th className="px-3 py-2">{t("email.sequences.subject")}</th>
                <th className="px-3 py-2">{t("email.sequences.colBody")}</th>
                <th className="px-3 py-2 text-right">{t("common.col.actions")}</th>
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

      {/* Step form */}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <Field label={t("email.sequences.delayDays")}>
            <input type="number" min={0} className={inputCls} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
          </Field>
          <Field label={t("email.sequences.subject")}>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("email.sequences.subjectPlaceholder")} />
          </Field>
        </div>
        <Field label={t("email.sequences.bodyHtml")}>
          <textarea className={contentCls} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder={t("email.sequences.bodyHtmlPlaceholder")} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("email.sequences.updateStep") : t("email.sequences.addStep")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>
    </div>
  );
}

function SequenceSection({ sequences, niches, onChanged }: { sequences: Sequence[]; niches: Niche[]; onChanged: () => void }) {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("email.sequences.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t("email.sequences.title")} description={t("email.sequences.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("email.sequences.name")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("email.sequences.namePlaceholder")} required />
          </Field>
          <Field label={t("common.niche")}>
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("email.sequences.triggerType")}>
            <select className={inputCls} value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              <option value="welcome">{t("email.trigger.welcome")}</option>
              <option value="lead_magnet">{t("email.source.leadMagnet")}</option>
              <option value="manual">{t("email.source.manual")}</option>
            </select>
          </Field>
          <Field label={t("common.description")}>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("email.sequences.descPlaceholder")} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("email.sequences.update") : t("email.sequences.create")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {sequences.length === 0 ? (
          <EmptyHint text={t("email.sequences.empty")} />
        ) : (
          sequences.map((s) => <StepEditor key={s.id} sequence={s} onEdit={startEdit} onChanged={onChanged} />)
        )}
      </div>
    </Section>
  );
}

// ── Campaigns / Newsletter composer ──

function CampaignSection({ campaigns, lists, niches, onChanged }: { campaigns: Campaign[]; lists: List[]; niches: Niche[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [listId, setListId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setNicheId("");
    setListId("");
    setSubject("");
    setBodyHtml("");
    setEditingId(null);
    setError(null);
    setSendNote(null);
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
      setError(err instanceof Error ? err.message : t("email.campaigns.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  const doSend = async (c: Campaign) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSendNote(null);
    try {
      const res = (await sendCampaign({ data: { id: c.id } })) as SendCampaignResult;
      if (!res.success) {
        setError(res.error ?? t("email.campaigns.sendFailed"));
      } else {
        const label = res.provider === "noop" ? "NoopSender" : res.provider ?? "sender";
        setSendNote(
          t("email.campaigns.sendNote", { label, pending: res.pending ?? 0 }) +
            ((res.failed ?? 0) > 0 ? ` ${t("email.campaigns.sendFailedCount", { n: res.failed })}` : "")
        );
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.campaigns.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Form-level Send: save the draft first (upsert returns the campaign id), then
  // queue the send through the seam — same path as the row-level Send button.
  const doSendFromForm = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSendNote(null);
    try {
      const saved = await upsertCampaign({
        data: {
          id: editingId,
          name: name.trim(),
          nicheId: nicheId || null,
          listId: listId || null,
          subject: subject.trim() || null,
          bodyHtml: bodyHtml || null,
        },
      });
      const cid = (saved as { id?: string }).id ?? editingId;
      if (!cid) throw new Error(t("email.campaigns.errorNoId"));
      const res = (await sendCampaign({ data: { id: cid } })) as SendCampaignResult;
      if (!res.success) {
        setError(res.error ?? t("email.campaigns.sendFailed"));
      } else {
        const label = res.provider === "noop" ? "NoopSender" : res.provider ?? "sender";
        setSendNote(
          t("email.campaigns.sendNote", { label, pending: res.pending ?? 0 }) +
            ((res.failed ?? 0) > 0 ? ` ${t("email.campaigns.sendFailedCount", { n: res.failed })}` : "")
        );
      }
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.campaigns.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const markSent = async (c: Campaign) => {
    if (!confirm(t("email.campaigns.confirmMarkSent", { name: c.name }))) return;
    await setCampaignStatus({ data: { id: c.id, status: "sent" } });
    await onChanged();
  };

  const revertDraft = async (c: Campaign) => {
    await setCampaignStatus({ data: { id: c.id, status: "draft" } });
    await onChanged();
  };

  return (
    <Section title={t("email.campaigns.title")} description={t("email.campaigns.desc")}>
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("email.campaigns.name")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("email.campaigns.namePlaceholder")} required />
          </Field>
          <Field label={t("common.niche")}>
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.niche_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("email.campaigns.targetList")}>
            <select className={inputCls} value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("email.sequences.subject")}>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("email.campaigns.subjectPlaceholder")} />
          </Field>
        </div>
        <Field label={t("email.sequences.bodyHtml")}>
          <textarea className={contentCls} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder={t("email.campaigns.bodyHtmlPlaceholder")} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("common.saving") : editingId ? t("email.campaigns.update") : t("email.campaigns.saveDraft")}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>{t("common.cancelEdit")}</button>
          )}
          <button
            type="button"
            onClick={doSendFromForm}
            disabled={busy || !name.trim()}
            className={btnPrimary}
            title={t("email.campaigns.sendTooltip")}
          >
            {busy ? t("email.campaigns.sending") : t("email.campaigns.send")}
          </button>
          <span className="text-xs text-gray-500">
            {t("email.campaigns.sendHint")}
          </span>
        </div>
        {sendNote && <p className="text-xs text-green-400">{sendNote}</p>}
      </form>

      <div className="mt-6 glass-card rounded-xl overflow-x-auto">
        {campaigns.length === 0 ? (
          <EmptyHint text={t("email.campaigns.empty")} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t("common.col.name")}</th>
                <th className="px-4 py-3">{t("email.subscribers.list")}</th>
                <th className="px-4 py-3">{t("common.niche")}</th>
                <th className="px-4 py-3">{t("email.sequences.subject")}</th>
                <th className="px-4 py-3">{t("email.campaigns.colOpens")}</th>
                <th className="px-4 py-3">{t("email.campaigns.colClicks")}</th>
                <th className="px-4 py-3">{t("common.col.status")}</th>
                <th className="px-4 py-3 text-right">{t("common.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-400">{c.list_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{c.niche_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{c.subject ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400" title={t("email.campaigns.opensTitle")}>{c.opens}</td>
                  <td className="px-4 py-3 text-gray-400" title={t("email.campaigns.clicksTitle")}>{c.clicks}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button onClick={() => startEdit(c)} className={btnGhost}>{t("common.edit")}</button>
                      {c.status === "sent" ? (
                        <button onClick={() => revertDraft(c)} className={btnGhost} title={t("email.campaigns.revertTitle")}>
                          {t("email.campaigns.revertToDraft")}
                        </button>
                      ) : (
                        <button onClick={() => markSent(c)} className={btnGhost} title={t("email.campaigns.markSentTitle")}>
                          {t("email.campaigns.markSent")}
                        </button>
                      )}
                      <button
                        onClick={() => doSend(c)}
                        disabled={busy || c.status === "sent"}
                        className={btnPrimary}
                        title={c.status === "sent" ? t("email.campaigns.alreadySent") : t("email.campaigns.sendTooltip")}
                      >
                        {t("email.campaigns.send")}
                      </button>
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
  const { t } = useTranslation();
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

  const { kpis, growth } = data;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("email.title")}</h1>
              <p className="mt-2 text-gray-400">
                {t("email.subtitle")}
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className={btnGhost}>
              {refreshing ? t("analytics.refreshing") : t("analytics.refresh")}
            </button>
          </div>

          {/* KPI cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t("email.kpi.subscribed")} value={String(kpis.subscribed)} sub={t("email.kpi.currentlySubscribed")} />
            <KpiCard label={t("email.kpi.activeLists")} value={String(kpis.activeLists)} sub={t("email.kpi.listsRunning")} />
            <KpiCard label={t("email.kpi.draftCampaigns")} value={String(kpis.draftCampaigns)} sub={t("email.kpi.notYetSent")} />
            <KpiCard label={t("email.kpi.sentCampaigns")} value={String(kpis.sentCampaigns)} sub={t("email.kpi.delivered")} />
          </div>

          {/* List growth — subscribers by month (last 6 months) */}
          <div className="mt-6 glass-card rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">{t("email.growth.title")}</h3>
                <p className="mt-0.5 text-xs text-gray-400">{t("email.growth.desc")}</p>
              </div>
              <span className="text-xs text-gray-500">{t("email.growth.newInPeriod", { n: growth.reduce((a, g) => a + g.count, 0) })}</span>
            </div>
            <div className="mt-4">
              <GrowthBars growth={growth} />
            </div>
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
