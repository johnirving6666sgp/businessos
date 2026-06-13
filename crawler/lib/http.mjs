/**
 * HTTP 工具：带超时、重试、UA 轮换的 fetch 封装
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** 随机延迟 (ms)，模拟人类浏览间隔 */
export function sleep(minMs = 2000, maxMs = 6000) {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise(r => setTimeout(r, ms))
}

/**
 * 带超时和重试的 GET 请求
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.timeoutMs - 超时毫秒数，默认 15000
 * @param {number} opts.retries - 重试次数，默认 2
 * @param {number} opts.retryDelayMs - 重试间隔，默认 5000
 * @returns {Promise<{html: string, finalUrl: string, statusCode: number}>}
 */
export async function fetchPage(url, { timeoutMs = 15000, retries = 2, retryDelayMs = 5000 } = {}) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`  [retry ${attempt}/${retries}] ${url}`)
      await sleep(retryDelayMs, retryDelayMs * 2)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
        redirect: 'follow',
      })

      clearTimeout(timer)

      if (!res.ok && res.status !== 404) {
        throw new Error(`HTTP ${res.status}`)
      }

      const html = await res.text()
      return { html, finalUrl: res.url, statusCode: res.status }

    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (err.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeoutMs}ms`)
      }
    }
  }

  throw lastError
}

/**
 * 从 HTML 中提取纯文本，删除脚本/样式/导航等噪音
 * 返回适合输入 LLM 的干净文本（限 6000 字符）
 */
export function htmlToText(html) {
  if (!html) return ''

  return html
    // 删除 script/style/nav/footer/header
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 保留换行语义
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    // 删除其余标签
    .replace(/<[^>]+>/g, '')
    // 解码常见 HTML 实体
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    // 压缩空白
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000)
}

/**
 * 从 HTML 中提取所有链接 (href + 链接文字)
 */
export function extractLinks(html, baseUrl) {
  const links = []
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    let href = match[1].trim()
    const text = htmlToText(match[2]).trim()

    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue

    // 处理相对链接
    try {
      href = new URL(href, baseUrl).toString()
    } catch {
      continue
    }

    if (text.length > 5 && text.length < 200) {
      links.push({ href, text })
    }
  }

  // 去重
  const seen = new Set()
  return links.filter(l => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  })
}
