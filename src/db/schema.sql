-- AI Agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  tools TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'idle',
  tasks_completed INTEGER DEFAULT 0,
  performance_score REAL DEFAULT 0.0,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id),
  niche_id UUID REFERENCES niche_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Niche Profiles (what user set up)
CREATE TABLE IF NOT EXISTS niche_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT,
  target_audience TEXT,
  country TEXT,
  language TEXT DEFAULT 'en',
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Activity Log
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Articles (content produced by AI Writer)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID REFERENCES niche_profiles(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  seo_keywords TEXT[] DEFAULT '{}',
  meta_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(niche_id, slug)
);

-- Media Assets (agent output gallery: images, videos, social posts, messages)
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id),
  niche_id UUID REFERENCES niche_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'social_post', 'message', 'article')),
  title TEXT,
  content TEXT,
  url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monetization Engine: Affiliate Programs
CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  network TEXT,
  commission_rate NUMERIC(5,2),
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monetization Engine: Affiliate Links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  program_id UUID REFERENCES affiliate_programs(id),
  niche_id UUID REFERENCES niche_profiles(id),
  tracking_code TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monetization Engine: Ad Slots (AdSense / direct ad placements)
CREATE TABLE IF NOT EXISTS ad_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  page_location TEXT,
  format TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Social Media Automation: connected accounts
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Social Media Automation: posts across platforms
CREATE TABLE IF NOT EXISTS social_posts (
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
);

-- Monetization Engine: Revenue Log
CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('affiliate', 'ads', 'product', 'leadgen')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  entry_date DATE DEFAULT CURRENT_DATE,
  niche_id UUID REFERENCES niche_profiles(id),
  link_id UUID REFERENCES affiliate_links(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email Marketing Module: Mailing lists / groups (scoped to a niche when useful)
CREATE TABLE IF NOT EXISTS email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (niche_id, name)
);

-- Email Marketing Module: Subscribers (plain opt-in only; email lowercased, unique)
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  status TEXT DEFAULT 'unconfirmed'
    CHECK (status IN ('subscribed', 'unconfirmed', 'unsubscribed', 'bounced', 'complained')),
  source TEXT DEFAULT 'manual',               -- manual | form | import | lead_magnet
  consent_source TEXT,                        -- where the person explicitly opted in
  consent_at TIMESTAMPTZ,
  unsubscribe_token TEXT UNIQUE,              -- one-click unsubscribe (future)
  niche_id UUID REFERENCES niche_profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email Marketing Module: Subscriber <-> list membership
CREATE TABLE IF NOT EXISTS subscriber_lists (
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  PRIMARY KEY (subscriber_id, list_id)
);

-- Email Marketing Module: Reusable content templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  preheader TEXT,
  body_html TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email Marketing Module: Sequences (welcome / lead-magnet / manual automation)
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_id UUID REFERENCES niche_profiles(id),
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('welcome', 'lead_magnet', 'manual')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email Marketing Module: A step within a sequence (order + delay + message)
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  delay_days INTEGER NOT NULL DEFAULT 0,       -- days after the previous step fires
  subject TEXT,
  template_id UUID REFERENCES email_templates(id),
  body_html TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sequence_id, position)
);

-- Email Marketing Module: One-off campaigns / newsletters
CREATE TABLE IF NOT EXISTS email_campaigns (
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
);

-- Email Marketing Module: Send outbox + per-subscriber tracking placeholders.
-- NOOP sender inserts rows (status 'pending') so the queue is ready for the real
-- provider adapter; opens/clicks are counters a future tracking pixel will bump.
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  type TEXT DEFAULT 'campaign' CHECK (type IN ('campaign', 'sequence')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'bounced')),
  provider_message_id TEXT,                   -- set by real sender when plugged in
  subject TEXT,
  opens INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subscriber_id, sequence_step_id)    -- no double-send within a sequence
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status       ON subscribers (status);
CREATE INDEX IF NOT EXISTS idx_subscriber_lists_list    ON subscriber_lists (list_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_subscriber   ON email_sends (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign     ON email_sends (campaign_id);
