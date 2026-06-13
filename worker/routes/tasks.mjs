import { Hono } from 'hono'
import { requireAuth, uid } from '../lib/auth.mjs'

const tasks = new Hono()

const VALID_STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'closed']
const VALID_PRIORITIES = ['high', 'normal', 'low']

// GET /api/tasks — 任务列表
tasks.get('/', requireAuth('tasks'), async (c) => {
  const user = c.get('user')
  const mine = c.req.query('mine') === 'true'
  const status = c.req.query('status')

  let query = `
    SELECT t.*,
      a.display_name as assignee_name,
      cr.display_name as creator_name,
      c.name as customer_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users cr ON cr.id = t.creator_id
    LEFT JOIN customers c ON c.id = t.customer_id
    WHERE 1=1
  `
  const params = []

  if (mine) {
    query += ' AND (t.assignee_id = ? OR t.creator_id = ?)'
    params.push(user.id, user.id)
  }

  if (status && VALID_STATUSES.includes(status)) {
    query += ' AND t.status = ?'
    params.push(status)
  } else {
    query += ` AND t.status NOT IN ('done','closed')`
  }

  query += ` ORDER BY
    CASE t.priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    t.due_date ASC NULLS LAST,
    t.created_at DESC
    LIMIT 100`

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ tasks: results })
})

// POST /api/tasks — 创建任务
tasks.post('/', requireAuth('tasks'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.title) return c.json({ error: '标题必填' }, 400)

  const id = uid('task')
  await c.env.DB.prepare(
    `INSERT INTO tasks (id, title, description, assignee_id, creator_id, status, priority, due_date, source_type, source_id, customer_id, opportunity_id)
     VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.description || null,
    body.assignee_id || user.id, user.id,
    VALID_PRIORITIES.includes(body.priority) ? body.priority : 'normal',
    body.due_date || null,
    body.source_type || 'manual', body.source_id || null,
    body.customer_id || null, body.opportunity_id || null
  ).run()

  return c.json({ ok: true, id }, 201)
})

// PATCH /api/tasks/:id — 更新任务
tasks.patch('/:id', requireAuth('tasks'), async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()

  const existing = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields = ['title', 'description', 'assignee_id', 'status', 'priority', 'due_date', 'result_summary', 'customer_id']
  const updates = []
  const values = []

  for (const f of fields) {
    if (f in body) {
      if (f === 'status' && !VALID_STATUSES.includes(body[f])) continue
      if (f === 'priority' && !VALID_PRIORITIES.includes(body[f])) continue
      updates.push(`${f} = ?`)
      values.push(body[f])
    }
  }

  if (updates.length === 0) return c.json({ ok: true })

  updates.push(`updated_at = datetime('now')`)
  values.push(id)

  await c.env.DB.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return c.json({ ok: true })
})

// GET /api/tasks/dashboard — Dashboard 用的优先级数据
tasks.get('/dashboard', requireAuth(), async (c) => {
  const user = c.get('user')

  // 我的紧急任务（2天内截止）
  const { results: urgentTasks } = await c.env.DB.prepare(
    `SELECT t.*, c.name as customer_name
     FROM tasks t LEFT JOIN customers c ON c.id = t.customer_id
     WHERE t.assignee_id = ? AND t.status NOT IN ('done','closed')
     AND t.due_date IS NOT NULL AND t.due_date <= date('now', '+2 days')
     ORDER BY t.due_date ASC LIMIT 5`
  ).bind(user.id).all()

  // 久未跟进的客户（我负责，7天无互动）
  const { results: staleCustomers } = await c.env.DB.prepare(
    `SELECT id, name, stage,
       CAST((julianday('now') - julianday(COALESCE(last_interaction_at, created_at))) AS INTEGER) as days_since
     FROM customers
     WHERE owner_id = ? AND stage NOT IN ('won','lost')
     AND (last_interaction_at IS NULL OR last_interaction_at < datetime('now', '-7 days'))
     ORDER BY last_interaction_at ASC NULLS FIRST
     LIMIT 5`
  ).bind(user.id).all()

  // 热门商机（任何人评 80+，我未评）
  const { results: hotOpportunities } = await c.env.DB.prepare(
    `SELECT o.id, o.title, o.org_name, o.budget, o.deadline,
       MAX(r.score) as max_rating, COUNT(r.id) as rating_count
     FROM opportunities o
     JOIN opportunity_ratings r ON r.opportunity_id = o.id
     WHERE o.status != 'dismissed'
     AND o.id NOT IN (SELECT opportunity_id FROM opportunity_ratings WHERE user_id = ?)
     GROUP BY o.id
     HAVING MAX(r.score) >= 80
     ORDER BY MAX(r.score) DESC, o.created_at DESC
     LIMIT 3`
  ).bind(user.id).all()

  // 等待我回复的广播
  const { results: pendingBroadcasts } = await c.env.DB.prepare(
    `SELECT b.id, b.title, b.content, u.display_name as creator_name, b.created_at
     FROM broadcasts b
     JOIN users u ON u.id = b.creator_id
     WHERE EXISTS (SELECT 1 FROM json_each(b.target_user_ids) WHERE value = ?)
       AND b.id NOT IN (SELECT broadcast_id FROM broadcast_responses WHERE user_id = ?)
     ORDER BY b.created_at DESC LIMIT 5`
  ).bind(user.id, user.id).all().catch(() => ({ results: [] }))

  return c.json({
    urgent_tasks: urgentTasks,
    stale_customers: staleCustomers,
    hot_opportunities: hotOpportunities,
    pending_broadcasts: pendingBroadcasts,
  })
})

export default tasks
