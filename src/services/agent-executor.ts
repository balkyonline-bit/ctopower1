/**
 * Agent Executor Service — runs AI agent tasks via LLM.
 * Loads task + agent from DB, calls LLM, saves result, updates metrics.
 */
import { getSql } from "~/db";
import { callLLM } from "~/services/llm";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  instructions: string;
  tasks_completed: number;
  performance_score: number;
}

interface TaskRow {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  status: string;
  result: unknown;
}

export interface ExecuteTaskResult {
  success: boolean;
  taskId: string;
  agentName: string;
  agentRole: string;
  result: unknown;
  error?: string;
}

/**
 * Execute a single agent task:
 * 1. Load the task and assigned agent from DB
 * 2. Call the LLM with agent instructions + task description
 * 3. Save the result and mark task as completed
 * 4. Log activity and update agent metrics
 */
export async function executeTask(
  taskId: string,
): Promise<ExecuteTaskResult> {
  const sql = getSql();

  // 1. Load the task
  const taskRows = await sql`
    SELECT id, agent_id, title, description, status, result
    FROM agent_tasks
    WHERE id = ${taskId}
    LIMIT 1
  `;

  if (taskRows.length === 0) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const task = taskRows[0] as unknown as TaskRow;

  if (task.status === "completed") {
    return {
      success: true,
      taskId: task.id,
      agentName: "Already completed",
      agentRole: "",
      result: task.result,
    };
  }

  // 2. Load the assigned agent
  const agentRows = await sql`
    SELECT id, name, role, instructions, tasks_completed, performance_score
    FROM ai_agents
    WHERE id = ${task.agent_id}
    LIMIT 1
  `;

  if (agentRows.length === 0) {
    throw new Error(`Agent not found for task: ${taskId}`);
  }

  const agent = agentRows[0] as unknown as AgentRow;

  // 3. Mark task as in_progress and set started_at
  await sql`
    UPDATE agent_tasks
    SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
    WHERE id = ${taskId}
  `;

  // 4. Build the LLM prompt
  const systemPrompt = agent.instructions
    ? `${agent.instructions}\n\nYou are ${agent.name}, role: ${agent.role}. Respond with structured, actionable output.`
    : `You are ${agent.name}, an AI agent with role: ${agent.role}. Respond with structured, actionable output.`;

  const prompt = [
    `## Task: ${task.title}`,
    task.description ? `\n## Description:\n${task.description}` : "",
    `\n\nPlease complete this task and provide your output in a structured format (JSON where applicable). Be thorough and actionable.`,
  ].join("\n");

  // 5. Call the LLM
  let llmResult: string;
  let parsedResult: unknown;

  try {
    llmResult = await callLLM(prompt, systemPrompt);

    // Try to parse as JSON; if it fails, wrap as text
    try {
      parsedResult = JSON.parse(llmResult);
    } catch {
      parsedResult = { output: llmResult, format: "text" };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Save error to task result
    await sql`
      UPDATE agent_tasks
      SET status = 'failed', result = ${JSON.stringify({ error: errorMessage })}, completed_at = NOW()
      WHERE id = ${taskId}
    `;

    // Log the failure
    await sql`
      INSERT INTO agent_activity_log (agent_id, action, details)
      VALUES (${agent.id}, 'task_failed', ${JSON.stringify({ task_id: taskId, error: errorMessage })})
    `;

    return {
      success: false,
      taskId: task.id,
      agentName: agent.name,
      agentRole: agent.role,
      result: { error: errorMessage },
      error: errorMessage,
    };
  }

  // 6. Save the result and mark as completed
  await sql`
    UPDATE agent_tasks
    SET status = 'completed', result = ${JSON.stringify(parsedResult)}, completed_at = NOW()
    WHERE id = ${taskId}
  `;

  // 6b. Save output to media_assets for the gallery
  try {
    // Check if task has a niche_id
    const taskInfo = await sql`
      SELECT niche_id FROM agent_tasks WHERE id = ${taskId} LIMIT 1
    `;
    const nicheId = (taskInfo[0] as { niche_id: string | null } | undefined)?.niche_id ?? null;

    const resultSummary =
      typeof parsedResult === "object" && parsedResult !== null
        ? JSON.stringify(parsedResult).substring(0, 500)
        : String(parsedResult).substring(0, 500);

    await sql`
      INSERT INTO media_assets (agent_id, niche_id, type, title, content, metadata, created_at)
      VALUES (
        ${agent.id},
        ${nicheId},
        'message',
        ${task.title},
        ${resultSummary},
        ${JSON.stringify({ task_id: taskId, agent_role: agent.role, agent_name: agent.name })},
        NOW()
      )
    `;
  } catch (mediaErr) {
    // Non-critical — don't fail the task if gallery logging fails
    console.error("Failed to log media asset:", mediaErr);
  }

  // 7. Log to agent_activity_log
  await sql`
    INSERT INTO agent_activity_log (agent_id, action, details)
    VALUES (
      ${agent.id},
      'task_completed',
      ${JSON.stringify({ task_id: taskId, task_title: task.title, timestamp: new Date().toISOString() })}
    )
  `;

  // 8. Update agent metrics
  const newCount = agent.tasks_completed + 1;
  const newScore = Math.min(1.0, (agent.performance_score * agent.tasks_completed + 0.85) / newCount);

  await sql`
    UPDATE ai_agents
    SET tasks_completed = ${newCount},
        performance_score = ${newScore},
        last_run = NOW(),
        status = 'idle'
    WHERE id = ${agent.id}
  `;

  return {
    success: true,
    taskId: task.id,
    agentName: agent.name,
    agentRole: agent.role,
    result: parsedResult,
  };
}
