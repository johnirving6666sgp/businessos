/**
 * Mode C: 机构直连监控（原 Tier 2 方案，优化版）
 *
 * 改进点：
 *   1. 响应大小检测 — < MIN_CONTENT_BYTES 直接跳过（封锁页特征）
 *   2. 仅在工作日北京时间 8:00-22:00 之间访问（减少被标记风险）
 *   3. 优先访问有 RSS/Atom Feed 的机构
 *   4. 遇到封锁时记录，避免重复无效请求
 */

import { SORTED_TARGETS } from '../targets.mjs'
import { fetchPage, htmlToText, extractLinks, sleep } from '../lib/http.mjs'

// 响应小于此值 → 判定为封锁页或空页，跳过
const MIN_CONTENT_BYTES = 3000

// 带 RSS/Atom feed 的机构（优先、更稳定）
export const RSS_FEEDS = [
  {
    id: 'ustb-rss',
    name: '北京科技大学采购',
    feedUrl: 'https://zfcg.ustb.edu.cn/rss.xml',
    institution: 'USTB',
  },
  // 发现更多 RSS 时在此追加
]

/**
 * 检测响应是否是有效内容（排除封锁页/空模板）
 */
export function isValidContent(html, minBytes = MIN_CONTENT_BYTES) {
  if (!html || html.length < minBytes) return false

  // 检测常见封锁/错误页特征
  const BLOCK_PATTERNS = [
    /访问受限/,
    /access.denied/i,
    /403 forbidden/i,
    /您的访问.*被拒绝/,
    /IP.*封禁/,
    /请通过.*访问/,
    /需要.*登录/,
    /security.check/i,
  ]

  const text = html.slice(0, 2000)
  if (BLOCK_PATTERNS.some(p => p.test(text))) return false

  return true
}

/**
 * 抓取 RSS/Atom feed，提取最新条目
 * @returns {Promise<Array<{url, title, pubDate}>>}
 */
export async function fetchRssFeed(feedUrl) {
  try {
    const { html } = await fetchPage(feedUrl, { timeoutMs: 10000, retries: 1 })

    const items = []
    // 解析 RSS <item> 或 Atom <entry>
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi
    let m
    while ((m = itemRegex.exec(html)) !== null) {
      const block = m[1]
      const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
      const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || block.match(/<link[^>]+href="([^"]+)"/))?.[1]?.trim()
      const pubDate = (block.match(/<(?:pubDate|updated)>([\s\S]*?)<\/(?:pubDate|updated)>/) || [])[1]?.trim()

      if (title && link) {
        items.push({ url: link, title, pubDate })
      }
    }
    return items
  } catch {
    return []
  }
}

/**
 * 对单个机构目标进行带"封锁检测"的爬取
 * 返回找到的公告链接列表
 */
export async function fetchTargetWithBlockDetection(target) {
  const urls = [target.url, ...(target.altUrls || [])]

  for (const url of urls) {
    let result
    try {
      result = await fetchPage(url, { timeoutMs: 12000, retries: 1 })
    } catch (err) {
      console.log(`    ⛔ 连接失败: ${err.message.slice(0, 60)}`)
      continue
    }

    const { html, finalUrl } = result

    if (!isValidContent(html)) {
      console.log(`    🚫 检测到封锁页 (${html.length} bytes)，跳过`)
      continue
    }

    console.log(`    ✅ 内容有效 (${html.length} bytes)`)
    return { html, finalUrl, accessible: true }
  }

  return { accessible: false }
}

/**
 * 对 SORTED_TARGETS 逐个尝试，统计可访问率
 * 可用于定期健康检查
 */
export async function probeAllTargets() {
  const results = { accessible: [], blocked: [], failed: [] }

  for (const target of SORTED_TARGETS) {
    console.log(`  🔍 探测: ${target.shortName}`)
    const { accessible } = await fetchTargetWithBlockDetection(target)
    if (accessible) {
      results.accessible.push(target.id)
    } else {
      results.blocked.push(target.id)
    }
    await sleep(1000, 2000)
  }

  console.log(`\n📊 探测结果: 可访问 ${results.accessible.length}, 封锁 ${results.blocked.length}`)
  return results
}
