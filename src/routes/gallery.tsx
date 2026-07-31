import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// ── Server functions ──

const fetchMediaAssets = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      ma.id, ma.type, ma.title, ma.content, ma.url, ma.metadata, ma.created_at,
      a.name as agent_name, a.role as agent_role,
      np.niche_name, np.slug as niche_slug
    FROM media_assets ma
    LEFT JOIN ai_agents a ON ma.agent_id = a.id
    LEFT JOIN niche_profiles np ON ma.niche_id = np.id
    ORDER BY ma.created_at DESC
    LIMIT 50
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    type: r.type as string,
    title: (r.title as string) ?? "",
    content: (r.content as string) ?? "",
    url: (r.url as string) ?? "",
    metadata: r.metadata as Record<string, unknown> | null,
    created_at: String(r.created_at),
    agent_name: (r.agent_name as string) ?? null,
    agent_role: (r.agent_role as string) ?? null,
    niche_name: (r.niche_name as string) ?? null,
    niche_slug: (r.niche_slug as string) ?? null,
  }));
});

const fetchArticlesForGallery = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      a.id, a.title, a.slug, a.excerpt, a.word_count, a.status,
      a.seo_keywords, a.published_at, a.created_at,
      np.niche_name, np.slug as niche_slug
    FROM articles a
    JOIN niche_profiles np ON a.niche_id = np.id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
    LIMIT 30
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    excerpt: (r.excerpt as string) ?? "",
    word_count: r.word_count as number,
    seo_keywords: (r.seo_keywords as string[]) ?? [],
    published_at: r.published_at ? String(r.published_at) : null,
    created_at: String(r.created_at),
    niche_name: r.niche_name as string,
    niche_slug: r.niche_slug as string,
  }));
});

const fetchActivityLogForGallery = createServerFn().handler(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT 
      al.id, al.action, al.details, al.created_at,
      a.name as agent_name, a.role as agent_role
    FROM agent_activity_log al
    LEFT JOIN ai_agents a ON al.agent_id = a.id
    ORDER BY al.created_at DESC
    LIMIT 50
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

// ── Route ──

export const Route = createFileRoute("/gallery")({
  loader: async () => {
    const [mediaAssets, articles, activityLog] = await Promise.all([
      fetchMediaAssets(),
      fetchArticlesForGallery(),
      fetchActivityLogForGallery(),
    ]);
    return { mediaAssets, articles, activityLog };
  },
  component: GalleryPage,
});

// ── Helpers ──

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Type icon map ──

const TYPE_ICONS: Record<string, string> = {
  article: "📝",
  image: "🖼️",
  social_post: "📱",
  message: "💬",
  video: "🎬",
};

type GalleryTab = "all" | "articles" | "images" | "social_posts" | "messages";

// ── Component ──

function GalleryPage() {
  const { mediaAssets, articles, activityLog } = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<GalleryTab>("all");
  const { t } = useTranslation();

  const tabs: Array<{ key: GalleryTab; label: string }> = [
    { key: "all", label: t("gallery.tabs.all") },
    { key: "articles", label: t("gallery.tabs.articles") },
    { key: "images", label: t("gallery.tabs.images") },
    { key: "social_posts", label: t("gallery.tabs.socialPosts") },
    { key: "messages", label: t("gallery.tabs.messages") },
  ];

  // Combine everything for "all" tab
  const allItems = [
    ...articles.map((a) => ({
      id: a.id,
      type: "article" as const,
      title: a.title,
      agentName: t("article.aiAuthor"),
      agentRole: "writer",
      date: formatDate(a.published_at ?? a.created_at),
      nicheName: a.niche_name,
      nicheSlug: a.niche_slug,
      articleSlug: a.slug,
      wordCount: a.word_count,
      keywords: a.seo_keywords,
    })),
    ...mediaAssets
      .filter((m) => m.type !== "article")
      .map((m) => ({
        id: m.id,
        type: m.type as "image" | "video" | "social_post" | "message",
        title: m.title || m.content?.substring(0, 80) || "Untitled",
        agentName: m.agent_name ?? "System",
        agentRole: m.agent_role ?? "",
        date: formatDate(m.created_at),
        nicheName: m.niche_name,
        nicheSlug: m.niche_slug,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredItems =
    activeTab === "all"
      ? allItems
      : activeTab === "messages"
        ? [] // Messages are shown separately in activity feed
        : activeTab === "articles"
          ? allItems.filter((i) => i.type === "article")
          : activeTab === "images"
            ? allItems.filter((i) => i.type === "image")
            : allItems.filter((i) => i.type === "social_post");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="border-b border-gray-800/50 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("gallery.title")}
          </h1>
          <p className="mt-3 text-lg text-gray-400">
            {t("gallery.subtitle")}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-gray-800/50 px-6 py-3">
        <div className="mx-auto max-w-6xl">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          {activeTab === "messages" ? (
            /* Activity Feed for Messages tab */
            <div>
              <h2 className="text-xl font-bold tracking-tight mb-2">{t("gallery.activityFeed")}</h2>
              <p className="text-sm text-gray-400 mb-6">{t("gallery.activityFeedDesc")}</p>

              {activityLog.length === 0 ? (
                <EmptyState message={t("gallery.empty")} />
              ) : (
                <div className="space-y-2">
                  {activityLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="glass-card rounded-xl p-4 flex items-start gap-4"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-lg">
                        💬
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm">
                            {entry.agent_name}
                          </span>
                          {entry.agent_role && (
                            <span className="text-xs text-indigo-400 uppercase">
                              {entry.agent_role}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-300">
                          <span className="text-gray-500">{t("gallery.messageCard.actionLabel")} </span>
                          {entry.action}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(entry.created_at)} · {formatTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState message={t("gallery.empty")} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <GalleryCard key={`${item.type}-${item.id}`} item={item} t={t} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/10 text-4xl">
        🎨
      </div>
      <h2 className="text-xl font-semibold text-white">No content yet</h2>
      <p className="mt-2 text-gray-400 max-w-md mx-auto">{message}</p>
    </div>
  );
}

function GalleryCard({
  item,
  t,
}: {
  item: {
    id: string;
    type: string;
    title: string;
    agentName: string;
    agentRole: string;
    date: string;
    nicheName?: string | null;
    nicheSlug?: string | null;
    articleSlug?: string;
    wordCount?: number;
    keywords?: string[];
  };
  t: (key: string) => string;
}) {
  const icon = TYPE_ICONS[item.type] ?? "📄";

  const isArticle = item.type === "article" && item.nicheSlug && item.articleSlug;
  const href = isArticle
    ? `/niche/${item.nicheSlug}/articles/${item.articleSlug}`
    : null;

  return (
    <div className="group glass-card rounded-2xl p-5 transition-all duration-300 hover:border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]">
      {/* Type icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400 capitalize">
          {item.type.replace("_", " ")}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 mb-2">
        {item.title}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span>{item.agentName}</span>
        {item.nicheName && (
          <>
            <span>·</span>
            <span>{item.nicheName}</span>
          </>
        )}
      </div>

      {/* Keywords for articles */}
      {item.keywords && item.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.keywords.slice(0, 3).map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Word count for articles */}
      {item.wordCount && (
        <p className="text-xs text-gray-500 mb-3">
          {item.wordCount.toLocaleString()} {t("gallery.articleCard.words")}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <span className="text-xs text-gray-500">{item.date}</span>
        {href ? (
          <a
            href={href}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {t("gallery.articleCard.viewArticle")}
          </a>
        ) : (
          <span className="text-xs text-gray-600">
            {item.type === "image" || item.type === "video" || item.type === "social_post"
              ? "Coming soon"
              : ""}
          </span>
        )}
      </div>
    </div>
  );
}
