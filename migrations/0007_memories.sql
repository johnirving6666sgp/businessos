-- 个人记忆档案表
CREATE TABLE IF NOT EXISTS memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL DEFAULT 'note',
    -- 'conversation' 对话归档
    -- 'activity'     系统活动（阶段变更、线索更新等）
    -- 'note'         手动笔记
    -- 'pull_to_chat' 拉进对话记录
  title       TEXT NOT NULL,
  content     TEXT,                    -- 正文 / AI 摘要
  entity_type TEXT,                    -- 关联实体类型：opportunity / customer / proposal
  entity_id   TEXT,                    -- 关联实体 ID
  entity_name TEXT,                    -- 关联实体名称（冗余，避免 JOIN）
  conv_id     TEXT REFERENCES conversations(id),
  tags        TEXT DEFAULT '[]',       -- JSON 数组
  is_pinned   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mem_user   ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_type   ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_mem_entity ON memories(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mem_conv   ON memories(conv_id);

-- 初始演示数据
INSERT INTO memories (user_id, type, title, content, entity_type, entity_name, is_pinned) VALUES
(1, 'note', '真空熔炼炉核心卖点整理', '客户最关心的三点：1) 温度均匀性(±5℃) 2) 真空度(≤0.1Pa) 3) 本土化售后响应时间。相比德国/日本设备，价格优势40%，交货期短3个月。', null, null, 1),
(1, 'activity', '中科院金属研究所线索进入"有意向"阶段', '李工确认预算200万，Q3采购计划，需要VIM-100规格方案。', 'opportunity', '中科院金属研究所-VIM采购', 0),
(1, 'activity', '将北航材料院线索拉入对话', '就技术参数进行深度讨论，输出了定向凝固炉方案初稿。', 'opportunity', '北航材料院-定向凝固炉', 0),
(1, 'note', '竞争对手分析：德国ALD vs 我司', 'ALD优势：品牌/技术积累。劣势：价格高60%、交货18个月、本地服务响应慢。我司切入点：性价比+快速响应+本地化定制。', null, null, 0);
