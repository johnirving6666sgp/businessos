-- BusinessOS v2.0 - 数据修复迁移
-- 修复 seed-demo-data.mjs 中的数据不一致问题
-- 用法：npx wrangler d1 execute business-os-db --remote --file=migrations/0004_fix_data.sql

-- 1. 修复商机 status：将旧的 'active' 统一改为 'verified'
UPDATE opportunities SET status = 'verified' WHERE status = 'active';

-- 2. 修复商机 fetch_quality：将整数值转为标准文本
UPDATE opportunities SET fetch_quality = 'full'    WHERE CAST(fetch_quality AS INTEGER) >= 80;
UPDATE opportunities SET fetch_quality = 'partial'  WHERE CAST(fetch_quality AS INTEGER) < 80 AND CAST(fetch_quality AS INTEGER) > 0;

-- 3. 修复客户 last_interaction_at：根据 customer_interactions 中最近记录回填
UPDATE customers
SET last_interaction_at = (
  SELECT MAX(created_at) FROM customer_interactions WHERE customer_id = customers.id
)
WHERE id IN (SELECT DISTINCT customer_id FROM customer_interactions)
  AND last_interaction_at IS NULL;

-- 4. 保险：确认 init.sql 里的示例商机也是 verified
UPDATE opportunities SET status = 'verified'
WHERE id IN ('opp_demo_1') AND status = 'pending';
-- opp_demo_2 和 opp_demo_3 保持 'pending' 状态作为新线索示例

SELECT 'Migration 0004 applied successfully' as result;
