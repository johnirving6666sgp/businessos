-- 为 opportunities 表补充爬虫相关字段
-- 注意：source_url / budget / deadline / crawled_at 已在 0001_init.sql 中定义，
--      此处只添加 0001 中不存在的列，否则会因 "duplicate column name" 而整体失败。
--      institution / equipment_type / specs / contact / summary 等也已被 0001 的
--      规范列（org_name / contact_info / raw_content）覆盖，不再单独建列。

ALTER TABLE opportunities ADD COLUMN source TEXT DEFAULT 'manual';   -- 来源：manual | crawler | import
ALTER TABLE opportunities ADD COLUMN relevance_score INTEGER;        -- 爬虫提取的相关度 0-100

-- 加速来源筛选
CREATE INDEX IF NOT EXISTS idx_opp_source ON opportunities(source);
