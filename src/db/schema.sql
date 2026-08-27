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
