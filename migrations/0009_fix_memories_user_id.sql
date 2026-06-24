-- 0009: 将 memories.user_id 规范为 TEXT（与 users.id 对齐）
-- 背景：0007 已把列定义改成 TEXT，但远程库中 memories 表可能是更早以
--       INTEGER 创建的；CREATE TABLE IF NOT EXISTS 不会改动既有表的列类型。
--       SQLite 无法直接 ALTER 列类型，需重建表并完整保留数据。
-- 通过 _migrations 追踪保证只执行一次；重建对小表低风险。

DROP TABLE IF EXISTS memories_v2;

CREATE TABLE memories_v2 (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL DEFAULT 'note',
  title       TEXT NOT NULL,
  content     TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  entity_name TEXT,
  conv_id     TEXT REFERENCES conversations(id),
  tags        TEXT DEFAULT '[]',
  is_pinned   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

INSERT INTO memories_v2 (id, user_id, type, title, content, entity_type, entity_id, entity_name, conv_id, tags, is_pinned, created_at, updated_at)
SELECT id, CAST(user_id AS TEXT), type, title, content, entity_type, entity_id, entity_name, conv_id, tags, is_pinned, created_at, updated_at
FROM memories;

DROP TABLE memories;
ALTER TABLE memories_v2 RENAME TO memories;

CREATE INDEX IF NOT EXISTS idx_mem_user   ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_type   ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_mem_entity ON memories(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mem_conv   ON memories(conv_id);
