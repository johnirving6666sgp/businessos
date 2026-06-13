-- 为 opportunities 表添加爬虫相关字段
-- D1 不支持 ADD COLUMN IF NOT EXISTS，用 IGNORE 代替

ALTER TABLE opportunities ADD COLUMN institution TEXT;
ALTER TABLE opportunities ADD COLUMN source_url TEXT UNIQUE;
ALTER TABLE opportunities ADD COLUMN budget TEXT;
ALTER TABLE opportunities ADD COLUMN deadline TEXT;
ALTER TABLE opportunities ADD COLUMN equipment_type TEXT;
ALTER TABLE opportunities ADD COLUMN specs TEXT;
ALTER TABLE opportunities ADD COLUMN contact TEXT;
ALTER TABLE opportunities ADD COLUMN summary TEXT;
ALTER TABLE opportunities ADD COLUMN relevance_score INTEGER DEFAULT 50;
ALTER TABLE opportunities ADD COLUMN crawled_at TEXT;
ALTER TABLE opportunities ADD COLUMN source TEXT DEFAULT 'manual';

-- 为 source_url 建索引，加速去重查询
CREATE INDEX IF NOT EXISTS idx_opp_source_url ON opportunities(source_url);
CREATE INDEX IF NOT EXISTS idx_opp_source ON opportunities(source);
CREATE INDEX IF NOT EXISTS idx_opp_crawled_at ON opportunities(crawled_at);
