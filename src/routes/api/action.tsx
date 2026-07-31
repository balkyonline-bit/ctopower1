import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { useTranslation } from "react-i18next";

export const logAgentAction = createServerFn().handler(
  async (opts: { agent_id: string; action: string; niche_name?: string }) => {
    const sql = getSql();
    const { agent_id, action, niche_name } = opts;

    if (!agent_id || !action) {
      throw new Error("Missing required fields: agent_id, action");
    }

    const agentRows = await sql`SELECT * FROM ai_agents WHERE id = ${agent_id} LIMIT 1`;
    if (agentRows.length === 0) throw new Error("Agent not found");

    const agent = agentRows[0] as Record<string, unknown>;

    const details = niche_name
      ? { niche_name, timestamp: new Date().toISOString() }
      : { timestamp: new Date().toISOString() };

    await sql`
      INSERT INTO agent_activity_log (agent_id, action, details)
      VALUES (${agent_id}, ${action}, ${JSON.stringify(details)})
    `;

    return {
      success: true,
      action,
      confirmed: true,
      agent: {
        id: agent.id as string,
        name: agent.name as string,
        role: agent.role as string,
        status: agent.status as string,
      },
      logged_at: new Date().toISOString(),
      message: `Action "${action}" logged for agent "${agent.name as string}"`,
    };
  },
);

export const Route = createFileRoute("/api/action")({
  component: ApiActionPage,
});

function ApiActionPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-card max-w-lg rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <h2 className="text-xl font-bold text-white">{t("api.actionTitle")}</h2>
        <p className="mt-2 text-sm text-gray-400">
          {t("api.actionDesc")}
        </p>
        <div className="mt-6 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t("api.requestPayload")}</p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "agent_id": "uuid",
  "action": "string",
  "niche_name": "string (optional)"
}`}
          </pre>
        </div>
        <div className="mt-4 rounded-xl bg-gray-900/60 p-4 text-left">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t("api.response")}</p>
          <pre className="text-xs text-gray-300 overflow-auto">
{`{
  "success": true,
  "action": "...",
  "confirmed": true,
  "agent": { "id": "...", "name": "...", "role": "...", "status": "..." },
  "logged_at": "ISO timestamp",
  "message": "..."
}`}
          </pre>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          {t("api.actionLoggedTo")}
        </p>
      </div>
    </div>
  );
}
