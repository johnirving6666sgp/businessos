/**
 * Mode B: 搜索引擎驱动爬取
 *
 * 三层策略（依次降级）：
 *   1. DuckDuckGo HTML — 无需 Key，但格式经常变
 *   2. Bing HTML — 无需 Key，结果质量好，对中文友好
 *   3. Bing Search API — 需 Azure Key，可选
 */

import { fetchPage, htmlToText, sleep } from '../lib/http.mjs'

const SEARCH_QUERIES = [
  '真空熔炼炉 招标 采购公告 2026',
  '真空感应熔炼 设备采购 招标',
  '高温合金 真空冶金 采购 公告',
  '真空电弧炉 招标 公告',
  '粉末冶金 真空烧结 招标 公告',
  '真空镀膜设备 采购 招标 2026',
  '定向凝固 真空炉 采购 公告',
]

// ── DuckDuckGo ────────────────────────────────────────────────

/**
 * DuckDuckGo HTML 搜索 + 健壮解析
 * DDG 不断改版，用多种解析方式兜底
 */
export async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=cn-zh&s=0`

  let html
  try {
    ;({ html } = await fetchPage(url, { timeoutMs: 20000, retries: 1 }))
  } catch (err) {
    console.warn(`    [DDG] 请求失败: ${err.message}`)
    return []
  }

  if (html.length < 500) {
    console.warn(`    [DDG] 响应过短 (${html.length} bytes)，可能被限流`)
    return []
  }

  return parseDDG(html)
}

function parseDDG(html) {
  const results = []
  const seen = new Set()

  // 方法1: 新版 DDG HTML（class="result__a"）
  const re1 = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re1.exec(html)) !== null) {
    const href = decodeURIComponent(m[1]).replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '')
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (href.startsWith('http') && !seen.has(href)) {
      seen.add(href)
      results.push({ url: href, title, snippet: '' })
    }
  }

  // 方法2: 通用结果链接提取（兜底）
  if (results.length === 0) {
    const re2 = /href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"[^>]*>([^<]{10,100})</gi
    while ((m = re2.exec(html)) !== null) {
      const href = m[1]
      const title = m[2].trim()
      if (!seen.has(href)) {
        seen.add(href)
        results.push({ url: href, title, snippet: '' })
      }
    }
  }

  // 提取摘要
  const snips = []
  const reSnip = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  while ((m = reSnip.exec(html)) !== null) {
    snips.push(m[1].replace(/<[^>]+>/g, '').trim())
  }
  results.forEach((r, i) => { r.snippet = snips[i] || '' })

  return results.slice(0, 15)
}

// ── Bing HTML（无需 API Key，中文内容效果好）──────────────────

export async function searchBingHTML(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN&setlang=zh-CN&count=15&first=1`

  let html
  try {
    ;({ html } = await fetchPage(url, {
      timeoutMs: 20000,
      retries: 1,
    }))
  } catch (err) {
    console.warn(`    [Bing HTML] 请求失败: ${err.message}`)
    return []
  }

  if (html.length < 500) {
    console.warn(`    [Bing HTML] 响应过短，可能被限流`)
    return []
  }

  return parseBingHTML(html)
}

function parseBingHTML(html) {
  const results = []
  const seen = new Set()

  // Bing 搜索结果：<h2><a href="..."...>title</a></h2>
  const re = /<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const href = m[1].split('&')[0] // 去掉 Bing 追踪参数
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (!seen.has(href) && title) {
      seen.add(href)
      results.push({ url: href, title, snippet: '' })
    }
  }

  // 兜底：提取 cite 标签附近的 href
  if (results.length === 0) {
    const re2 = /href="(https?:\/\/(?!(?:www\.)?bing\.com)[^"]{10,200})"/gi
    while ((m = re2.exec(html)) !== null) {
      const href = m[1]
      if (!seen.has(href)) {
        seen.add(href)
        results.push({ url: href, title: '', snippet: '' })
      }
    }
  }

  return results.slice(0, 15)
}

// ── Bing Search API（Azure，可选）────────────────────────────

export async function searchBingAPI(query, apiKey) {
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&mkt=zh-CN&count=15&freshness=Month`
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    })
    if (!res.ok) throw new Error(`Bing API ${res.status}`)
    const data = await res.json()
    return (data.webPages?.value || []).map(item => ({
      url: item.url,
      title: item.name,
      snippet: item.snippet,
    }))
  } catch (err) {
    console.warn(`    [Bing API] ${err.message}`)
    return []
  }
}

// ── 过滤 ──────────────────────────────────────────────────────

const EXCLUDE = [
  /bing\.com/i, /google\.com/i, /baidu\.com\/link/i,
  /zhihu\.com/i, /baike\./i, /wikipedia/i, /weibo\.com/i,
  /taobao\.com/i, /jd\.com/i, /amazon\./i,
]

const REQUIRED_KW = ['招标', '采购', '公告', '中标', '询价', '竞争性', '遴选']

export function filterResults(results) {
  return results.filter(r => {
    if (!r.url) return false
    if (EXCLUDE.some(p => p.test(r.url))) return false
    const combined = (r.title || '') + ' ' + (r.snippet || '')
    return REQUIRED_KW.some(kw => combined.includes(kw))
  })
}

// ── 主入口 ────────────────────────────────────────────────────

export async function runSearchMode(env = {}) {
  const all = []
  const seen = new Set()

  for (const query of SEARCH_QUERIES) {
    console.log(`  🔍 "${query}"`)

    let results = []

    // 1. DuckDuckGo
    const ddg = await searchDuckDuckGo(query)
    results = [...results, ...ddg]

    // 2. Bing HTML（DuckDuckGo 结果不足时补充）
    if (results.length < 3) {
      await sleep(1000, 2000)
      const bing = await searchBingHTML(query)
      results = [...results, ...bing]
    }

    // 3. Bing API（如配置了 Key）
    if (env.bingApiKey && results.length < 5) {
      const bingApi = await searchBingAPI(query, env.bingApiKey)
      results = [...results, ...bingApi]
    }

    const filtered = filterResults(results)
    console.log(`    DDG ${ddg.length} 条 | 过滤后 ${filtered.length} 条相关`)

    for (const r of filtered) {
      if (!seen.has(r.url)) {
        seen.add(r.url)
        all.push(r)
      }
    }

    await sleep(2000, 4000)
  }

  return all
}
