import { createServerFn } from "@tanstack/react-start";
import { getSql } from "~/db";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_AGENTS = [
  {
    name: "Chief AI Marketing Officer",
    role: "ceo",
    description: "Orchestrates the entire AI marketing department. Assigns tasks, monitors performance, and ensures all agents work together toward revenue goals.",
    instructions: "Coordinate all AI agents. Review reports, assign tasks based on niche strategy, approve content calendars, and optimize the overall marketing funnel.",
  },
  {
    name: "SEO Research Agent",
    role: "seo",
    description: "Performs keyword research, SERP analysis, and identifies content opportunities with high traffic potential and low competition.",
    instructions: "Find high-volume, low-competition keywords. Analyze SERP features, identify content gaps, and provide topic clusters with search intent analysis.",
  },
  {
    name: "AI Writer Agent",
    role: "writer",
    description: "Creates high-quality, SEO-optimized content including blog posts, articles, product reviews, and landing pages.",
    instructions: "Write engaging, factual, and SEO-optimized content. Follow the content brief, include relevant keywords naturally, and maintain a consistent brand voice.",
  },
  {
    name: "Content Strategist",
    role: "strategist",
    description: "Builds and manages content calendars, plans topic clusters, and ensures consistent publishing cadence aligned with business goals.",
    instructions: "Create 30-90 day content calendars. Plan topic clusters, balance content types, schedule publishing, and align content with monetization goals.",
  },
  {
    name: "Social Media Agent",
    role: "social",
    description: "Creates and schedules social media posts, engages with followers, and grows audience across platforms.",
    instructions: "Create platform-optimized social posts. Schedule content, write engaging captions, include relevant hashtags, and repurpose blog content for social.",
  },
  {
    name: "Email Marketing Agent",
    role: "email",
    description: "Builds email sequences, newsletters, and automated campaigns to nurture leads and drive conversions.",
    instructions: "Create welcome sequences, nurture campaigns, and promotional emails. Write compelling subject lines, segment audiences, and optimize for deliverability and conversions.",
  },
  {
    name: "Analytics Agent",
    role: "analytics",
    description: "Tracks KPIs, monitors traffic, revenue, and agent performance. Generates reports and insights for optimization.",
    instructions: "Monitor traffic, revenue, conversion rates, and content performance. Generate daily/weekly reports, identify trends, and recommend optimizations.",
  },
  {
    name: "Affiliate Sales Agent",
    role: "sales",
    description: "Identifies affiliate opportunities, manages product links, optimizes for conversions, and maximizes revenue per visitor.",
    instructions: "Find high-commission affiliate programs. Place affiliate links strategically in content, track conversions, A/B test placements, and optimize for RPM.",
  },
];

/**
 * Runs the database schema migration. Safe to call multiple times — uses IF NOT EXISTS.
 * Also runs additive migrations (ALTER TABLE ADD COLUMN IF NOT EXISTS) for new columns.
 */
export const runMigrations = createServerFn().handler(async () => {
  const sql = getSql();
  const schemaPath = join(process.cwd(), "src", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  await sql.unsafe(schema);

  // Additive migrations for columns added after initial deploy
  await sql.unsafe(`ALTER TABLE niche_profiles ADD COLUMN IF NOT EXISTS slug TEXT`);
  await sql.unsafe(`ALTER TABLE niche_profiles ADD CONSTRAINT IF NOT EXISTS niche_profiles_slug_unique UNIQUE (slug)`);
  await sql.unsafe(`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES niche_profiles(id)`);

  return { success: true, message: "Migrations applied" };
});

/**
 * Seeds the default AI agent team if the agents table is empty.
 * Call this after running migrations.
 */
export const seedDefaultAgents = createServerFn().handler(async () => {
  const sql = getSql();

  // Check if agents already exist
  const existing = await sql`SELECT count(*) as cnt FROM ai_agents`;
  if (Number(existing[0].cnt) > 0) {
    return { success: true, message: "Agents already seeded", count: Number(existing[0].cnt) };
  }

  // Insert all default agents
  for (const agent of DEFAULT_AGENTS) {
    await sql`
      INSERT INTO ai_agents (name, role, description, instructions)
      VALUES (${agent.name}, ${agent.role}, ${agent.description}, ${agent.instructions})
    `;
  }

  return { success: true, message: `Seeded ${DEFAULT_AGENTS.length} default agents`, count: DEFAULT_AGENTS.length };
});

/**
 * Initialize the database: run migrations then seed default agents.
 * Call this once on app startup or from the dashboard.
 */
export const initializeDatabase = createServerFn().handler(async () => {
  const sql = getSql();
  
  // Run schema
  const schemaPath = join(process.cwd(), "src", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  await sql.unsafe(schema);

  // Additive migrations
  await sql.unsafe(`ALTER TABLE niche_profiles ADD COLUMN IF NOT EXISTS slug TEXT`);
  await sql.unsafe(`DO $$ BEGIN ALTER TABLE niche_profiles ADD CONSTRAINT niche_profiles_slug_unique UNIQUE (slug); EXCEPTION WHEN duplicate_table THEN NULL; END $$`);
  await sql.unsafe(`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES niche_profiles(id)`);

  // Seed agents
  const existing = await sql`SELECT count(*) as cnt FROM ai_agents`;
  if (Number(existing[0].cnt) === 0) {
    for (const agent of DEFAULT_AGENTS) {
      await sql`
        INSERT INTO ai_agents (name, role, description, instructions)
        VALUES (${agent.name}, ${agent.role}, ${agent.description}, ${agent.instructions})
      `;
    }
  }

  const agentCount = await sql`SELECT count(*) as cnt FROM ai_agents`;
  return { 
    success: true, 
    message: "Database initialized", 
    agentCount: Number(agentCount[0].cnt) 
  };
});
