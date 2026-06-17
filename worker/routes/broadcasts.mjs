import { Hono } from 'hono'
import { requireAuth, uid, safeJSON } from '../lib/auth.mjs'

const broadcasts = new Hono()

// GET /api/broadcasts — 广播列表（我能看到的）
broadcasts.get('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, u.display_name as creator_name,
       (SELECT status FROM broadcast_responses WHERE broadcast_id = b.id AND user_id = ?) as my_status
     FROM broadcasts b
     JOIN users u ON u.id = b.creator_id
     WHERE b.creator_id = ? OR b.target_user_ids LIKE ?
     ORDER BY b.created_at DESC LIMIT 50`
  ).bind(user.id, user.id, `%"${user.id}"%`).all()

  return c.json({ broadcasts: results })
})

// GET /api/broadcasts/recipients — 可选目标成员（发广播时勾选用）
broadcasts.get('/recipients', requireAuth(), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, display_name FROM users
     WHERE is_active = 1 AND id != ?
     ORDER BY display_name`
  ).bind(user.id).all()
  return c.json({ recipients: results })
})

// POST /api/broadcasts — 创建广播（管理员，或拥有 broadcast 权限的成员）
broadcasts.post('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const perms = c.get('perms')
  const canBroadcast = perms.broadcast || ['super_admin', 'admin'].includes(user.role)
  if (!canBroadcast) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { title, content, target_user_ids } = await c.req.json()
  if (!title || !content || !Array.isArray(target_user_ids) || target_user_ids.length === 0) {
    return c.json({ error: '标题、内容、目标用户必填' }, 400)
  }

  const id = uid('bc')
  await c.env.DB.prepare(
    'INSERT INTO broadcasts (id, title, content, creator_id, target_user_ids) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, title, content, user.id, JSON.stringify(target_user_ids)).run()

  return c.json({ ok: true, id }, 201)
})

// POST /api/broadcasts/:id/respond — 回复广播
broadcasts.post('/:id/respond', requireAuth(), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const { status, note } = await c.req.json()

  const validStatuses = ['received', 'following_up', 'need_discussion']
  if (!validStatuses.includes(status)) return c.json({ error: 'Invalid status' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO broadcast_responses (id, broadcast_id, user_id, status, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(broadcast_id, user_id) DO UPDATE SET status = excluded.status, note = excluded.note`
  ).bind(uid('br'), id, user.id, status, note || null).run()

  return c.json({ ok: true })
})

export default broadcasts
