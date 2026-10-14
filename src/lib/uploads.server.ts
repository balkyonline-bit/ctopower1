/**
 * Server-only helpers for uploaded tutorial videos.
 *
 * Files live in `<repoRoot>/.uploads/<uuid><ext>` and are served back through
 * the GET route /api/media/<name>. Nothing here may be imported from a client
 * component — it pulls in node:fs / node:path.
 */
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Hard upload limit advertised in the UI (video/* only). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Resolve the uploads directory. The server may be started from the repo root
 * (publish.sh) or from dist/server (bundled SSR handler), so walk up from the
 * working directory until the package.json that marks the repo root shows up.
 */
export function uploadsDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return join(dir, ".uploads");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), ".uploads");
}

export function ensureUploadsDir(): string {
  const dir = uploadsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/mpeg": ".mpeg",
  "video/x-m4v": ".m4v",
};

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".m4v": "video/x-m4v",
};

/** Extension for a stored upload: prefer the declared MIME type, fall back to the filename. */
export function extensionFor(file: File): string {
  const byMime = EXT_BY_MIME[file.type];
  if (byMime) return byMime;
  const dot = file.name.lastIndexOf(".");
  if (dot > -1) {
    const ext = file.name.slice(dot).toLowerCase();
    if (MIME_BY_EXT[ext]) return ext;
  }
  return ".mp4";
}

/** Content-Type served for a stored file (defaults to application/octet-stream). */
export function contentTypeFor(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME_BY_EXT[name.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Reject anything that is not a plain generated file name (no path traversal,
 * no hidden files). Returns the safe basename or null.
 */
export function safeMediaName(raw: string): string | null {
  const base = basename(raw ?? "");
  if (!base || base !== raw) return null;
  if (base.startsWith(".")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(base)) return null;
  return base;
}
