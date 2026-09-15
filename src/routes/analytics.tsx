import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";

// ── Types ──
interface NicheStats {
  id: string;
  niche_name: string;
  slug: string;
  created_at: string;
  articles: number;
  social_posts: number;
  subscribers: number;
  campaigns: number;
  revenue: number;
}
interface GrowthPoint {
  month: string;
  count: number;
}
interface RevenuePoint {
  month: string;
  total: number;
}
interface StatusCount {
  status: string;
  count: number;
}
interface ListStat {
  id: string;
  name: string;
  status: string;
  niche_name: string | null;
  subscriber_count: number;
}
interface Kpis {
  articles: number;
  publishedArticles: number;
  socialPosts: number;
  publishedPosts: number;
  subscribers: number;
  subscribed: number;
  campaigns: number;
  sentCampaigns: number;
  affiliateLinks: number;
  activeLinks: number;
  adSlots: number;
  activeAdSlots: number;
  revenueEntries: number;
  revenueTotal: number;
}
interface AnalyticsData {
  kpis: Kpis;
  niches: NicheStats[];
  contentMonthly: GrowthPoint[];
  revenueMonthly: RevenuePoint[];
  emailSendsByStatus: StatusCount[];
  socialPostsByStatus: StatusCount[];
  emailLists: ListStat[];
}

// ── Server function (read-only, GET) ──
const fetchAnalyticsData = createServerFn().handler(async () => {
  const sql = getSql();
  const num = (v: unknown) => Number(v ?? 0);
  const [
    articles,
    publishedArticles,
    posts,
    publishedPosts,
    subscribers,
    subscribed,
    campaigns,
    sentCampaigns,
    links,
    activeLinks,
    adSlots,
    activeAdSlots,
    revenueCount,
    revenueTotal,
    niches,
    contentMonthly,
    revenueMonthly,
    emailSendsByStatus,
    socialPostsByStatus,
    emailLists,
  ] = await Promise.all([
    sql`SELECT count(*) AS c FROM articles`,
    sql`SELECT count(*) AS c FROM articles WHERE status = 'published'`,
    sql`SELECT count(*) AS c FROM social_posts`,
    sql`SELECT count(*) AS c FROM social_posts WHERE status = 'published'`,
    sql`SELECT count(*) AS c FROM subscribers`,
    sql`SELECT count(*) AS c FROM subscribers WHERE status = 'subscribed'`,
    sql`SELECT count(*) AS c FROM email_campaigns`,
    sql`SELECT count(*) AS c FROM email_campaigns WHERE status = 'sent'`,
    sql`SELECT count(*) AS c FROM affiliate_links`,
    sql`SELECT count(*) AS c FROM affiliate_links WHERE status = 'active'`,
    sql`SELECT count(*) AS c FROM ad_slots`,
    sql`SELECT count(*) AS c FROM ad_slots WHERE status = 'active'`,
    sql`SELECT count(*) AS c FROM revenue_entries`,
    sql`SELECT COALESCE(SUM(amount), 0) AS total FROM revenue_entries`,
    // Per-niche breakdown: aggregate each module independently (LEFT JOIN over
    // pre-aggregated CTEs) so revenue SUM can never be inflated by row fan-out.
    sql`
      WITH agg_articles AS (SELECT niche_id, count(*) AS c FROM articles GROUP BY niche_id),
           agg_posts    AS (SELECT niche_id, count(*) AS c FROM social_posts GROUP BY niche_id),
           agg_subs     AS (SELECT niche_id, count(*) AS c FROM subscribers GROUP BY niche_id),
           agg_camps    AS (SELECT niche_id, count(*) AS c FROM email_campaigns GROUP BY niche_id),
           agg_rev      AS (SELECT niche_id, COALESCE(SUM(amount), 0) AS t FROM revenue_entries GROUP BY niche_id)
      SELECT np.id, np.niche_name, np.slug, np.created_at,
        COALESCE(a.c, 0)  AS articles,
        COALESCE(sp.c, 0) AS social_posts,
        COALESCE(s.c, 0)  AS subscribers,
        COALESCE(ec.c, 0) AS campaigns,
        COALESCE(re.t, 0) AS revenue
      FROM niche_profiles np
      LEFT JOIN agg_articles a  ON a.niche_id  = np.id
      LEFT JOIN agg_posts sp    ON sp.niche_id = np.id
      LEFT JOIN agg_subs s      ON s.niche_id  = np.id
      LEFT JOIN agg_camps ec    ON ec.niche_id = np.id
      LEFT JOIN agg_rev re      ON re.niche_id = np.id
      ORDER BY np.created_at DESC
    `,
    // Content published per month — exactly the last 6 full months (articles + social posts).
    sql`
      SELECT to_char(m, 'YYYY-MM') AS month,
        (SELECT count(*) FROM articles a
          WHERE a.created_at >= m AND a.created_at < m + interval '1 month') +
        (SELECT count(*) FROM social_posts sp
          WHERE sp.created_at >= m AND sp.created_at < m + interval '1 month') AS c
      FROM generate_series(
        date_trunc('month', now()) - interval '5 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
      ORDER BY m ASC
    `,
    // Revenue by month — last 6 full months by entry_date (SUM(amount), USD default).
    sql`
      SELECT to_char(m, 'YYYY-MM') AS month,
        COALESCE((SELECT SUM(re.amount) FROM revenue_entries re
          WHERE re.entry_date >= m::date AND re.entry_date < (m + interval '1 month')::date), 0) AS total
      FROM generate_series(
        date_trunc('month', now()) - interval '5 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
      ORDER BY m ASC
    `,
    sql`SELECT status, count(*) AS c FROM email_sends GROUP BY status ORDER BY status ASC`,
    sql`SELECT status, count(*) AS c FROM social_posts GROUP BY status ORDER BY status ASC`,
    sql`
      SELECT el.id, el.name, el.status, np.niche_name,
        (SELECT count(*) FROM subscriber_lists sl WHERE sl.list_id = el.id) AS subscriber_count
      FROM email_lists el
      LEFT JOIN niche_profiles np ON el.niche_id = np.id
      ORDER BY el.created_at DESC
    `,
  ]);

  return {
    kpis: {
      articles: num((articles[0] as { c: number }).c),
      publishedArticles: num((publishedArticles[0] as { c: number }).c),
      socialPosts: num((posts[0] as { c: number }).c),
      publishedPosts: num((publishedPosts[0] as { c: number }).c),
      subscribers: num((subscribers[0] as { c: number }).c),
      subscribed: num((subscribed[0] as { c: number }).c),
      campaigns: num((campaigns[0] as { c: number }).c),
      sentCampaigns: num((sentCampaigns[0] as { c: number }).c),
      affiliateLinks: num((links[0] as { c: number }).c),
      activeLinks: num((activeLinks[0] as { c: number }).c),
      adSlots: num((adSlots[0] as { c: number }).c),
      activeAdSlots: num((activeAdSlots[0] as { c: number }).c),
      revenueEntries: num((revenueCount[0] as { c: number }).c),
      revenueTotal: num((revenueTotal[0] as { total: number }).total),
    },
    niches: (niches as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      niche_name: r.niche_name as string,
      slug: r.slug as string,
      created_at: String(r.created_at),
      articles: num(r.articles),
      social_posts: num(r.social_posts),
      subscribers: num(r.subscribers),
      campaigns: num(r.campaigns),
      revenue: num(r.revenue),
    })),
    contentMonthly: (contentMonthly as Record<string, unknown>[]).map((r) => ({
      month: r.month as string,
      count: num(r.c),
    })),
    revenueMonthly: (revenueMonthly as Record<string, unknown>[]).map((r) => ({
      month: r.month as string,
      total: num(r.total),
    })),
    emailSendsByStatus: (emailSendsByStatus as Record<string, unknown>[]).map((r) => ({
      status: r.status as string,
      count: num(r.c),
    })),
    socialPostsByStatus: (socialPostsByStatus as Record<string, unknown>[]).map((r) => ({
      status: r.status as string,
      count: num(r.c),
    })),
    emailLists: (emailLists as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      status: (r.status as string) ?? "active",
      niche_name: (r.niche_name as string) ?? null,
      subscriber_count: num(r.subscriber_count),
    })),
  };
});

// ── Route ──
export const Route = createFileRoute("/analytics")({
  loader: () => fetchAnalyticsData(),
  component: Analytics,
});

// ── Helpers ──
const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  // `value` may legitimately be "0" / "$0.00" — an honest zero, not fake data.
  const hasData = value !== "0" && value !== "$0.00" && value.trim() !== "";
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold break-words ${hasData ? "text-white" : "text-gray-500"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
// ── Trend bars (lightweight CSS, mirrors monetization/email growth bars) ──
function TrendBars({ data, formatRight }: { data: { month: string; value: number; label: string }[]; formatRight: (v: number) => string }) {
  const max = Math.max(...data.map((d) => Math.max(data.some((d) => d.value > 0) ? d.value : 0, 0), 1), 1);
  if (data.every((d) => d.value === 0)) {
    return <EmptyHint text="No data in the last 6 months yet." />;
  }
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.month} className="flex items-center gap-3">
          <span className="w-16 flex-shrink-0 text-xs text-gray-400">{d.month}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-800/60">
            <div
              className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-cyan-500"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-300">{formatRight(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
function StatusRow({ status, count, max, color }: { status: string; count: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex w-24 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
        {status}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-md bg-gray-800/60">
        <div
          className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-cyan-500"
          style={{ width: `${max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0}%` }}
        />
      </div>
      <span className="w-10 flex-shrink-0 text-right text-xs font-medium text-gray-300">{count}</span>
    </div>
  );
}
const SEND_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/60 text-yellow-400 border-yellow-500/30",
  queued: "bg-cyan-900/60 text-cyan-400 border-cyan-500/30",
  sent: "bg-green-900/60 text-green-400 border-green-500/30",
  failed: "bg-red-900/60 text-red-400 border-red-500/30",
  bounced: "bg-purple-900/60 text-purple-400 border-purple-500/30",
};
const POST_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-800/60 text-gray-400 border-gray-600",
  scheduled: "bg-cyan-900/60 text-cyan-400 border-cyan-500/30",
  published: "bg-green-900/60 text-green-400 border-green-500/30",
};
const LIST_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900/60 text-green-400 border-green-500/30",
  paused: "bg-yellow-900/60 text-yellow-400 border-yellow-500/30",
  archived: "bg-gray-800/60 text-gray-400 border-gray-600",
};

// ── Page ──
function Analytics() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<AnalyticsData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchAnalyticsData());
    } finally {
      setRefreshing(false);
    }
  };
  const { kpis } = data;

  // Totals row = sum of the per-niche DB numbers (real aggregates).
  const totals = data.niches.reduce(
    (acc, n) => ({
      articles: acc.articles + n.articles,
      social_posts: acc.social_posts + n.social_posts,
      subscribers: acc.subscribers + n.subscribers,
      campaigns: acc.campaigns + n.campaigns,
      revenue: acc.revenue + n.revenue,
    }),
    { articles: 0, social_posts: 0, subscribers: 0, campaigns: 0, revenue: 0 }
  );

  const maxSend = Math.max(...data.emailSendsByStatus.map((s) => s.count), 1);
  const maxPost = Math.max(...data.socialPostsByStatus.map((s) => s.count), 1);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">📊 Analytics Dashboard</h1>
              <p className="mt-2 text-gray-400">
                Real KPIs straight from the database — content, social, email, monetization — per niche, no placeholders.
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all duration-300 hover:border-gray-500 hover:text-white disabled:opacity-50">
              {refreshing ? "Refreshing…" : "⟳ Refresh"}
            </button>
          </div>
          {/* KPI cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Articles" value={String(kpis.articles)} sub={`${kpis.publishedArticles} published`} />
            <KpiCard label="Social Posts" value={String(kpis.socialPosts)} sub={`${kpis.publishedPosts} published`} />
            <KpiCard label="Subscribers" value={String(kpis.subscribers)} sub={`${kpis.subscribed} subscribed`} />
            <KpiCard label="Campaigns" value={String(kpis.campaigns)} sub={`${kpis.sentCampaigns} sent`} />
            <KpiCard label="Affiliate Links" value={String(kpis.affiliateLinks)} sub={`${kpis.activeLinks} active`} />
            <KpiCard label="Ad Slots" value={String(kpis.adSlots)} sub={`${kpis.activeAdSlots} active`} />
            <KpiCard label="Revenue Entries" value={String(kpis.revenueEntries)} sub={`$${fmtMoney(kpis.revenueTotal)} all-time`} />
            <KpiCard label="Total Revenue" value={`$${fmtMoney(kpis.revenueTotal)}`} sub={`${kpis.revenueEntries} logged entries`} />
          </div>
          {/* Trend bars */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white">Content published</h3>
              <p className="mt-0.5 text-xs text-gray-400">Last 6 months — articles + social posts (by created_at)</p>
              <div className="mt-4">
                <TrendBars
                  data={data.contentMonthly.map((m) => ({ month: m.month, value: m.count, label: m.month }))}
                  formatRight={(v) => String(v)}
                />
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white">Revenue by month</h3>
              <p className="mt-0.5 text-xs text-gray-400">Last 6 months — revenue_entries (SUM(amount), USD default)</p>
              <div className="mt-4">
                <TrendBars
                  data={data.revenueMonthly.map((m) => ({ month: m.month, value: m.total, label: m.month }))}
                  formatRight={(v) => `$${fmtMoney(v)}`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Per-niche breakdown */}
      <Section title="Per-Niche Breakdown" description="Articles, social posts, subscribers, campaigns and revenue for every niche. Totals row summed from the same queries.">
        {data.niches.length === 0 ? (
          <EmptyHint text="No niches created yet — create one and the breakdown will populate." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Niche</th>
                  <th className="px-4 py-3 text-right">Articles</th>
                  <th className="px-4 py-3 text-right">Social Posts</th>
                  <th className="px-4 py-3 text-right">Subscribers</th>
                  <th className="px-4 py-3 text-right">Campaigns</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.niches.map((n) => (
                  <tr key={n.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-900/40">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{n.niche_name}</span>
                      <span className="ml-2 text-xs text-gray-500">/niche/{n.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{n.articles}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{n.social_posts}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{n.subscribers}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{n.campaigns}</td>
                    <td className="px-4 py-3 text-right text-gray-300">${fmtMoney(n.revenue)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-900/60 font-semibold">
                  <td className="px-4 py-3 text-white">Totals</td>
                  <td className="px-4 py-3 text-right text-white">{totals.articles}</td>
                  <td className="px-4 py-3 text-right text-white">{totals.social_posts}</td>
                  <td className="px-4 py-3 text-right text-white">{totals.subscribers}</td>
                  <td className="px-4 py-3 text-right text-white">{totals.campaigns}</td>
                  <td className="px-4 py-3 text-right text-white">${fmtMoney(totals.revenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Engagement / health mini-section */}
      <Section title="Engagement & Health" description="Live pipeline state — every figure is a COUNT() over the relevant table.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Email sends</h3>
            <p className="mt-0.5 text-xs text-gray-400">email_sends by status</p>
            <div className="mt-4 space-y-2">
              {data.emailSendsByStatus.length === 0 ? (
                <EmptyHint text="No email sends yet." />
              ) : (
                data.emailSendsByStatus.map((s) => (
                  <StatusRow
                    key={s.status}
                    status={s.status}
                    count={s.count}
                    max={maxSend}
                    color={SEND_STATUS_COLORS[s.status] ?? "bg-gray-800/60 text-gray-400 border-gray-600"}
                  />
                ))
              )}
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Social posts</h3>
            <p className="mt-0.5 text-xs text-gray-400">social_posts by status</p>
            <div className="mt-4 space-y-2">
              {data.socialPostsByStatus.length === 0 ? (
                <EmptyHint text="No social posts yet." />
              ) : (
                data.socialPostsByStatus.map((s) => (
                  <StatusRow
                    key={s.status}
                    status={s.status}
                    count={s.count}
                    max={maxPost}
                    color={POST_STATUS_COLORS[s.status] ?? "bg-gray-800/60 text-gray-400 border-gray-600"}
                  />
                ))
              )}
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Email lists</h3>
            <p className="mt-0.5 text-xs text-gray-400">lists with subscriber counts</p>
            <div className="mt-4 space-y-2">
              {data.emailLists.length === 0 ? (
                <EmptyHint text="No email lists yet." />
              ) : (
                data.emailLists.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-200">{l.name}</p>
                      <p className="text-xs text-gray-500">
                        {l.niche_name ?? "No niche"} ·{" "}
                        <span className={`inline-flex rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wide ${LIST_STATUS_COLORS[l.status] ?? "bg-gray-800/60 text-gray-400 border-gray-600"}`}>
                          {l.status}
                        </span>
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-white">{l.subscriber_count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
