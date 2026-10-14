/**
 * GET /api/media/<file> — serves a stored tutorial video from <repo>/.uploads.
 * 200 + video content-type for a real file, 404 for anything missing or unsafe.
 */
import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentTypeFor, safeMediaName, uploadsDir } from "~/lib/uploads.server";

export const Route = createFileRoute("/api/media/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = safeMediaName(String(params.file ?? ""));
        if (!name) return new Response("Not found", { status: 404 });

        try {
          const bytes = await readFile(join(uploadsDir(), name));
          return new Response(new Uint8Array(bytes), {
            status: 200,
            headers: {
              "content-type": contentTypeFor(name),
              "content-length": String(bytes.byteLength),
              "cache-control": "public, max-age=31536000, immutable",
              "accept-ranges": "bytes",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
