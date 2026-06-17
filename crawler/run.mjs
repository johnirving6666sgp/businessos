#!/usr/bin/env node
/**
 * BusinessOS 爬虫主程序 — 三模式并行
 *
 * Mode A: 聚合平台 (最稳定，ccgp.gov.cn 等，境外 IP 可访问)
 * Mode B: 搜索引擎驱动 (DuckDuckGo/Bing，发现未知来源公告)
 * Mode C: 机构直连 (精准但受 IP 限制，带封锁检测自动跳过)
 *
 * 环境变量：
 *   ANTHROPIC_API_KEY  - 必填，Claude Haiku 提取
 *   CRAWLER_SECRET     - 必填（DRY_RUN=true 时可省）。兼容旧名 CRAWLER_KEY
 *   API_BASE           - 默认 https://businessos.giantmedal.com
 *   DRY_RUN            - "true" 只打印，不推送
 *   MODES              - 逗号分隔，默认 "A,B,C"，如 "A,B" 跳过直连
 *   MAX_TARGETS        - Mode C 最多处理几个机构，默认全部
 *   BING_API_KEY       - 可选，Azure Bing Search API Key
 */

import { SORTED_TARGETS } from './targets.mjs'
import { AGGREGATOR_TARGETS, extractAggregatorLinks } from './modes/aggregators.mjs'
import { runSearchMode } from './modes/search_leads.mjs'
import { fetchTargetWithBlockDetection, fetchRssFeed, RSS_FEEDS, isValidContent } from './modes/direct_monitor.mjs'
import { fetchPage, htmlToText, extractLinks, sleep } from './lib/http.mjs'
import { detectPageType, filterProcurementLinks, extractWithClaude, mapToOpportunity } from './lib/extract.mjs'
import { pushOpportunity, checkUrlExists } from './lib/push.mjs'
import { loadState, saveState, isSeen, markSeen, updateStats, printStats } from './lib/state.mjs'

// ── 配置 ──────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CRAWLER_KEY   = process.env.CRAWLER_SECRET || process.env.CRAWLER_KEY
const API_BASE      = process.env.API_BASE || 'https://businessos.giantmedal.com'
const DRY_RUN       = process.env.DRY_RUN === 'true'
const MODES         = (process.env.MODES || 'A,B,C').split(',').map(m => m.trim().toUpperCase())
const MAX_TARGETS   = parseInt(process.env.MAX_TARGETS || '999')
const BING_KEY      = process.env.BING_API_KEY || null

if (!ANTHROPIC_KEY) { console.error('❌ 缺少 ANTHROPIC_API_KEY'); process.exit(1) }
if (!CRAWLER_KEY && !DRY_RUN) { console.error('❌ 缺少 CRAWLER_SECRET（或设 DRY_RUN=true）'); process.exit(1) }

// ── 启动预检：验证 Anthropic API Key ──────────────────────────
async function validateAnthropicKey(key) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    if (res.status === 401) {
      const err = await res.json()
      console.error(`❌ ANTHROPIC_API_KEY 无效: ${err.error?.message}`)
      console.error('   请到 https://console.anthropic.com/settings/keys 获取有效 Key')
      process.exit(1)
    }
    if (res.status === 200 || res.status === 529) return // 529=过载但Key有效
    // 其他状态码（如 500）不影响 Key 有效性
  } catch (err) {
    console.warn(`⚠️  无法验证 API Key（网络问题）: ${err.message}，继续运行`)
  }
}

// ── 主流程 ────────────────────────────────────────────────────
async function main() {
  console.log(`\n🕷️  BusinessOS 爬虫 ${new Date().toLocaleString('zh-CN')}`)
  console.log(`   目标服务器: ${API_BASE}`)
  console.log(`   激活模式:   ${MODES.join(', ')}`)
  console.log(`   运行方式:   ${DRY_RUN ? '模拟（不推送）' : '正式推送'}`)

  // 预检 API Key，Key 无效时立即退出
  process.stdout.write('   验证 API Key... ')
  await validateAnthropicKey(ANTHROPIC_KEY)
  console.log('✅')

  const state = loadState()
  state.stats = { ...state.stats, total: 0, pushed: 0, skipped: 0, errors: 0 }

  // ══ Mode A: 聚合平台 ══════════════════════════════════════
  if (MODES.includes('A')) {
    console.log('\n═══ Mode A: 聚合平台爬取 ═══════════════════════')
    for (const target of AGGREGATOR_TARGETS) {
      console.log(`\n🌐 [${target.priority.toUpperCase()}] ${target.name}`)

      if (isSeen(state, target.url)) {
        console.log('   ⏭️  今日已处理，跳过')
        updateStats(state, 'skipped')
        continue
      }

      try {
        const { html, finalUrl } = await fetchPage(target.url, { timeoutMs: 20000 })
        updateStats(state, 'total')

        if (!isValidContent(html, target.minContentSize || 1000)) {
          console.log(`   🚫 无效内容 (${html.length} bytes)`)
          updateStats(state, 'errors')
          markSeen(state, target.url)
          continue
        }

        console.log(`   📄 内容获取成功 (${html.length} bytes)`)

        // 提取公告链接
        const links = target.isJson
          ? extractJsonLinks(html, target)
          : extractAggregatorLinks(html, target)

        console.log(`   🔗 找到 ${links.length} 条公告链接`)

        for (const link of links) {
          await processUrl(link.href, link.text, target.name, state)
          await sleep(1500, 3000)
          saveState(state)
        }

        markSeen(state, target.url)
      } catch (err) {
        console.error(`   ❌ ${err.message}`)
        updateStats(state, 'errors')
      }

      await sleep(3000, 6000)
      saveState(state)
    }
  }

  // ══ Mode B: 搜索引擎 ══════════════════════════════════════
  if (MODES.includes('B')) {
    console.log('\n═══ Mode B: 搜索引擎驱动 ═══════════════════════')

    const searchResults = await runSearchMode({ bingApiKey: BING_KEY })
    console.log(`\n   共找到 ${searchResults.length} 条唯一结果，开始处理...`)

    for (const result of searchResults) {
      if (isSeen(state, result.url)) {
        updateStats(state, 'skipped')
        continue
      }
      await processUrl(result.url, result.title, '搜索引擎发现', state)
      await sleep(2000, 4000)
      saveState(state)
    }
  }

  // ══ Mode C: 机构直连（带封锁检测）═══════════════════════
  if (MODES.includes('C')) {
    console.log('\n═══ Mode C: 机构直连监控 ═══════════════════════')

    // C1: RSS Feeds（最稳定的直连方式）
    for (const feed of RSS_FEEDS) {
      console.log(`\n📡 RSS: ${feed.name}`)
      const items = await fetchRssFeed(feed.feedUrl)
      console.log(`   获取 ${items.length} 条 RSS 条目`)
      for (const item of items) {
        if (!isSeen(state, item.url)) {
          await processUrl(item.url, item.title, feed.institution, state)
          await sleep(1000, 2000)
        }
      }
    }

    // C2: 机构官网直连（封锁检测）
    const targets = SORTED_TARGETS.slice(0, MAX_TARGETS)
    let accessible = 0
    let blocked = 0

    for (const target of targets) {
      console.log(`\n🏛️  [${target.priority.toUpperCase()}] ${target.name}`)

      const { html, finalUrl, accessible: ok } = await fetchTargetWithBlockDetection(target)

      if (!ok) {
        blocked++
        updateStats(state, 'errors')
        await sleep(1000, 2000)
        continue
      }

      accessible++
      updateStats(state, 'total')

      // 提取链接
      const allLinks = extractLinks(html, finalUrl)
      const procLinks = filterProcurementLinks(allLinks, target.keywords)
      console.log(`   🔗 找到 ${procLinks.length} 条相关链接`)

      for (const link of procLinks) {
        if (!isSeen(state, link.href)) {
          await sleep(1500, 3000)
          await processUrl(link.href, link.text, target.name, state)
          markSeen(state, link.href)
          saveState(state)
        }
      }

      markSeen(state, target.url)
      await sleep(3000, 8000)
      saveState(state)
    }

    console.log(`\n   机构直连结果: 可访问 ${accessible}/${targets.length}，封锁 ${blocked}`)
    if (blocked > targets.length * 0.7) {
      console.log('   ⚠️  超过70%机构被封，建议主要依赖 Mode A+B')
    }
  }

  // ══ 完成 ══════════════════════════════════════════════════
  printStats(state)
  saveState(state)
  console.log('\n✅ 爬虫运行完成\n')
}

/**
 * 处理单个 URL：AI 提取 → 推送
 */
async function processUrl(url, linkText, sourceName, state) {
  updateStats(state, 'total')

  if (isSeen(state, url)) {
    updateStats(state, 'skipped')
    return
  }

  // 远程去重检查
  if (!DRY_RUN && await checkUrlExists(url, API_BASE, CRAWLER_KEY)) {
    markSeen(state, url)
    updateStats(state, 'skipped')
    return
  }

  // 获取页面
  let html, finalUrl
  try {
    ;({ html, finalUrl } = await fetchPage(url, { timeoutMs: 15000, retries: 1 }))
  } catch (err) {
    console.warn(`   ⚠️  抓取失败: ${url.slice(0, 60)} — ${err.message}`)
    updateStats(state, 'errors')
    markSeen(state, url)
    return
  }

  if (!isValidContent(html, 500)) {
    updateStats(state, 'skipped')
    markSeen(state, url)
    return
  }

  const text = htmlToText(html)

  // AI 提取
  console.log(`   🤖 ${linkText?.slice(0, 50) || finalUrl.slice(0, 50)}`)
  const extracted = await extractWithClaude(text, finalUrl, ANTHROPIC_KEY)

  if (!extracted) {
    updateStats(state, 'skipped')
    markSeen(state, url)
    return
  }

  const opportunity = mapToOpportunity(extracted, finalUrl, sourceName)
  console.log(`   ✨ 线索: ${opportunity.title} | 相关度 ${extracted.relevance_score}`)

  if (DRY_RUN) {
    console.log(`   [模拟推送]`, JSON.stringify(opportunity, null, 2))
    updateStats(state, 'pushed')
  } else {
    const { ok, id, error } = await pushOpportunity(opportunity, API_BASE, CRAWLER_KEY)
    if (ok) {
      console.log(`   ✅ 入库 ID: ${id}`)
      updateStats(state, 'pushed')
    } else {
      console.error(`   ❌ 推送失败: ${error}`)
      updateStats(state, 'errors')
    }
  }

  markSeen(state, url)
}

/**
 * 简单的 JSON 响应链接提取（针对 API 接口型聚合平台）
 */
function extractJsonLinks(text, target) {
  try {
    const data = JSON.parse(text)
    const items = data?.data?.list || data?.result || data?.items || []
    return items
      .filter(item => item.url || item.link || item.href)
      .map(item => ({
        href: item.url || item.link || item.href,
        text: item.title || item.name || '',
      }))
      .slice(0, 20)
  } catch {
    return []
  }
}

main().catch(err => {
  console.error('爬虫致命错误:', err)
  process.exit(1)
})
