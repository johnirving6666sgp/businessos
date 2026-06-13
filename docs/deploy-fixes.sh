#!/bin/bash
# BusinessOS 修复部署脚本
# 在 Terminal 里执行：bash docs/deploy-fixes.sh

set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: 清理 git lock 并提交修复 ==="
rm -f .git/index.lock
git add worker/lib/agent.mjs worker/routes/customers.mjs scripts/seed-demo-data.mjs migrations/0004_fix_data.sql
git commit -m "fix: 7 bugs from static analysis

- agent.mjs: add permissions check (Gu can't see customer data)
- agent.mjs: fix opportunity status='active' -> NOT IN (dismissed,merged)
- agent.mjs: wrap all DB queries with try-catch (D1 timeout safety)
- customers.mjs: replace NULLS LAST with CASE (SQLite compat)
- seed-demo-data.mjs: status 'active'->'verified', fetch_quality to text
- seed-demo-data.mjs: update last_interaction_at after inserting interactions
- migrations/0004_fix_data.sql: NEW - fix existing D1 data"

echo ""
echo "=== Step 2: 修复远程 D1 数据 ==="
npx wrangler d1 execute business-os-db --remote --file=migrations/0004_fix_data.sql

echo ""
echo "=== Step 3: 推送并自动部署 ==="
git push origin main

echo ""
echo "✅ 完成！GitHub Actions 将在约 2 分钟内完成构建和部署。"
echo "   部署地址：https://giantmedal.com"
