/**
 * 内容提取：调用 Claude Haiku 从页面文本中提取采购公告信息
 * 不依赖 Anthropic SDK，直接使用原生 fetch
 */

import { htmlToText, extractLinks } from './http.mjs'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

/**
 * 判断页面是否包含采购公告列表（而不是具体公告详情）
 * 根据链接数量和关键词来判断
 */
export function detectPageType(html, url) {
  const text = htmlToText(html)
  const hasListKeywords = /招标|采购|公告|通知|中标|询价/.test(text)
  const linkCount = (html.match(/<a\s/gi) || []).length

  // 如果 URL 本身包含搜索/列表类词汇，认为是列表页
  const isListUrl = /list|search|query|结果|gg|cggg|zbgg|tzgg/.test(url)

  return {
    isList: isListUrl || (linkCount > 10 && hasListKeywords),
    hasContent: hasListKeywords && text.length > 200,
  }
}

/**
 * 从链接列表中筛选出可能是采购公告的链接
 */
export function filterProcurementLinks(links, keywords) {
  const allKeywords = [
    '招标', '采购', '公告', '通知', '中标', '询价', '竞争', '遴选', '招募',
    ...keywords,
  ]

  return links.filter(link => {
    const combined = (link.text + ' ' + link.href).toLowerCase()
    return allKeywords.some(kw => combined.includes(kw))
  }).slice(0, 20) // 最多返回 20 条
}

/**
 * 使用 Claude Haiku 提取公告中的关键信息
 * @param {string} text - 页面纯文本
 * @param {string} sourceUrl - 原始页面 URL
 * @param {string} apiKey - Anthropic API Key
 * @returns {Promise<object|null>} 提取的结构化数据，或 null（不相关内容）
 */
export async function extractWithClaude(text, sourceUrl, apiKey) {
  const prompt = `你是一个专门分析中文采购公告的信息提取机器人。

请从下面的页面文本中提取真空冶金/真空镀膜/高温合金相关的采购或招标信息。

如果这个页面与真空设备、真空炉、感应熔炼炉、真空镀膜设备、高温合金、钛合金、粉末冶金相关，请返回 JSON 格式的信息。
如果完全不相关，只返回 null。

页面来源: ${sourceUrl}

页面文本:
${text.slice(0, 4000)}

请返回如下 JSON（所有字段均为字符串，可为空字符串）：
{
  "title": "公告标题",
  "institution": "发布机构名称",
  "budget": "预算金额（如有，含单位）",
  "deadline": "截止日期（如有，格式 YYYY-MM-DD 或原文）",
  "equipment_type": "设备类型关键词（如：真空感应熔炼炉、VIM）",
  "specs": "关键技术参数摘要（100字以内）",
  "contact": "联系方式（如有）",
  "relevance_score": "相关度 0-100 的整数",
  "summary": "50字以内的中文摘要"
}

只返回 JSON，不要其他文字。如不相关，返回 null。`

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const content = data.content?.[0]?.text?.trim()

    if (!content || content === 'null') return null

    // 提取 JSON（防止模型在 JSON 前后加了文字）
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const score = parseInt(parsed.relevance_score) || 0
    if (score < 30) return null // 相关度太低，丢弃

    return parsed
  } catch (err) {
    console.error(`  [extract] Claude API 错误: ${err.message}`)
    return null
  }
}

/**
 * 将提取结果映射到 opportunities 表字段
 */
export function mapToOpportunity(extracted, sourceUrl, targetName) {
  const now = new Date().toISOString()

  return {
    title: extracted.title || `${targetName} 采购公告`,
    institution: extracted.institution || targetName,
    source_url: sourceUrl,
    budget: extracted.budget || null,
    deadline: parseDate(extracted.deadline),
    equipment_type: extracted.equipment_type || null,
    specs: extracted.specs || null,
    contact: extracted.contact || null,
    summary: extracted.summary || null,
    relevance_score: parseInt(extracted.relevance_score) || 50,
    crawled_at: now,
    status: 'new',
  }
}

function parseDate(str) {
  if (!str) return null
  // 尝试解析 YYYY-MM-DD 格式
  const match = str.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/)
  if (match) {
    const [, y, m, d] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return str.slice(0, 50) // 返回原文前50字符
}
