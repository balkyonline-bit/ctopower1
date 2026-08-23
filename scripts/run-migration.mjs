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

// Social Media Automation tables (also in src/db/schema.sql; duplicated here so the
// pg wire-protocol runner creates them even if schema.sql application ever changes)
await client.query(`CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID REFERENCES niche_profiles(id),
  account_id UUID REFERENCES social_accounts(id),
  platform TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  link TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
)`);

// Monetization Engine tables (also in src/db/schema.sql; duplicated here so the
// pg wire-protocol runner creates them even if schema.sql application ever changes)
await client.query(`CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  network TEXT,
  commission_rate NUMERIC(5,2),
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  program_id UUID REFERENCES affiliate_programs(id),
  niche_id UUID REFERENCES niche_profiles(id),
  tracking_code TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS ad_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  page_location TEXT,
  format TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('affiliate', 'ads', 'product', 'leadgen')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  entry_date DATE DEFAULT CURRENT_DATE,
  niche_id UUID REFERENCES niche_profiles(id),
  link_id UUID REFERENCES affiliate_links(id),
  created_at TIMESTAMPTZ DEFAULT now()
)`);

const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
console.log("Tables:", tables.rows.map((t) => t.table_name).join(", "));

const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'articles' ORDER BY ordinal_position`);
console.log("articles columns:", cols.rows.map((c) => c.column_name).join(", "));

await client.end();
console.log("Migration complete.");
