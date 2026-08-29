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

// Email Marketing Module tables (also in src/db/schema.sql; duplicated here so the
// pg wire-protocol runner creates them even if schema.sql application ever changes)
await client.query(`CREATE TABLE IF NOT EXISTS email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (niche_id, name)
)`);
await client.query(`CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  status TEXT DEFAULT 'unconfirmed'
    CHECK (status IN ('subscribed', 'unconfirmed', 'unsubscribed', 'bounced', 'complained')),
  source TEXT DEFAULT 'manual',
  consent_source TEXT,
  consent_at TIMESTAMPTZ,
  unsubscribe_token TEXT UNIQUE,
  niche_id UUID REFERENCES niche_profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS subscriber_lists (
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  PRIMARY KEY (subscriber_id, list_id)
)`);
await client.query(`CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  preheader TEXT,
  body_html TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('welcome', 'lead_magnet', 'manual')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject TEXT,
  template_id UUID REFERENCES email_templates(id),
  body_html TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sequence_id, position)
)`);
await client.query(`CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  list_id UUID REFERENCES email_lists(id),
  subject TEXT,
  template_id UUID REFERENCES email_templates(id),
  body_html TEXT,
  body_text TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  type TEXT DEFAULT 'campaign' CHECK (type IN ('campaign', 'sequence')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'bounced')),
  provider_message_id TEXT,
  subject TEXT,
  opens INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subscriber_id, sequence_step_id)
)`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_subscribers_status       ON subscribers (status)`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_lists_list    ON subscriber_lists (list_id)`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_email_sends_subscriber   ON email_sends (subscriber_id)`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_email_sends_campaign     ON email_sends (campaign_id)`);

const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
console.log("Tables:", tables.rows.map((t) => t.table_name).join(", "));

const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'articles' ORDER BY ordinal_position`);
console.log("articles columns:", cols.rows.map((c) => c.column_name).join(", "));

await client.end();
console.log("Migration complete.");
