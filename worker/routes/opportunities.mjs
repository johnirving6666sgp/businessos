import { Hono } from 'hono'
import { requireAuth, uid, safeJSON } from '../lib/auth.mjs'

const opportunities = new Hono()

// GET /api/opportunities — 线索列表（分页 + 筛选）
opportunities.get('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const status = c.req.query('status') || 'pending,verified'
  const offset = (page - 1) * limit

  const statusList = status.split(',').map(s => `'${s}'`).join(',')

  const { results } = await c.env.DB.prepare(
    `SELECT
       o.*,
       MAX(r.score) as max_rating,
       AVG(r.score) as avg_rating,
       COUNT(r.id) as rating_count,
       (SELECT score FROM opportunity_ratings WHERE opportunity_id = o.id AND user_id = ?) as my_rating,
       (SELECT 1 FROM opportunity_saves WHERE opportunity_id = o.id AND user_id = ?) as is_saved
     FROM opportunities o
     LEFT JOIN opportunity_ratings r ON r.opportunity_id = o.id
     WHERE o.status IN (${statusList}) AND o.merged_into IS NULL
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(user.id, user.id, limit, offset).all()

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM opportunities WHERE status IN (${statusList}) AND merged_into IS NULL`
  ).first()

  return c.json({
    opportunities: results.map(parseOpportunity),
    total: countRow.total,
    page,
    limit,
  })
})

// GET /api/opportunities/:id — 单条详情
opportunities.get('/:id', requireAuth(), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const o = await c.env.DB.prepare(
    `SELECT o.*,
       (SELECT score FROM opportunity_ratings WHERE opportunity_id = o.id AND user_id = ?) as my_rating,
       (SELECT 1 FROM opportunity_saves WHERE opportunity_id = o.id AND user_id = ?) as is_saved
     FROM opportunities o WHERE o.id = ?`
  ).bind(user.id, user.id, id).first()

  if (!o) return c.json({ error: 'Not found' }, 404)

  // 所有人的评分
  const { results: ratings } = await c.env.DB.prepare(
    `SELECT u.display_name, r.score, r.note, r.created_at
     FROM opportunity_ratings r
     JOIN users u ON u.id = r.user_id
     WHERE r.opportunity_id = ?
     ORDER BY r.created_at DESC`
  ).bind(id).all()

  return c.json({ opportunity: parseOpportunity(o), ratings })
})

// POST /api/opportunities/:id/rate — 评分
opportunities.post('/:id/rate', requireAuth(), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const { score, note } = await c.req.json()

  const validScores = [0, 30, 60, 80, 100]
  if (!validScores.includes(score)) return c.json({ error: '无效评分' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO opportunity_ratings (id, opportunity_id, user_id, score, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(opportunity_id, user_id) DO UPDATE SET score = excluded.score, note = excluded.note`
  ).bind(uid('rate'), id, user.id, score, note || null).run()

  return c.json({ ok: true })
})

// POST /api/opportunities/:id/save — 收藏/取消收藏
opportunities.post('/:id/save', requireAuth(), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const { save } = await c.req.json()

  if (save) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO opportunity_saves (id, opportunity_id, user_id) VALUES (?, ?, ?)`
    ).bind(uid('save'), id, user.id).run()
  } else {
    await c.env.DB.prepare(
      'DELETE FROM opportunity_saves WHERE opportunity_id = ? AND user_id = ?'
    ).bind(id, user.id).run()
  }

  return c.json({ ok: true })
})

// POST /api/opportunities/import — 爬虫批量导入（需要 CRAWLER_SECRET）
opportunities.post('/import', async (c) => {
  const authHeader = c.req.header('authorization') || ''
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!c.env.CRAWLER_SECRET || key !== c.env.CRAWLER_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { source, items } = await c.req.json()
  if (!Array.isArray(items)) return c.json({ error: 'items must be array' }, 400)

  let inserted = 0
  let skipped = 0

  for (const item of items) {
    if (!item.title) continue

    // 按 URL 去重
    if (item.source_url) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM opportunities WHERE source_url = ?'
      ).bind(item.source_url).first()
      if (existing) { skipped++; continue }
    }

    await c.env.DB.prepare(
      `INSERT INTO opportunities (id, title, source_platform, source_url, raw_content, org_name, budget, deadline, contact_info, keywords, status, fetch_quality, crawled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).bind(
      uid('opp'),
      item.title,
      source || item.source_platform || 'unknown',
      item.source_url || null,
      item.raw_content || null,
      item.org_name || null,
      item.budget || null,
      item.deadline || null,
      item.contact_info || null,
      JSON.stringify(item.keywords || []),
      item.fetch_quality || 'partial',
    ).run()

    inserted++
  }

  return c.json({ ok: true, inserted, skipped })
})

// POST /api/opportunities — 手动添加线索
opportunities.post('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.title) return c.json({ error: '标题必填' }, 400)

  const id = uid('opp')
  await c.env.DB.prepare(
    `INSERT INTO opportunities (id, title, source_platform, source_url, raw_content, org_name, budget, deadline, keywords, status, fetch_quality)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, 'verified', 'full')`
  ).bind(
    id, body.title, body.source_url || null, body.raw_content || null,
    body.org_name || null, body.budget || null, body.deadline || null,
    JSON.stringify(body.keywords || [])
  ).run()

  return c.json({ ok: true, id }, 201)
})

function parseOpportunity(o) {
  return {
    ...o,
    keywords: safeJSON(o.keywords, []),
    is_saved: Boolean(o.is_saved),
    my_rating: o.my_rating ?? null,
    max_rating: o.max_rating ?? null,
    avg_rating: o.avg_rating ? Math.round(o.avg_rating) : null,
    rating_count: o.rating_count ?? 0,
  }
}

export default opportunities
