import { Hono } from 'hono'
import { requireAuth, uid } from '../lib/auth.mjs'

const proposals = new Hono()

// GET /api/proposals — 方案列表
proposals.get('/', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const status = c.req.query('status') || ''
  const customerId = c.req.query('customer_id') || ''

  let where = 'WHERE 1=1'
  const binds = []

  if (status) { where += ' AND p.status = ?'; binds.push(status) }
  if (customerId) { where += ' AND p.customer_id = ?'; binds.push(customerId) }

  const countSql = `SELECT COUNT(*) as n FROM proposals p ${where}`
  const listSql = `
    SELECT p.*, c.name as customer_name, u.display_name as creator_name
    FROM proposals p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN users u ON p.creator_id = u.id
    ${where}
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `

  const [countRow, { results }] = await Promise.all([
    c.env.DB.prepare(countSql).bind(...binds).first(),
    c.env.DB.prepare(listSql).bind(...binds, limit, offset).all(),
  ])

  const parsed = results.map(r => ({
    ...r,
    tech_params: safeJson(r.tech_params),
    cost_breakdown: safeJson(r.cost_breakdown),
    reference_cases: safeJson(r.reference_cases),
  }))

  return c.json({ proposals: parsed, total: countRow?.n || 0 })
})

// GET /api/proposals/:id — 方案详情
proposals.get('/:id', requireAuth('agents'), async (c) => {
  const { id } = c.req.param()

  const row = await c.env.DB.prepare(`
    SELECT p.*, c.name as customer_name, u.display_name as creator_name
    FROM proposals p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.id = ?
  `).bind(id).first()

  if (!row) return c.json({ error: 'Not found' }, 404)

  return c.json({
    ...row,
    tech_params: safeJson(row.tech_params),
    cost_breakdown: safeJson(row.cost_breakdown),
    reference_cases: safeJson(row.reference_cases),
  })
})

// POST /api/proposals — 新建方案
proposals.post('/', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.title?.trim()) return c.json({ error: '方案标题必填' }, 400)

  const id = uid('prop')

  await c.env.DB.prepare(`
    INSERT INTO proposals (
      id, title, customer_id, creator_id, status,
      scope, tech_params, cost_breakdown, risk_points,
      price_range_min, price_range_max, negotiation_space, open_questions, reference_cases
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.title.trim(),
    body.customer_id || null,
    user.id,
    body.status || 'draft',
    body.scope || null,
    body.tech_params ? JSON.stringify(body.tech_params) : null,
    body.cost_breakdown ? JSON.stringify(body.cost_breakdown) : null,
    body.risk_points || null,
    body.price_range_min || null,
    body.price_range_max || null,
    body.negotiation_space || null,
    body.open_questions || null,
    body.reference_cases ? JSON.stringify(body.reference_cases) : null,
  ).run()

  return c.json({ id }, 201)
})

// PATCH /api/proposals/:id — 更新方案
proposals.patch('/:id', requireAuth('agents'), async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()

  const fields = []
  const values = []

  const allowed = ['title','status','scope','risk_points','price_range_min','price_range_max','negotiation_space','open_questions']
  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); values.push(body[key]) }
  }
  const jsonFields = ['tech_params','cost_breakdown','reference_cases']
  for (const key of jsonFields) {
    if (key in body) { fields.push(`${key} = ?`); values.push(body[key] ? JSON.stringify(body[key]) : null) }
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await c.env.DB.prepare(
    `UPDATE proposals SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return c.json({ ok: true })
})

function safeJson(v) {
  if (!v) return null
  try { return JSON.parse(v) } catch { return v }
}

export default proposals
