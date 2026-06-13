import { Hono } from 'hono'
import { requireAuth, uid } from '../lib/auth.mjs'

const knowledge = new Hono()

// GET /api/knowledge — 知识库列表
knowledge.get('/', requireAuth('agents'), async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '30')
  const offset = (page - 1) * limit
  const q = c.req.query('q') || ''
  const tag = c.req.query('tag') || ''

  let where = "WHERE (k.visibility = 'team' OR k.visibility = 'public' OR k.author_id = ?)"
  const user = c.get('user')
  const binds = [user.id]

  if (q) {
    where += ' AND (k.title LIKE ? OR k.content LIKE ?)'
    binds.push(`%${q}%`, `%${q}%`)
  }
  if (tag) {
    where += ' AND k.tags LIKE ?'
    binds.push(`%"${tag}"%`)
  }

  const countSql = `SELECT COUNT(*) as n FROM knowledge_items k ${where}`
  const listSql = `
    SELECT k.id, k.title, k.tags, k.visibility, k.source_type, k.is_published,
           k.created_at, k.updated_at, u.display_name as author_name,
           substr(k.content, 1, 200) as content_preview
    FROM knowledge_items k
    LEFT JOIN users u ON k.author_id = u.id
    ${where}
    ORDER BY k.updated_at DESC
    LIMIT ? OFFSET ?
  `

  const [countRow, { results }] = await Promise.all([
    c.env.DB.prepare(countSql).bind(...binds).first(),
    c.env.DB.prepare(listSql).bind(...binds, limit, offset).all(),
  ])

  const parsed = results.map(r => ({
    ...r,
    tags: safeJson(r.tags) || [],
  }))

  return c.json({ items: parsed, total: countRow?.n || 0 })
})

// GET /api/knowledge/:id — 知识条目详情
knowledge.get('/:id', requireAuth('agents'), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  const row = await c.env.DB.prepare(`
    SELECT k.*, u.display_name as author_name
    FROM knowledge_items k
    LEFT JOIN users u ON k.author_id = u.id
    WHERE k.id = ? AND (k.visibility IN ('team','public') OR k.author_id = ?)
  `).bind(id, user.id).first()

  if (!row) return c.json({ error: 'Not found' }, 404)

  return c.json({ ...row, tags: safeJson(row.tags) || [] })
})

// POST /api/knowledge — 新建知识条目
knowledge.post('/', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.title?.trim()) return c.json({ error: '标题必填' }, 400)
  if (!body.content?.trim()) return c.json({ error: '内容必填' }, 400)

  const id = uid('kn')

  await c.env.DB.prepare(`
    INSERT INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    id,
    body.title.trim(),
    body.content.trim(),
    body.tags ? JSON.stringify(body.tags) : null,
    user.id,
    body.visibility || 'team',
    body.source_type || 'manual',
  ).run()

  return c.json({ id }, 201)
})

// PATCH /api/knowledge/:id — 更新知识条目
knowledge.patch('/:id', requireAuth('agents'), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const body = await c.req.json()

  // 只有作者可以编辑
  const existing = await c.env.DB.prepare('SELECT author_id FROM knowledge_items WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.author_id !== user.id) return c.json({ error: 'Forbidden' }, 403)

  const fields = []
  const values = []

  if (body.title) { fields.push('title = ?'); values.push(body.title.trim()) }
  if (body.content) { fields.push('content = ?'); values.push(body.content.trim()) }
  if ('tags' in body) { fields.push('tags = ?'); values.push(body.tags ? JSON.stringify(body.tags) : null) }
  if ('visibility' in body) { fields.push('visibility = ?'); values.push(body.visibility) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await c.env.DB.prepare(`UPDATE knowledge_items SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

  return c.json({ ok: true })
})

function safeJson(v) {
  if (!v) return null
  try { return JSON.parse(v) } catch { return v }
}

export default knowledge
