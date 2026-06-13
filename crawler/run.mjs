#!/usr/bin/env node
/**
 * BusinessOS 爬虫主程序
 *
 * 运行方式：
 *   ANTHROPIC_API_KEY=sk-... CRAWLER_KEY=secret API_BASE=https://businessos.giantmedal.com node crawler/run.mjs
 *
 * 环境变量：
 *   ANTHROPIC_API_KEY  - Anthropic API 密钥（用于 Claude Haiku 提取）
 *   CRAWLER_KEY        - 与 worker CRAWLER_SECRET 一致的密钥
 *   API_BASE           - BusinessOS 部署地址，默认 https://businessos.giantmedal.com
 *   DRY_RUN            - 设为 "true" 时只打印结果，不推送到服务器
 *   MAX_TARGETS        - 最多处理几个目标，默认全部
 */

import { SORTED_TARGETS } from './targets.mjs'
import { fetchPage, htmlToText, extractLinks, sleep } from './lib/http.mjs'
import { detectPageType, filterProcurementLinks, extractWithClaude, mapToOpportunity } from './lib/extract.mjs'
import { pushOpportunity, checkUrlExists } from './lib/push.mjs'
import { loadState, saveState, isSeen, markSeen, updateStats, printStats } from './lib/state.mjs'

// ── 环境变量 ──────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CRAWLER_KEY   = process.env.CRAWLER_KEY
const API_BASE      = process.env.API_BASE || 'https://businessos.giantmedal.com'
const DRY_RUN       = process.env.DRY_RUN === 'true'
const MAX_TARGETS   = parseInt(process.env.MAX_TARGETS || '999')

if (!ANTHROPIC_KEY) {
  console.error('❌ 缺少 ANTHROPIC_API_KEY 环境变量')
  process.exit(1)
}
if (!CRAWLER_KEY && !DRY_RUN) {
  console.error('❌ 缺少 CRAWLER_KEY 环境变量（或设置 DRY_RUN=true）')
  process.exit(1)
}

// ── 主流程 ────────────────────────────────────────────────────
async function main() {
  console.log(`🕷️  BusinessOS 爬虫启动 ${new Date().toLocaleString('zh-CN')}`)
  console.log(`   目标: ${API_BASE}`)
  console.log(`   模式: ${DRY_RUN ? '模拟运行（不推送）' : '正式推送'}`)
  console.log(`   总目标机构: ${SORTED_TARGETS.length}`)
  console.log('')

  const state = loadState()
  // 每次运行重置本次计数
  state.stats = { ...state.stats, total: 0, pushed: 0, skipped: 0, errors: 0 }

  const targets = SORTED_TARGETS.slice(0, MAX_TARGETS)

  for (const target of targets) {
    console.log(`\n🏛️  [${target.priority.toUpperCase()}] ${target.name} (${target.shortName})`)
    console.log(`   URL: ${target.url}`)

    try {
      await processTarget(target, state)
    } catch (err) {
      console.error(`   ❌ 处理失败: ${err.message}`)
      updateStats(state, 'errors')
    }

    // 机构间随机间隔，避免被封
    await sleep(3000, 8000)
    saveState(state)
  }

  printStats(state)
  saveState(state)
  console.log('\n✅ 爬虫运行完成')
}

/**
 * 处理单个目标机构
 */
async function processTarget(target, state) {
  const urlsToCheck = [target.url, ...(target.altUrls || [])]

  for (const url of urlsToCheck) {
    updateStats(state, 'total')

    // 检查 URL 是否已处理（本地+远程双重检查）
    if (isSeen(state, url)) {
      console.log(`   ⏭️  已处理过: ${url}`)
      updateStats(state, 'skipped')
      continue
    }

    // 获取页面
    let result
    try {
      result = await fetchPage(url)
    } catch (err) {
      console.warn(`   ⚠️  抓取失败: ${url} — ${err.message}`)
      updateStats(state, 'errors')
      continue
    }

    const { html, finalUrl } = result
    const pageType = detectPageType(html, finalUrl)

    console.log(`   📄 获取成功 (${html.length} bytes, 列表页: ${pageType.isList})`)

    if (!pageType.hasContent) {
      console.log(`   ⏭️  页面无相关内容，跳过`)
      markSeen(state, url)
      updateStats(state, 'skipped')
      continue
    }

    if (pageType.isList) {
      // 列表页：提取链接，逐个处理子页面
      const allLinks = extractLinks(html, finalUrl)
      const procLinks = filterProcurementLinks(allLinks, target.keywords)

      console.log(`   🔗 找到 ${procLinks.length} 条相关链接`)

      for (const link of procLinks) {
        if (isSeen(state, link.href)) {
          updateStats(state, 'skipped')
          continue
        }

        await sleep(1500, 4000)
        await processDetailPage(link.href, link.text, target, state)
        markSeen(state, link.href)
        saveState(state)
      }

      markSeen(state, url)
    } else {
      // 详情页：直接提取
      await processDetailPage(finalUrl, '', target, state)
      markSeen(state, url)
    }
  }
}

/**
 * 处理详情页：AI 提取 + 推送
 */
async function processDetailPage(url, linkText, target, state) {
  updateStats(state, 'total')

  // 先检查远程是否已存在
  if (!DRY_RUN && await checkUrlExists(url, API_BASE, CRAWLER_KEY)) {
    console.log(`   ⏭️  远程已存在: ${url.slice(0, 60)}`)
    updateStats(state, 'skipped')
    return
  }

  let html, finalUrl
  try {
    ;({ html, finalUrl } = await fetchPage(url))
  } catch (err) {
    console.warn(`   ⚠️  详情抓取失败: ${url.slice(0, 60)} — ${err.message}`)
    updateStats(state, 'errors')
    return
  }

  const text = htmlToText(html)
  if (text.length < 100) {
    updateStats(state, 'skipped')
    return
  }

  // Claude Haiku 提取
  console.log(`   🤖 AI 分析: ${linkText.slice(0, 50) || url.slice(0, 50)}`)
  const extracted = await extractWithClaude(text, finalUrl, ANTHROPIC_KEY)

  if (!extracted) {
    console.log(`   ⏭️  不相关，跳过`)
    updateStats(state, 'skipped')
    return
  }

  const opportunity = mapToOpportunity(extracted, finalUrl, target.name)
  console.log(`   ✨ 发现线索: ${opportunity.title} | 相关度: ${extracted.relevance_score}`)

  if (DRY_RUN) {
    console.log(`   [模拟] 将推送:`, JSON.stringify(opportunity, null, 4))
    updateStats(state, 'pushed')
    return
  }

  // 推送到 API
  const pushResult = await pushOpportunity(opportunity, API_BASE, CRAWLER_KEY)
  if (pushResult.ok) {
    console.log(`   ✅ 推送成功，ID: ${pushResult.id}`)
    updateStats(state, 'pushed')
  } else {
    console.error(`   ❌ 推送失败: ${pushResult.error}`)
    updateStats(state, 'errors')
  }
}

main().catch(err => {
  console.error('爬虫致命错误:', err)
  process.exit(1)
})
