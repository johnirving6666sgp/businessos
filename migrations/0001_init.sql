-- BusinessOS v2.0 - 完整数据库初始化
-- 执行顺序：按依赖关系排列，无外键依赖的表在前

-- ============================================================
-- 用户与权限
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',         -- super_admin | admin | member
  model_tier TEXT NOT NULL DEFAULT 'haiku',    -- opus | sonnet | haiku
  permissions TEXT NOT NULL DEFAULT '{}',      -- JSON
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- 对话与消息
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL DEFAULT 'personal', -- personal | opportunity | customer | task | proposal | knowledge
  title TEXT,
  context_level INTEGER NOT NULL DEFAULT 0,    -- 0=纯净 1=轻量 2=精准 3=完整
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                          -- user | assistant | system
  content TEXT NOT NULL,
  context_snapshot TEXT,                       -- 注入时的上下文摘要 (JSON)
  tokens_used INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS message_feedback (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                          -- useful | inaccurate | need_detail
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, user_id)
);

-- ============================================================
-- 商机线索
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_platform TEXT,                        -- ctbpsp | qianlima | manual
  source_url TEXT,
  raw_content TEXT,
  org_name TEXT,
  budget TEXT,
  deadline TEXT,
  contact_info TEXT,
  keywords TEXT,                               -- JSON array
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | verified | merged | dismissed
  merged_into TEXT REFERENCES opportunities(id),
  fetch_quality TEXT NOT NULL DEFAULT 'partial', -- partial | full
  crawled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_source_url ON opportunities(source_url);

CREATE TABLE IF NOT EXISTS opportunity_ratings (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK(score IN (0, 30, 60, 80, 100)),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(opportunity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_opportunity ON opportunity_ratings(opportunity_id);

CREATE TABLE IF NOT EXISTS opportunity_saves (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(opportunity_id, user_id)
);

-- ============================================================
-- 客户管理
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'untouched',     -- untouched | contacted | interested | quoting | closing | won | lost
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  industry TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  website TEXT,
  notes TEXT,
  source_opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  last_interaction_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id, stage);
CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(stage, updated_at DESC);

CREATE TABLE IF NOT EXISTS customer_interactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,                                   -- call | meeting | email | note | stage_change
  summary TEXT NOT NULL,
  next_action TEXT,
  next_action_due TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interactions_customer ON customer_interactions(customer_id, created_at DESC);

-- ============================================================
-- 任务
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo',         -- todo | in_progress | waiting | done | closed
  priority TEXT NOT NULL DEFAULT 'normal',     -- high | normal | low
  due_date TEXT,
  source_type TEXT,                            -- conversation | opportunity | broadcast | proposal | manual
  source_id TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  proposal_id TEXT,
  result_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, status);

-- ============================================================
-- 方案与报价
-- ============================================================

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | review | sent | won | lost
  scope TEXT,
  tech_params TEXT,                            -- JSON
  cost_breakdown TEXT,                         -- JSON
  risk_points TEXT,
  price_range_min REAL,
  price_range_max REAL,
  negotiation_space TEXT,
  open_questions TEXT,
  reference_cases TEXT,                        -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_creator ON proposals(creator_id, updated_at DESC);

-- ============================================================
-- 知识库
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,                                   -- JSON array
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'team',     -- private | team | public
  source_type TEXT,                            -- conversation | task | proposal | manual
  source_id TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_visibility ON knowledge_items(visibility, is_published, updated_at DESC);

-- ============================================================
-- 广播系统
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_ids TEXT NOT NULL,               -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_responses (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                        -- received | following_up | need_discussion
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(broadcast_id, user_id)
);

-- ============================================================
-- Agent 配置与成长
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL DEFAULT 'personal',
  system_prompt_override TEXT,
  growth_level INTEGER NOT NULL DEFAULT 0,     -- 0=初级 ... 9=五星
  growth_points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, agent_type)
);

-- ============================================================
-- 示例商机数据（演示用）
-- ============================================================

INSERT OR IGNORE INTO opportunities (id, title, source_platform, org_name, budget, deadline, raw_content, keywords, status, fetch_quality, created_at) VALUES
('opp_demo_1', '某大学真空感应熔炼设备采购项目', 'manual', '华南理工大学材料学院', '约 280 万元', '2026-07-15', '采购真空感应熔炼炉一套，用于高温难熔金属及高熵合金研究。要求：最高温度不低于 2200°C，真空度优于 5×10⁻³ Pa，熔炼容量 5-10kg。', '["真空熔炼","熔炼炉","高熵合金","难熔金属"]', 'verified', 'full', datetime('now', '-2 days')),
('opp_demo_2', '某研究院冷坩埚悬浮熔炼系统招标', 'ctbpsp', '中科院某研究所', '约 150 万元', '2026-07-30', '需采购冷坩埚悬浮熔炼系统一套，用于高纯金属材料研究。详见招标文件。', '["冷坩埚","悬浮熔炼","高纯金属","靶材"]', 'pending', 'partial', datetime('now', '-1 day')),
('opp_demo_3', '新材料产业园区设备配套采购', 'qianlima', '某新材料科技园', '约 500 万元', '2026-08-20', '园区建设需配套多种金属材料加工设备，包括熔炼、轧制、热处理等，欢迎有实力的供应商参与投标。', '["新材料","熔炼","金属材料"]', 'pending', 'partial', datetime('now', '-3 hours'));
