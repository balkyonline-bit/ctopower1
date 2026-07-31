/**
 * Agent Run API — POST endpoints for executing tasks and pipelines.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { executeTask } from "~/services/agent-executor";
import { runContentPipeline } from "~/services/content-pipeline";
import { useTranslation } from "react-i18next";

export const runTaskAction = createServerFn().handler(
  async (opts: { task_id: string }) => {
    const { task_id } = opts;
    if (!task_id) throw new Error("Missing required field: task_id");
    return executeTask(task_id);
  },
);

export const runPipelineAction = createServerFn().handler(
  async (opts: { niche_slug: string }) => {
    const { niche_slug } = opts;
    if (!niche_slug) throw new Error("Missing required field: niche_slug");
    return runContentPipeline(niche_slug);
  },
);

export const Route = createFileRoute("/api/run")({
  component: ApiRunPage,
});

function ApiRunPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-card max-w-lg rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h2 className="text-xl font-bold text-white">{t("api.runTitle")}</h2>
        <p className="mt-2 text-sm text-gray-400">{t("api.runDesc")}</p>

        <div className="mt-6 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
            {t("api.executeTask")}
          </p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "task_id": "uuid-of-task"
}`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            {t("api.executeTaskDesc")}
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
            {t("api.pipelineEndpoint")}
          </p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "niche_slug": "your-niche-slug"
}`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            {t("api.pipelineEndpointDesc")}
          </p>
        </div>

        <div className="mt-6 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t("api.pipelineResponseLabel")}</p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "success": true,
  "nicheSlug": "...",
  "nicheName": "...",
  "steps": [
    { "step": 1, "agent": "SEO Research Agent", "success": true, "summary": "..." },
    { "step": 2, "agent": "Content Strategist", "success": true, "summary": "..." },
    { "step": 3, "agent": "AI Writer Agent", "success": true, "summary": "..." }
  ]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
