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
