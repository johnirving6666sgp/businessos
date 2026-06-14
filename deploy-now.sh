#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔧 清理 git 锁文件..."
rm -f .git/index.lock .git/HEAD.lock

echo "📦 提交所有更改..."
git add \
  worker/routes/proposals.mjs \
  worker/routes/knowledge.mjs \
  worker/routes/crawler.mjs \
  worker/index.mjs \
  src/pages/Proposals.jsx \
  src/pages/Knowledge.jsx \
  src/App.jsx \
  crawler/targets.mjs \
  crawler/run.mjs \
  crawler/lib/http.mjs \
  crawler/lib/extract.mjs \
  crawler/lib/push.mjs \
  crawler/lib/state.mjs \
  crawler/modes/aggregators.mjs \
  crawler/modes/search_leads.mjs \
  crawler/modes/direct_monitor.mjs \
  migrations/0005_seed_proposals_knowledge.sql \
  migrations/0006_crawler_columns.sql \
  .github/workflows/crawler.yml \
  wrangler.jsonc \
  package.json 2>/dev/null || true

git diff --cached --quiet && echo "⚠️  没有新变更" || git commit -m "feat: 三模式爬虫系统 (聚合平台+搜索引擎+机构直连)"

echo "🚀 推送到 GitHub..."
git push origin main

echo ""
echo "📊 运行 D1 迁移..."
npx wrangler d1 execute business-os-db --remote --file=migrations/0005_seed_proposals_knowledge.sql 2>/dev/null || echo "  0005 已执行过"
npx wrangler d1 execute business-os-db --remote --file=migrations/0006_crawler_columns.sql 2>/dev/null || echo "  0006 已执行过"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 部署完成！"
echo ""
echo "📋 还需要设置的 Secrets:"
echo "   # Cloudflare Worker（只需设一次）："
echo "   npx wrangler secret put CRAWLER_SECRET"
echo ""
echo "   # GitHub 仓库 Settings → Secrets → Actions："
echo "   ANTHROPIC_API_KEY  = 你的 Claude API Key"
echo "   CRAWLER_SECRET     = 同 Cloudflare 的值"
echo "   BING_API_KEY       = （可选）Azure Bing Search Key"
echo ""
echo "🧪 本地测试爬虫（模拟，不推送）："
echo "   ANTHROPIC_API_KEY=sk-... DRY_RUN=true MODES=A,B node crawler/run.mjs"
