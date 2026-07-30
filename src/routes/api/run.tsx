/**
 * Agent Run API — POST endpoints for executing tasks and pipelines.
 *
 * POST /api/run          → { task_id } → executes a single task
 * POST /api/run/pipeline → { niche_slug } → runs full content pipeline
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { executeTask } from "~/services/agent-executor";
import { runContentPipeline } from "~/services/content-pipeline";

// ── Server function: execute a single task ──

export const runTaskAction = createServerFn().handler(
  async (opts: { task_id: string }) => {
    const { task_id } = opts;

    if (!task_id) {
      throw new Error("Missing required field: task_id");
    }

    const result = await executeTask(task_id);
    return result;
  },
);

// ── Server function: run content pipeline ──

export const runPipelineAction = createServerFn().handler(
  async (opts: { niche_slug: string }) => {
    const { niche_slug } = opts;

    if (!niche_slug) {
      throw new Error("Missing required field: niche_slug");
    }

    const result = await runContentPipeline(niche_slug);
    return result;
  },
);

// ── Route (documentation page for GET) ──

export const Route = createFileRoute("/api/run")({
  component: ApiRunPage,
});

function ApiRunPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-card max-w-lg rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h2 className="text-xl font-bold text-white">Agent Run API</h2>
        <p className="mt-2 text-sm text-gray-400">
          Use the server functions to execute AI agent tasks and content pipelines.
        </p>

        <div className="mt-6 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
            POST /api/run — Execute Task
          </p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "task_id": "uuid-of-task"
}`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            Calls <code className="text-indigo-400">runTaskAction</code> server function.
            Returns the task execution result with agent info and LLM output.
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
            POST /api/run/pipeline — Content Pipeline
          </p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "niche_slug": "your-niche-slug"
}`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            Calls <code className="text-indigo-400">runPipelineAction</code> server function.
            Chains SEO → Strategist → Writer tasks for the given niche.
          </p>
        </div>

        <div className="mt-6 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Pipeline Response</p>
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
