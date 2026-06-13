import { Hono } from 'hono'
import {
  hashPassword, verifyPassword, createSession, deleteSession,
  requireAuth, setSessionCookie, clearSessionCookie, uid, safeJSON
} from '../lib/auth.mjs'

const auth = new Hono()

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  if (!username || !password) return c.json({ error: '请输入用户名和密码' }, 400)

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ? AND is_active = 1'
  ).bind(username.trim().toLowerCase()).first()

  if (!user) return c.json({ error: '用户名或密码错误' }, 401)

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return c.json({ error: '用户名或密码错误' }, 401)

  const token = await createSession(c.env.DB, user.id)
  setSessionCookie(c, token)

  return c.json({
    ok: true,
    user: sanitizeUser(user),
    token,
  })
})

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const cookie = c.req.header('cookie') || ''
  const match = cookie.match(/bos_token=([^;]+)/)
  if (match) await deleteSession(c.env.DB, match[1])
  clearSessionCookie(c)
  return c.json({ ok: true })
})

// GET /api/auth/me — 返回当前用户信息
auth.get('/me', requireAuth(), async (c) => {
  const user = c.get('user')
  const perms = c.get('perms')

  // 加载 Agent 配置
  const agentConfig = await c.env.DB.prepare(
    "SELECT growth_level, growth_points FROM agent_configs WHERE user_id = ? AND agent_type = 'personal'"
  ).bind(user.id).first()

  return c.json({
    user: sanitizeUser(user),
    permissions: perms,
    agent: agentConfig || { growth_level: 0, growth_points: 0 },
  })
})

// GET /api/auth/users — 所有用户列表（admin only）
auth.get('/users', requireAuth(), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { results } = await c.env.DB.prepare(
    'SELECT id, username, display_name, role, model_tier, permissions, is_active, created_at FROM users ORDER BY created_at'
  ).all()

  return c.json({ users: results.map(u => ({ ...u, permissions: safeJSON(u.permissions, {}) })) })
})

// PATCH /api/auth/users/:id/permissions — 修改权限（super_admin only）
auth.patch('/users/:id/permissions', requireAuth(), async (c) => {
  const me = c.get('user')
  if (me.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)

  const { id } = c.req.param()
  const body = await c.req.json()
  const allowed = ['agents', 'customers', 'tasks', 'quote', 'quoteTraining', 'insight']

  // 只更新允许的字段
  const current = await c.env.DB.prepare('SELECT permissions FROM users WHERE id = ?').bind(id).first()
  if (!current) return c.json({ error: 'User not found' }, 404)

  const perms = safeJSON(current.permissions, {})
  for (const key of allowed) {
    if (key in body) perms[key] = Boolean(body[key])
  }

  await c.env.DB.prepare(
    `UPDATE users SET permissions = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(perms), id).run()

  return c.json({ ok: true, permissions: perms })
})

// PATCH /api/auth/users/:id/model — 修改模型档（super_admin only）
auth.patch('/users/:id/model', requireAuth(), async (c) => {
  const me = c.get('user')
  if (me.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)

  const { id } = c.req.param()
  const { model_tier } = await c.req.json()
  if (!['opus', 'sonnet', 'haiku'].includes(model_tier)) {
    return c.json({ error: 'Invalid model tier' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE users SET model_tier = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(model_tier, id).run()

  return c.json({ ok: true })
})

// PATCH /api/auth/users/:id/active — 启用/停用账号
auth.patch('/users/:id/active', requireAuth(), async (c) => {
  const me = c.get('user')
  if (me.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)

  const { id } = c.req.param()
  const { is_active } = await c.req.json()

  await c.env.DB.prepare(
    `UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(is_active ? 1 : 0, id).run()

  if (!is_active) {
    // 停用时清除所有 session
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  }

  return c.json({ ok: true })
})

function sanitizeUser(user) {
  const { password_hash, ...safe } = user
  return { ...safe, permissions: safeJSON(user.permissions, {}) }
}

export default auth
