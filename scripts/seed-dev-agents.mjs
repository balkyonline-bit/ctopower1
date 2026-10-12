// Seed the five software-development agents into ai_agents.
//
// Uses the `pg` wire protocol (same pattern as scripts/run-migration.mjs) because
// the neon() HTTP driver used by the app silently no-ops DDL — and we need a
// UNIQUE index on ai_agents.role for the idempotent ON CONFLICT upsert.
//
// Idempotent: re-running only refreshes the definition of the five dev roles.
// The eight pre-existing marketing agents are never touched.
//
// Run: node scripts/seed-dev-agents.mjs

import pg from "pg";

const DB_URL =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")
    ? process.env.DATABASE_URL
    : "") ||
  "postgresql://neondb_owner:npg_kc5JPHY8FVSI@ep-shy-night-axrtgbvl-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const DEV_AGENTS = [
  {
    role: "product_manager",
    name: "Product Manager",
    description:
      "Analiza korisničkih zahtjeva, strukturiranje opsega (scope), pisanje PRD-a",
    instructions:
      "You are the Product Manager. Turn a raw feature request into a written PRD: clarify the user need, fix the scope in and out, write user stories with acceptance criteria, and define measurable success metrics. Never invent user research you did not do.",
    tools: ["Web Search", "File Writer (PRD.md)"],
  },
  {
    role: "software_architect",
    name: "Software Architect",
    description:
      "Dizajn baze podataka, definiranje API ruta, kreiranje strukture mapa",
    instructions:
      "You are the Software Architect. Produce the technical design that implements the PRD: data model (tables, columns, keys, indexes), API routes with methods and payload shapes, and the folder structure of the codebase. Prefer boring, proven technology and call out trade-offs.",
    tools: ["Diagramming (Mermaid.js)", "File Reader/Writer"],
  },
  {
    role: "developer",
    name: "Developer",
    description:
      "Pisanje čistog i modularnog koda (SOLID), rješavanje algoritama",
    instructions:
      "You are the Developer. Implement the architecture as clean, modular code: name the files to create, list the functions each file exports, and show pseudocode for the non-obvious parts. Keep responsibilities separate (SOLID) and handle errors explicitly.",
    tools: ["File System Access", "Code Writer", "Terminal"],
  },
  {
    role: "qa_tester",
    name: "QA Tester",
    description:
      "Pisanje unit i integracijskih testova, pronalaženje rubnih slučajeva (edge cases)",
    instructions:
      "You are the QA Tester. Write the test plan for the implementation: unit tests with input/expected pairs, edge cases including empty, boundary and malformed input, and integration scenarios across the real dependencies. State the exact assertion for every case.",
    tools: ["Test Runners (PyTest/Jest)", "Code Reader"],
  },
  {
    role: "product_reviewer",
    name: "Product Reviewer",
    description:
      "Sigurnosna provjera (OWASP), statička analiza koda, optimizacija performansi",
    instructions:
      "You are the Product Reviewer. Review the implementation before release: work through the OWASP Top 10 checklist with concrete findings and severity, report static-analysis issues such as dead code, missing types and swallowed errors, and suggest performance improvements with the reasoning behind them. Be specific and honest — report 'no issue found' rather than inventing problems.",
    tools: ["Linters (ESLint/Flake8)", "Security Scanners"],
  },
];

const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const arr = (a) => "ARRAY[" + a.map(esc).join(", ") + "]";

const values = DEV_AGENTS.map(
  (a) =>
    `(${esc(a.name)}, ${esc(a.role)}, ${esc(a.description)}, ${esc(a.instructions)}, ${arr(a.tools)}, 'idle', 0, 1.0)`,
).join(",\n");

// One statement on purpose: node-pg re-uses the unnamed prepared statement, and
// the Neon pooler runs in transaction mode — repeating the same parameterised
// INSERT five times deadlocks against it. Distinct text (or a single statement)
// is safe.
const upsertSql = `
INSERT INTO ai_agents (name, role, description, instructions, tools, status, tasks_completed, performance_score)
VALUES
${values}
ON CONFLICT (role) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  tools = EXCLUDED.tools
RETURNING id, name, role, (xmax = 0) AS inserted
`;

/**
 * One full seed attempt against a brand-new client. The Neon pooler
 * intermittently answers with "timeout expired" while a plain inline node
 * script with connectionTimeoutMillis: 30000 gets through, so every attempt
 * gets a fresh Client (a failed Client cannot be reconnected) and a generous
 * connection timeout.
 */
async function attemptSeed() {
  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  // Without an error listener a late socket error is emitted as an uncaught
  // event and kills the process instead of surfacing as a retryable failure.
  client.on("error", () => {});
  await client.connect();
  console.log("connected");
  try {
    // Unique index on role is what makes ON CONFLICT (role) work.
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_role_unique ON ai_agents (role)`,
    );
    console.log("index ok");
    const res = await client.query(upsertSql);
    for (const r of res.rows) {
      console.log(
        `${r.inserted ? "INSERTED" : "UPDATED "} ${r.role.padEnd(18)} id=${r.id} name="${r.name}"`,
      );
    }
    const rows = await client.query(
      `SELECT id, name, role, tools, status, tasks_completed FROM ai_agents ORDER BY created_at, role`,
    );
    console.log(`\nai_agents total: ${rows.rows.length}`);
    for (const r of rows.rows) {
      console.log(
        `  ${r.role.padEnd(18)} | ${r.name.padEnd(26)} | tools=[${r.tools.join(", ")}] | status=${r.status} | done=${r.tasks_completed}`,
      );
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* connection already dead — nothing to close */
    }
  }
}

const MAX_ATTEMPTS = Number(process.env.SEED_ATTEMPTS || 5);
const BACKOFF_MS = Number(process.env.SEED_BACKOFF_MS || 4000);
let lastError;
let seeded = false;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    console.log(`--- seed attempt ${attempt}/${MAX_ATTEMPTS} ---`);
    await attemptSeed();
    seeded = true;
    break;
  } catch (err) {
    lastError = err;
    console.error(`attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err?.message || err}`);
    if (attempt < MAX_ATTEMPTS) {
      console.log(`retrying in ${BACKOFF_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS));
    }
  }
}

if (!seeded) {
  console.error(`\nFAILED after ${MAX_ATTEMPTS} attempts: ${lastError?.message || lastError}`);
  process.exit(1);
}
console.log("\nDev agent seed complete.");
