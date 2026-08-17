// One-off migration runner using pg (wire protocol — DDL works)
import { readFileSync } from "node:fs";
import pg from "pg";

const DB_URL = "postgresql://neondb_owner:npg_kc5JPHY8FVSI@ep-shy-night-axrtgbvl-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
console.log("Applying schema.sql...");
await client.query(schema);

console.log("Applying additive migrations...");
await client.query(`CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID REFERENCES niche_profiles(id),
  article_id UUID REFERENCES articles(id),
  type TEXT NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  title TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);
await client.query(`ALTER TABLE niche_profiles ADD COLUMN IF NOT EXISTS slug TEXT`);
await client.query(`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS niche_id UUID`);
await client.query(`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS status TEXT`);

const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
console.log("Tables:", tables.rows.map((t) => t.table_name).join(", "));

const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'articles' ORDER BY ordinal_position`);
console.log("articles columns:", cols.rows.map((c) => c.column_name).join(", "));

await client.end();
console.log("Migration complete.");
