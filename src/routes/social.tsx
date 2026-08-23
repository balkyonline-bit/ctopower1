import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";

// ── Types ──

interface SocialPost {
  id: string;
  niche_id: string | null;
  account_id: string | null;
  platform: string;
  platforms: string[];
  title: string;
  content: string | null;
  image_url: string | null;
  link: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
  created_at: string;
  account_handle?: string | null;
  niche_name?: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  niche_id: string | null;
  status: string;
  created_at: string;
  niche_name?: string | null;
}

interface MediaAsset {
  id: string;
  title: string | null;
  url: string | null;
}

interface Niche {
  id: string;
  niche_name: string;
  slug: string;
}

interface SocialData {
  posts: SocialPost[];
  accounts: SocialAccount[];
  media: MediaAsset[];
  niches: Niche[];
}

const PLATFORMS = [
  { id: "twitter", label: "Twitter / X", emoji: "🐦" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼" },
  { id: "facebook", label: "Facebook", emoji: "📘" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
] as const;

const STATUS_ORDER = ["draft", "scheduled", "published", "cancelled", "failed"] as const;

function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

// ── Server functions ──

const fetchSocialData = createServerFn().handler(async () => {
  const sql = getSql();

  const [posts, accounts, media, niches] = await Promise.all([
    sql`
      SELECT sp.*, sa.handle AS account_handle, np.niche_name
      FROM social_posts sp
      LEFT JOIN social_accounts sa ON sp.account_id = sa.id
      LEFT JOIN niche_profiles np ON sp.niche_id = np.id
      ORDER BY COALESCE(sp.scheduled_at, sp.created_at) DESC
    `,
    sql`
      SELECT sa.*, np.niche_name
      FROM social_accounts sa
      LEFT JOIN niche_profiles np ON sa.niche_id = np.id
      ORDER BY sa.created_at DESC
    `,
    sql`SELECT id, title, url FROM media_assets WHERE type = 'image' ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT id, niche_name, slug FROM niche_profiles ORDER BY niche_name ASC`,
  ]);

  const arr = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({ ...r, platforms: Array.isArray(r.platforms) ? r.platforms : [] }));

  return {
    posts: (arr(posts) as unknown as SocialPost[]).map((r) => ({
      id: r.id,
      niche_id: r.niche_id ?? null,
      account_id: r.account_id ?? null,
      platform: r.platform,
      platforms: r.platforms?.length ? r.platforms : [r.platform],
      title: r.title,
      content: r.content ?? null,
      image_url: r.image_url ?? null,
      link: r.link ?? null,
      scheduled_at: r.scheduled_at ? String(r.scheduled_at) : null,
      published_at: r.published_at ? String(r.published_at) : null,
      status: r.status ?? "draft",
      created_at: String(r.created_at),
      account_handle: (r as Record<string, unknown>).account_handle ? String((r as Record<string, unknown>).account_handle) : null,
      niche_name: (r as Record<string, unknown>).niche_name ? String((r as Record<string, unknown>).niche_name) : null,
    })),
    accounts: (accounts as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      platform: r.platform as string,
      handle: r.handle as string,
      niche_id: (r.niche_id as string) ?? null,
      status: (r.status as string) ?? "active",
      created_at: String(r.created_at),
      niche_name: (r.niche_name as string) ?? null,
    })),
    media: (media as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      title: (r.title as string) ?? null,
      url: (r.url as string) ?? null,
    })),
    niches: (niches as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      niche_name: r.niche_name as string,
      slug: r.slug as string,
    })),
  };
});

const upsertPost = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as {
    id?: string | null;
    title: string;
    content?: string | null;
    platforms: string[];
    imageUrl?: string | null;
    link?: string | null;
    scheduledAt?: string | null;
    status?: string;
    nicheId?: string | null;
    accountId?: string | null;
  };
  const sql = getSql();
  const platform = input.platforms[0] ?? "twitter";
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
  const status =
    input.status ??
    (scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? "scheduled" : "draft");

  if (input.id) {
    await sql`
      UPDATE social_posts
      SET title = ${input.title},
          content = ${input.content ?? null},
          platforms = ${input.platforms},
          platform = ${platform},
          image_url = ${input.imageUrl ?? null},
          link = ${input.link ?? null},
          scheduled_at = ${scheduledAt},
          niche_id = ${input.nicheId ?? null},
          account_id = ${input.accountId ?? null}
      WHERE id = ${input.id}
    `;
    return { success: true };
  }

  const rows = await sql`
    INSERT INTO social_posts (title, content, platforms, platform, image_url, link, scheduled_at, status, niche_id, account_id)
    VALUES (${input.title}, ${input.content ?? null}, ${input.platforms}, ${platform}, ${input.imageUrl ?? null}, ${input.link ?? null}, ${scheduledAt}, ${status}, ${input.nicheId ?? null}, ${input.accountId ?? null})
    RETURNING id
  `;
  return { success: true, id: rows[0]?.id as string | undefined };
});

const setPostStatus = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const { id, status } = ctx.data as { id: string; status: string };
  const sql = getSql();
  if (status === "published") {
    await sql`
      UPDATE social_posts
      SET status = 'published',
          published_at = now()
      WHERE id = ${id}
    `;
  } else {
    await sql`UPDATE social_posts SET status = ${status} WHERE id = ${id}`;
  }
  return { success: true };
});

const deletePost = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`DELETE FROM social_posts WHERE id = ${id}`;
  return { success: true };
});

const upsertAccount = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const input = ctx.data as { id?: string | null; platform: string; handle: string; nicheId?: string | null };
  const sql = getSql();
  if (input.id) {
    await sql`
      UPDATE social_accounts
      SET platform = ${input.platform}, handle = ${input.handle}, niche_id = ${input.nicheId ?? null}
      WHERE id = ${input.id}
    `;
  } else {
    await sql`
      INSERT INTO social_accounts (platform, handle, niche_id)
      VALUES (${input.platform}, ${input.handle}, ${input.nicheId ?? null})
    `;
  }
  return { success: true };
});

const deleteAccount = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const id = ctx.data as string;
  const sql = getSql();
  await sql`UPDATE social_posts SET account_id = NULL WHERE account_id = ${id}`;
  await sql`DELETE FROM social_accounts WHERE id = ${id}`;
  return { success: true };
});

// ── Route ──

export const Route = createFileRoute("/social")({
  loader: () => fetchSocialData(),
  component: Social,
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-400">{error}</div>;
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

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500">{text}</p>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-800 text-gray-300 border-gray-600",
  scheduled: "bg-cyan-900/60 text-cyan-300 border-cyan-500/30",
  published: "bg-green-900/60 text-green-400 border-green-500/30",
  cancelled: "bg-yellow-900/60 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-900/60 text-red-400 border-red-500/30",
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${c}`}>
      {status}
    </span>
  );
}

const PLATFORM_BADGES: Record<string, string> = {
  twitter: "bg-sky-900/60 text-sky-300 border-sky-500/30",
  linkedin: "bg-blue-900/60 text-blue-300 border-blue-500/30",
  facebook: "bg-indigo-900/60 text-indigo-300 border-indigo-500/30",
  instagram: "bg-pink-900/60 text-pink-300 border-pink-500/30",
};

function PlatformBadges({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${PLATFORM_BADGES[p] ?? "bg-gray-800 text-gray-300 border-gray-600"}`}
        >
          {platformLabel(p)}
        </span>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Post composer ──

function PostSection({
  posts,
  media,
  niches,
  accounts,
  onChanged,
}: {
  posts: SocialPost[];
  media: MediaAsset[];
  niches: Niche[];
  accounts: SocialAccount[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["twitter"]);
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const reset = () => {
    setTitle("");
    setContent("");
    setPlatforms(["twitter"]);
    setImageUrl("");
    setLink("");
    setScheduledAt("");
    setNicheId("");
    setAccountId("");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (p: SocialPost) => {
    setEditingId(p.id);
    setTitle(p.title);
    setContent(p.content ?? "");
    setPlatforms(p.platforms?.length ? p.platforms : [p.platform]);
    setImageUrl(p.image_url ?? "");
    setLink(p.link ?? "");
    setScheduledAt(toLocalInput(p.scheduled_at));
    setNicheId(p.niche_id ?? "");
    setAccountId(p.account_id ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || platforms.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertPost({
        data: {
          id: editingId,
          title: title.trim(),
          content: content.trim() || null,
          platforms,
          imageUrl: imageUrl.trim() || null,
          link: link.trim() || null,
          scheduledAt: scheduledAt || null,
          nicheId: nicheId || null,
          accountId: accountId || null,
        },
      });
      reset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setBusy(false);
    }
  };

  const publishNow = async (p: SocialPost) => {
    await setPostStatus({ data: { id: p.id, status: "published" } });
    await onChanged();
  };

  const cancel = async (p: SocialPost) => {
    if (!confirm(`Cancel scheduled post "${p.title}"?`)) return;
    await setPostStatus({ data: { id: p.id, status: "cancelled" } });
    await onChanged();
  };

  const restoreDraft = async (p: SocialPost) => {
    await setPostStatus({ data: { id: p.id, status: "draft" } });
    await onChanged();
  };

  const remove = async (p: SocialPost) => {
    if (!confirm(`Delete post "${p.title}"?`)) return;
    await deletePost({ data: p.id });
    await onChanged();
  };

  const mediaUrls = media.map((m) => m.url).filter((u): u is string => !!u);

  return (
    <Section title="📝 Compose Post" description="Create a post, pick target platform(s), and schedule it for later publishing.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title *">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="10 habits of productive founders" required />
          </Field>
          <Field label="Target platforms *">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      on
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {p.emoji} {p.label}
                  </button>
                );
              })}
            </div>
            {platforms.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">Will publish to: {platforms.map(platformLabel).join(", ")}</p>
            )}
          </Field>
        </div>

        <Field label="Content">
          <textarea
            className={`${inputCls} resize-y`}
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the post body…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Schedule date & time" hint="Leave empty to save as draft.">
            <input
              className={inputCls}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
          <Field label="Image URL" hint="Optional — pick from generated media assets.">
            <input
              className={inputCls}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/image.png"
              list="social-media-options"
            />
            <datalist id="social-media-options">
              {mediaUrls.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Link">
            <input
              className={inputCls}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— None —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.niche_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account">
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {platformLabel(a.platform)} · {a.handle}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !title.trim() || platforms.length === 0} className={btnPrimary}>
            {busy ? "Saving…" : editingId ? "Update Post" : scheduledAt ? "Schedule Post" : "Save Draft"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-white">All Posts</h3>
        <div className="mt-3 glass-card rounded-xl overflow-x-auto">
          {posts.length === 0 ? (
            <EmptyHint text="No posts yet — compose your first one above." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Platforms</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{p.title}</div>
                      {p.content && <div className="mt-1 max-w-xs truncate text-xs text-gray-400">{p.content}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadges platforms={p.platforms?.length ? p.platforms : [p.platform]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {p.status === "scheduled" && (
                          <>
                            <button onClick={() => publishNow(p)} className={btnGhost}>Publish now</button>
                            <button onClick={() => cancel(p)} className={btnGhost}>Cancel</button>
                          </>
                        )}
                        {p.status === "cancelled" && (
                          <button onClick={() => restoreDraft(p)} className={btnGhost}>Reopen</button>
                        )}
                        {p.status === "draft" && (
                          <button onClick={() => publishNow(p)} className={btnGhost}>Publish now</button>
                        )}
                        <button onClick={() => startEdit(p)} className={btnGhost}>Edit</button>
                        <button onClick={() => remove(p)} className={btnDanger}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Section>
  );
}

// ── Accounts ──

function AccountSection({ accounts, niches, onChanged }: { accounts: SocialAccount[]; niches: Niche[]; onChanged: () => void }) {
  const [platform, setPlatform] = useState("twitter");
  const [handle, setHandle] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAccount({ data: { platform, handle: handle.trim(), nicheId: nicheId || null } });
      setHandle("");
      setNicheId("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: SocialAccount) => {
    if (!confirm(`Remove account @${a.handle}? Posts will be unlinked.`)) return;
    await deleteAccount({ data: a.id });
    await onChanged();
  };

  return (
    <Section title="🔗 Connected Accounts" description="The handles your posts are scheduled to. Optional — posts can be created without an account.">
      <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Platform">
            <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Handle *">
            <input
              className={inputCls}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@brandhandle"
              required
            />
          </Field>
          <Field label="Niche">
            <select className={inputCls} value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
              <option value="">— None —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.niche_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNote error={error} />
        <button type="submit" disabled={busy || !handle.trim()} className={btnPrimary}>
          {busy ? "Adding…" : "Add Account"}
        </button>
      </form>

      <div className="mt-6 glass-card rounded-xl overflow-x-auto">
        {accounts.length === 0 ? (
          <EmptyHint text="No connected accounts yet." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Handle</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30">
                  <td className="px-4 py-3"><PlatformBadges platforms={[a.platform]} /></td>
                  <td className="px-4 py-3 font-medium text-white">{a.handle}</td>
                  <td className="px-4 py-3 text-gray-400">{a.niche_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => remove(a)} className={btnDanger}>Remove</button>
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

function Social() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<SocialData>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await fetchSocialData());
    } finally {
      setRefreshing(false);
    }
  };

  const now = Date.now();
  const upcoming = data.posts.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() > now);
  const published = data.posts.filter((p) => p.status === "published");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">📣 Social Media Automation</h1>
              <p className="mt-2 text-gray-400">
                Compose posts, schedule them across platforms, and track your publishing queue.
              </p>
            </div>
            <button onClick={refresh} disabled={refreshing} className={btnGhost}>
              {refreshing ? "Refreshing…" : "⟳ Refresh"}
            </button>
          </div>

          {/* KPI cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Upcoming" value={String(upcoming.length)} sub="scheduled posts" />
            <KpiCard label="Published" value={String(published.length)} sub="posts live" />
            <KpiCard label="Drafts" value={String(data.posts.filter((p) => p.status === "draft").length)} sub="not yet scheduled" />
            <KpiCard label="Accounts" value={String(data.accounts.length)} sub="connected platforms" />
          </div>

          {/* Upcoming schedule list */}
          <div className="mt-4 glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Upcoming Schedule</h3>
            <p className="mt-0.5 text-xs text-gray-400">Posts scheduled to go out</p>
            <div className="mt-4 space-y-2">
              {upcoming.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">Nothing scheduled yet — compose and schedule a post above.</p>
              ) : (
                upcoming.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{p.title}</p>
                      <p className="text-xs text-gray-500">{new Date(p.scheduled_at!).toLocaleString()}</p>
                    </div>
                    <PlatformBadges platforms={p.platforms?.length ? p.platforms : [p.platform]} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <PostSection
        posts={data.posts}
        media={data.media}
        niches={data.niches}
        accounts={data.accounts}
        onChanged={refresh}
      />
      <AccountSection accounts={data.accounts} niches={data.niches} onChanged={refresh} />
    </div>
  );
}
