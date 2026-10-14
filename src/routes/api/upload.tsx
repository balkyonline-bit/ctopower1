/**
 * POST /api/upload — multipart upload of a tutorial video.
 *
 * Accepts a single `file` field holding a real video file (declared type must
 * start with `video/`, size ≤ 50 MB), stores it as `<repo>/.uploads/<uuid><ext>`
 * and answers `{ ok: true, url: "/api/media/<name>", ... }`. Failures answer a
 * JSON body with a stable machine-readable `code` so the UI can translate it.
 */
import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
  contentTypeFor,
  ensureUploadsDir,
  extensionFor,
  MAX_UPLOAD_BYTES,
} from "~/lib/uploads.server";

function fail(code: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, code, ...extra }, { status });
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const entry = form.get("file");
          if (!entry || typeof entry === "string") {
            return fail("bad_request", 400);
          }
          const file = entry as File;

          if (!file.type || !file.type.startsWith("video/")) {
            return fail("bad_type", 415, { got: file.type || null });
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return fail("too_large", 413, { size: file.size, max: MAX_UPLOAD_BYTES });
          }

          const bytes = new Uint8Array(await file.arrayBuffer());
          const name = `${randomUUID()}${extensionFor(file)}`;
          const path = join(ensureUploadsDir(), name);
          await writeFile(path, bytes);

          // Confirm the bytes really landed before telling the caller it worked.
          const onDisk = await stat(path);
          if (onDisk.size !== bytes.byteLength) {
            return fail("server_error", 500, {
              reason: `wrote ${String(onDisk.size)} of ${String(bytes.byteLength)} bytes`,
            });
          }

          return Response.json({
            ok: true,
            url: `/api/media/${name}`,
            name,
            bytes: onDisk.size,
            type: contentTypeFor(name),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("upload failed:", message);
          return fail("server_error", 500, { reason: message });
        }
      },
    },
  },
});
