import { Hono } from 'hono'
import { requireAuth, uid } from '../lib/auth.mjs'

const customers = new Hono()

const VALID_STAGES = ['untouched', 'contacted', 'interested', 'quoting', 'closing', 'won', 'lost']

// GET /api/customers — 客户列表（按阶段分组）
customers.get('/', requireAuth('customers'), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
       u.display_name as owner_name,
       (SELECT COUNT(*) FROM tasks WHERE customer_id = c.id AND status NOT IN ('done','closed')) as open_tasks,
       (SELECT summary FROM customer_interactions WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_interaction_summary
     FROM customers c
     LEFT JOIN users u ON u.id = c.owner_id
     ORDER BY
       CASE c.stage
         WHEN 'closing' THEN 1 WHEN 'quoting' THEN 2 WHEN 'interested' THEN 3
         WHEN 'contacted' THEN 4 WHEN 'untouched' THEN 5 WHEN 'won' THEN 6 ELSE 7
       END,
       c.updated_at DESC`
  ).all()

  return c.json({ customers: results })
})

// POST /api/customers — 创建客户
customers.post('/', requireAuth('customers'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.name) return c.json({ error: '客户名称必填' }, 400)

  const id = uid('cust')
  await c.env.DB.prepare(
    `INSERT INTO customers (id, name, stage, owner_id, industry, contact_name, contact_phone, contact_email, website, notes, source_opportunity_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name,
    VALID_STAGES.includes(body.stage) ? body.stage : 'untouched',
    body.owner_id || user.id,
    body.industry || null, body.contact_name || null,
    body.contact_phone || null, body.contact_email || null,
    body.website || null, body.notes || null,
    body.source_opportunity_id || null
  ).run()

  return c.json({ ok: true, id }, 201)
})

// GET /api/customers/:id — 单个客户详情
customers.get('/:id', requireAuth('customers'), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  const customer = await c.env.DB.prepare(
    `SELECT c.*, u.display_name as owner_name
     FROM customers c LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.id = ?`
  ).bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const { results: interactions } = await c.env.DB.prepare(
    `SELECT ci.*, u.display_name as user_name
     FROM customer_interactions ci
     JOIN users u ON u.id = ci.user_id
     WHERE ci.customer_id = ?
     ORDER BY ci.created_at DESC LIMIT 20`
  ).bind(id).all()

  const { results: tasks } = await c.env.DB.prepare(
    `SELECT t.*, u.display_name as assignee_name
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.customer_id = ? AND t.status NOT IN ('done','closed')
     ORDER BY t.due_date ASC NULLS LAST`
  ).bind(id).all()

  const { results: proposals } = await c.env.DB.prepare(
    'SELECT id, title, status, price_range_min, price_range_max, updated_at FROM proposals WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 5'
  ).bind(id).all()

  return c.json({ customer, interactions, tasks, proposals })
})

// PATCH /api/customers/:id — 更新客户信息
customers.patch('/:id', requireAuth('customers'), async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()
  const user = c.get('user')

  const existing = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  // 阶段变更记录
  if (body.stage && body.stage !== existing.stage) {
    if (!VALID_STAGES.includes(body.stage)) return c.json({ error: '无效阶段' }, 400)
    await c.env.DB.prepare(
      `INSERT INTO customer_interactions (id, customer_id, user_id, type, summary)
       VALUES (?, ?, ?, 'stage_change', ?)`
    ).bind(uid('ci'), id, user.id, `阶段从「${existing.stage}」变更为「${body.stage}」`).run()
  }

  const fields = ['name', 'stage', 'owner_id', 'industry', 'contact_name', 'contact_phone', 'contact_email', 'website', 'notes']
  const updates = []
  const values = []

  for (const f of fields) {
    if (f in body) {
      updates.push(`${f} = ?`)
      values.push(body[f])
    }
  }

  if (updates.length === 0) return c.json({ ok: true })

  updates.push(`updated_at = datetime('now')`)
  values.push(id)

  await c.env.DB.prepare(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return c.json({ ok: true })
})

// POST /api/customers/:id/interactions — 添加沟通记录
customers.post('/:id/interactions', requireAuth('customers'), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.summary) return c.json({ error: '记录内容必填' }, 400)

  const ciId = uid('ci')
  await c.env.DB.prepare(
    `INSERT INTO customer_interactions (id, customer_id, user_id, type, summary, next_action, next_action_due)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(ciId, id, user.id, body.type || 'note', body.summary, body.next_action || null, body.next_action_due || null).run()

  // 更新最近互动时间
  await c.env.DB.prepare(
    `UPDATE customers SET last_interaction_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run()

  return c.json({ ok: true, id: ciId }, 201)
})

export default customers
