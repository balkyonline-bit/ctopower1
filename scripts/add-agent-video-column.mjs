// Idempotent additive migration: ai_agents.video_url (tutorial video per agent).
//
// Uses the pg wire protocol (node-postgres) instead of the neon() HTTP driver —
// the HTTP driver silently no-ops DDL. Mirrors the retry pattern of
// scripts/seed-dev-agents.mjs: a fresh Client per attempt with a generous
// connection timeout, because the Neon pooler intermittently answers
// "timeout expired" and a failed Client cannot be reconnected.
import pg from "pg";

// DATABASE_URL is an https://.../sql endpoint for the neon serverless driver, which
// the pg wire protocol cannot use — only accept a real postgres:// URL from the env.
const ENV_PG = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")
  ? process.env.DATABASE_URL
  : null;
const DB_URL =
  ENV_PG ||
  "postgresql://neondb_owner:npg_kc5JPHY8FVSI@ep-shy-night-axrtgbvl-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function attempt() {
  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  client.on("error", () => {});
  await client.connect();
  try {
    await client.query(
      `ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS video_url TEXT`,
    );
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'ai_agents' AND column_name = 'video_url'`,
    );
    if (cols.rows.length === 0) throw new Error("video_url column missing after ALTER");
    console.log(`video_url column ok (${cols.rows[0].data_type})`);
    const rows = await client.query(
      `SELECT role, video_url FROM ai_agents
       WHERE role IN ('product_manager','software_architect','developer','qa_tester','product_reviewer')
       ORDER BY role`,
    );
    console.log(`ai_agents rows carrying video_url: ${String(rows.rows.length)}`);
    for (const r of rows.rows) {
      console.log(`  ${String(r.role).padEnd(18)} video_url=${r.video_url ?? "NULL"}`);
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* already dead */
    }
  }
}

const MAX_ATTEMPTS = Number(process.env.SEED_ATTEMPTS || 5);
const BACKOFF_MS = Number(process.env.SEED_BACKOFF_MS || 4000);
let lastError;
let done = false;
for (let a = 1; a <= MAX_ATTEMPTS; a++) {
  try {
    console.log(`--- migration attempt ${a}/${MAX_ATTEMPTS} ---`);
    await attempt();
    done = true;
    break;
  } catch (err) {
    lastError = err;
    console.error(`attempt ${a}/${MAX_ATTEMPTS} failed: ${err?.message || err}`);
    if (a < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, BACKOFF_MS));
  }
}
if (!done) {
  console.error(`\nFAILED after ${MAX_ATTEMPTS} attempts: ${lastError?.message || lastError}`);
  process.exit(1);
}
console.log("\nMigration complete.");
