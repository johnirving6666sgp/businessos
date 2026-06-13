/**
 * 爬虫数据接收 API
 * 只接受携带 X-Crawler-Key 的请求（不走 cookie 认证）
 */

import { Hono } from 'hono'

const crawler = new Hono()

// ── 鉴权中间件 ────────────────────────────────────────────────
crawler.use('*', async (c, next) => {
  const key = c.req.header('X-Crawler-Key')
  const expected = c.env.CRAWLER_SECRET

  if (!expected) {
    return c.json({ error: 'CRAWLER_SECRET not configured' }, 503)
  }
  if (!key || key !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

// ── POST /api/crawler/opportunities ──────────────────────────
// 接收爬虫推送的单条采购公告
crawler.post('/opportunities', async (c) => {
  const body = await c.req.json()
  const db = c.env.DB

  const {
    title,
    institution,
    source_url,
    budget,
    deadline,
    equipment_type,
    specs,
    contact,
    summary,
    relevance_score,
    crawled_at,
  } = body

  if (!title || !source_url) {
    return c.json({ error: 'title and source_url are required' }, 400)
  }

  // 幂等：source_url 唯一，已存在则返回 409
  const existing = await db.prepare(
    'SELECT id FROM opportunities WHERE source_url = ? LIMIT 1'
  ).bind(source_url).first()

  if (existing) {
    return c.json({ ok: true, id: existing.id, duplicate: true }, 200)
  }

  // 插入新线索
  // 注意：opportunities 表可能没有所有这些字段，只写已有字段
  const result = await db.prepare(`
    INSERT INTO opportunities
      (title, institution, source_url, budget, deadline, equipment_type, specs,
       contact, summary, relevance_score, crawled_at, stage, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'crawler')
  `).bind(
    title,
    institution || null,
    source_url,
    budget || null,
    deadline || null,
    equipment_type || null,
    specs || null,
    contact || null,
    summary || null,
    relevance_score || 50,
    crawled_at || new Date().toISOString(),
  ).run()

  return c.json({ ok: true, id: result.meta?.last_row_id }, 201)
})

// ── GET /api/crawler/check ────────────────────────────────────
// 检查 URL 是否已存在（避免重复爬取）
crawler.get('/check', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ exists: false })

  const row = await c.env.DB.prepare(
    'SELECT id FROM opportunities WHERE source_url = ? LIMIT 1'
  ).bind(url).first()

  return c.json({ exists: !!row, id: row?.id || null })
})

// ── GET /api/crawler/stats ────────────────────────────────────
// 爬虫统计概览
crawler.get('/stats', async (c) => {
  const db = c.env.DB

  const total = await db.prepare(
    "SELECT COUNT(*) as n FROM opportunities WHERE source = 'crawler'"
  ).first()

  const today = await db.prepare(
    "SELECT COUNT(*) as n FROM opportunities WHERE source = 'crawler' AND DATE(crawled_at) = DATE('now')"
  ).first()

  const latest = await db.prepare(
    "SELECT title, institution, crawled_at FROM opportunities WHERE source = 'crawler' ORDER BY crawled_at DESC LIMIT 5"
  ).all()

  return c.json({
    total: total?.n || 0,
    today: today?.n || 0,
    latest: latest.results || [],
  })
})

export default crawler
