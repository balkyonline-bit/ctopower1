/**
 * Pure, client-safe metadata for the five development agents.
 * Keep this module free of server imports — the tool pages, the /tech cards
 * and the navigation all share it.
 */

export const DEV_ROLES = [
  "product_manager",
  "software_architect",
  "developer",
  "qa_tester",
  "product_reviewer",
] as const;

export type DevRole = (typeof DEV_ROLES)[number];

export const ROLE_ICONS: Record<string, string> = {
  product_manager: "📋",
  software_architect: "🏗️",
  developer: "⌨️",
  qa_tester: "🧪",
  product_reviewer: "🛡️",
};

/** `product_manager` → `product-manager` (URL segment used by /tech/tools/<slug>). */
export function roleToSlug(role: string): string {
  return role.replace(/_/g, "-");
}

/** `product-manager` (or `product_manager`) → `product_manager`, or null if unknown. */
export function slugToRole(slug: string): string | null {
  const normalized = (slug ?? "").trim().toLowerCase().replace(/-/g, "_");
  return (DEV_ROLES as readonly string[]).includes(normalized) ? normalized : null;
}

/** Canonical per-tool page path. */
export function toolPath(role: string): string {
  return `/tech/tools/${roleToSlug(role)}`;
}

/** Role-appropriate auto-title for the task a run creates. */
export const TASK_TITLES: Record<string, (project: string) => string> = {
  product_manager: (p) => `Create PRD for ${p}`,
  software_architect: (p) => `Design technical architecture for ${p}`,
  developer: (p) => `Implement core modules for ${p}`,
  qa_tester: (p) => `Write test plan for ${p}`,
  product_reviewer: (p) => `Review release for ${p}`,
};

/** Default project name used when the visitor leaves the input empty. */
export const DEFAULT_PROJECT = "web platform";

export interface DevAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  tools: string[];
  status: string;
  tasks_completed: number;
  last_run: string | null;
  video_url: string | null;
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

export interface VideoTarget {
  kind: "iframe" | "video" | "link";
  src: string;
  provider: "youtube" | "vimeo" | "dailymotion" | "file" | "page";
}

const YT_ID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/;

/**
 * Work out how to play a saved video URL.
 * YouTube / Vimeo / Dailymotion → privacy-enhanced or player embed, direct
 * media files → native <video>, anything else → an iframe attempt plus a
 * fallback link to the source.
 */
export function videoTarget(rawUrl: string): VideoTarget | null {
  const url = (rawUrl ?? "").trim();
  if (!url) return null;

  // Relative URLs (our own /api/media/<name> uploads) and absolute ones alike.
  let parsed: URL | null = null;
  try {
    parsed = new URL(url, "https://empireai.local");
  } catch {
    return null;
  }
  const path = parsed.pathname.toLowerCase();

  const yt = YT_ID.exec(url);
  if (yt) {
    return { kind: "iframe", provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  }

  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vimeo) {
    return { kind: "iframe", provider: "vimeo", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  const dm = /dailymotion\.com\/(?:embed\/)?video\/([A-Za-z0-9]+)/.exec(url);
  if (dm) {
    return { kind: "iframe", provider: "dailymotion", src: `https://www.dailymotion.com/embed/video/${dm[1]}` };
  }

  if (/\.(mp4|webm|ogg|ogv|mov|m4v|mpeg|mpg|mkv)$/.test(path)) {
    return { kind: "video", provider: "file", src: url };
  }

  return { kind: "iframe", provider: "page", src: url };
}
