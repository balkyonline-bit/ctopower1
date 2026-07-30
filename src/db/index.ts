import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// --- In-memory store (works without database) ---
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  instructions: string;
  tools: string[];
  status: string;
  tasks_completed: number;
  performance_score: number;
  last_run: string | null;
  created_at: string;
}

interface Task {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  result: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const DEFAULT_AGENTS: Omit<Agent, "id" | "created_at" | "last_run">[] = [
  { name: "Chief AI Marketing Officer", role: "ceo", description: "Orchestrates all AI agents, sets daily marketing plans, assigns tasks, and analyzes results.", instructions: "You are the Chief AI Marketing Officer. Your job is to coordinate all marketing agents, prioritize tasks, and optimize for revenue.", tools: ["orchestrator", "analytics"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "SEO Research Agent", role: "seo", description: "Finds keywords, content gaps, user questions, and competitor insights.", instructions: "Find high-volume, low-competition keywords. Analyze SERP competition. Identify content opportunities.", tools: ["google-trends", "keyword-research", "serp-analysis"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "AI Writer Agent", role: "writer", description: "Creates blog posts, guides, reviews, and product comparisons — 3000-6000 words, SEO-optimized.", instructions: "Write comprehensive, helpful content. Include real examples, pricing, pros/cons. Never produce thin affiliate content.", tools: ["content-generation", "seo-optimization"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "Content Strategist", role: "strategist", description: "Builds content calendars, identifies pillar content, and plans topic clusters.", instructions: "Plan content strategy based on niche and competition. Create 30-60-90 day content calendars.", tools: ["content-planning", "calendar"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "Social Media Agent", role: "social", description: "Creates and schedules social media posts across platforms.", instructions: "Create engaging social content. Adapt blog posts for each platform. Research hashtags.", tools: ["social-scheduling", "hashtag-research"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "Email Marketing Agent", role: "email", description: "Builds email sequences, newsletters, and lead magnets.", instructions: "Create high-converting email sequences. Use 2:1 education-to-sales ratio. Build lead magnets.", tools: ["email-automation", "lead-magnet"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "Analytics Agent", role: "analytics", description: "Tracks KPIs: traffic, revenue, conversions, rankings, ROI.", instructions: "Monitor all KPIs daily. Alert on anomalies. Provide weekly performance reports.", tools: ["analytics", "reporting"], status: "idle", tasks_completed: 0, performance_score: 0 },
  { name: "Affiliate Sales Agent", role: "sales", description: "Finds affiliate programs, optimizes placements, tracks conversions.", instructions: "Find highest-commission affiliate programs. Optimize link placement. Track ROI per program.", tools: ["affiliate-finder", "conversion-tracking"], status: "idle", tasks_completed: 0, performance_score: 0 },
];

let agents: Agent[] = [];
let tasks: Task[] = [];
let initialized = false;

function init() {
  if (initialized) return;
  const now = new Date().toISOString();
  agents = DEFAULT_AGENTS.map((a, i) => ({
    ...a,
    id: `agent-${i + 1}`,
    created_at: now,
    last_run: null,
  }));
  initialized = true;
}

// --- Public API ---
export function getAgents(): Agent[] {
  init();
  return agents;
}

export function getAgent(id: string): Agent | undefined {
  init();
  return agents.find((a) => a.id === id);
}

export function getTasks(agentId?: string): Task[] {
  init();
  if (agentId) return tasks.filter((t) => t.agent_id === agentId);
  return tasks;
}

export function addTask(agentId: string, title: string, description?: string): Task {
  init();
  const task: Task = {
    id: `task-${tasks.length + 1}`,
    agent_id: agentId,
    title,
    description: description ?? null as unknown as string,
    status: "pending",
    priority: 0,
    result: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
}

const DB_URL = "postgresql://neondb_owner:npg_kc5JPHY8FVSI@ep-shy-night-axrtgbvl-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

export function hasDatabase(): boolean {
  return true;
}

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  _sql = neon(DB_URL);
  return _sql;
}
