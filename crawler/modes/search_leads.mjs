/**
 * Mode B: 搜索引擎驱动爬取
 *
 * 利用搜索引擎已有的索引，绕过直连 IP 封锁问题。
 * 搜到的结果直接访问原始页面详情。
 *
 * 使用方案：
 *   1. DuckDuckGo HTML (无需 API Key，不封爬虫)
 *   2. Bing Search API (Azure 免费 F1: 1000次/月，备选)
 *
 * 优势：覆盖范围广，能找到未在 targets 列表里的机构公告
 */

import { fetchPage, htmlToText, sleep } from '../lib/http.mjs'

// 搜索关键词组合
const SEARCH_QUERIES = [
  '真空熔炼炉 招标 采购公告 2026',
  '真空感应熔炼 设备采购 招标',
  '高温合金 真空冶金 采购 公告',
  '真空电弧炉 招标 公告',
  'VIM 真空感应炉 采购',
  '粉末冶金 真空烧结 招标 公告',
  '真空镀膜设备 采购 招标 2026',
  '定向凝固 真空炉 采购 公告',
]

/**
 * DuckDuckGo HTML 搜索（不需要 API Key）
 * @param {string} query
 * @returns {Promise<Array<{url: string, title: string, snippet: string}>>}
 */
export async function searchDuckDuckGo(query) {
  const encodedQuery = encodeURIComponent(query)
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=cn-zh`

  let html
  try {
    ;({ html } = await fetchPage(url, { timeoutMs: 20000, retries: 1 }))
  } catch (err) {
    console.warn(`    [DDG] 搜索失败: ${err.message}`)
    return []
  }

  return parseDDGResults(html)
}

/**
 * 解析 DuckDuckGo HTML 搜索结果
 */
function parseDDGResults(html) {
  const results = []

  // DDG HTML 结果格式：<a class="result__url" href="...">
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  const links = []
  const snippets = []

  let m
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1]
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (href.startsWith('http') && title) {
      links.push({ href, title })
    }
  }

  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
  }

  // 合并
  for (let i = 0; i < links.length; i++) {
    results.push({
      url: links[i].href,
      title: links[i].title,
      snippet: snippets[i] || '',
    })
  }

  return results.slice(0, 15)
}

/**
 * Bing Search API（Azure 免费 F1 账户）
 * @param {string} query
 * @param {string} apiKey - Bing API Key
 * @returns {Promise<Array>}
 */
export async function searchBing(query, apiKey) {
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&mkt=zh-CN&count=15&freshness=Month`

  try {
    const res = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Bing API ${res.status}`)
    const data = await res.json()
    return (data.webPages?.value || []).map(item => ({
      url: item.url,
      title: item.name,
      snippet: item.snippet,
    }))
  } catch (err) {
    console.warn(`    [Bing] 搜索失败: ${err.message}`)
    return []
  }
}

/**
 * 过滤搜索结果：只保留相关的采购公告
 */
export function filterSearchResults(results) {
  const INCLUDE_DOMAINS = [
    'gov.cn', 'ac.cn', 'edu.cn', 'com.cn',
    'ccgp.gov.cn', 'ggzy.gov.cn', 'cebpubservice.com',
    'chinabidding.com.cn', 'bilian.com', 'bidcenter.com.cn',
  ]
  const EXCLUDE_PATTERNS = [
    /baidu\.com\/link/i,   // 百度跳转链接
    /bing\.com/i,
    /google\.com/i,
    /zhihu\.com/i,
    /baike\./i,            // 百科
    /wikipedia/i,
    /weibo\.com/i,
  ]
  const REQUIRED_KEYWORDS = ['招标', '采购', '公告', '中标', '询价', '竞争性']

  return results.filter(r => {
    if (!r.url || !r.title) return false
    if (EXCLUDE_PATTERNS.some(p => p.test(r.url))) return false

    const combined = r.title + ' ' + r.snippet
    const hasKeyword = REQUIRED_KEYWORDS.some(kw => combined.includes(kw))
    if (!hasKeyword) return false

    return true
  })
}

/**
 * 执行所有搜索查询并汇总结果
 * @param {object} env - { bingApiKey?: string }
 * @returns {Promise<Array<{url, title, snippet}>>}
 */
export async function runSearchMode(env = {}) {
  const allResults = []
  const seen = new Set()

  for (const query of SEARCH_QUERIES) {
    console.log(`  🔍 搜索: "${query}"`)

    // 首选 DuckDuckGo（无需 Key）
    let results = await searchDuckDuckGo(query)

    // 若配置了 Bing Key，追加结果
    if (env.bingApiKey && results.length < 5) {
      const bingResults = await searchBing(query, env.bingApiKey)
      results = [...results, ...bingResults]
    }

    const filtered = filterSearchResults(results)
    console.log(`    找到 ${filtered.length} 条相关结果`)

    for (const r of filtered) {
      if (!seen.has(r.url)) {
        seen.add(r.url)
        allResults.push(r)
      }
    }

    await sleep(2000, 4000) // 搜索间隔，避免被限流
  }

  return allResults
}
