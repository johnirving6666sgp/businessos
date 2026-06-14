import { Hono } from 'hono'
import { requireAuth } from '../lib/auth.mjs'

const memories = new Hono()

// ── GET /api/memories ─────────────────────────────────────────
// 列表，支持 type 筛选 + 关键词搜索 + 分页
memories.get('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const type    = c.req.query('type')    || ''
  const q       = c.req.query('q')       || ''
  const pinned  = c.req.query('pinned')  || ''
  const page    = parseInt(c.req.query('page')  || '1')
  const limit   = parseInt(c.req.query('limit') || '30')
  const offset  = (page - 1) * limit

  let where = 'WHERE m.user_id = ?'
  const binds = [user.id]

  if (type) {
    where += ` AND m.type = ?`
    binds.push(type)
  }
  if (pinned === '1') {
    where += ` AND m.is_pinned = 1`
  }
  if (q) {
    where += ` AND (m.title LIKE ? OR m.content LIKE ? OR m.entity_name LIKE ?)`
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  const { results } = await c.env.DB.prepare(
    `SELECT m.* FROM memories m
     ${where}
     ORDER BY m.is_pinned DESC, m.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all()

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM memories m ${where}`
  ).bind(...binds).first()

  return c.json({
    memories: results.map(parseMemory),
    total: countRow?.total || 0,
    page, limit,
  })
})

// ── GET /api/memories/:id ─────────────────────────────────────
memories.get('/:id', requireAuth(), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    'SELECT * FROM memories WHERE id = ? AND user_id = ?'
  ).bind(c.req.param('id'), user.id).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(parseMemory(row))
})

// ── POST /api/memories ────────────────────────────────────────
// 手动创建笔记 / 外部写入活动记录
memories.post('/', requireAuth(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  const { title, content, type = 'note', entity_type, entity_id, entity_name, conv_id, tags } = body
  if (!title) return c.json({ error: 'title required' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO memories (user_id, type, title, content, entity_type, entity_id, entity_name, conv_id, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, type, title.slice(0, 200), content || null,
    entity_type || null, entity_id ? String(entity_id) : null,
    entity_name || null, conv_id || null,
    JSON.stringify(tags || [])
  ).run()

  return c.json({ ok: true, id: result.meta?.last_row_id }, 201)
})

// ── POST /api/memories/auto ───────────────────────────────────
// 系统内部调用（不验证用户，只验证内部来源标记）
// 用于 conversations 路由、opportunities 路由等自动写入
memories.post('/auto', requireAuth(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  const {
    type, title, content, entity_type, entity_id, entity_name, conv_id, tags
  } = body

  if (!title || !type) return c.json({ error: 'title + type required' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO memories (user_id, type, title, content, entity_type, entity_id, entity_name, conv_id, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, type, title.slice(0, 200), content || null,
    entity_type || null, entity_id ? String(entity_id) : null,
    entity_name || null, conv_id || null,
    JSON.stringify(tags || [])
  ).run()

  return c.json({ ok: true, id: result.meta?.last_row_id }, 201)
})

// ── POST /api/memories/from-conversation/:convId ──────────────
// AI 生成对话摘要并保存为记忆
memories.post('/from-conversation/:convId', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { convId } = c.req.param()

  // 获取对话
  const conv = await c.env.DB.prepare(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
  ).bind(convId, user.id).first()
  if (!conv) return c.json({ error: 'Conversation not found' }, 404)

  // 检查是否已有该对话的记忆
  const existing = await c.env.DB.prepare(
    'SELECT id FROM memories WHERE conv_id = ? AND user_id = ? AND type = ?'
  ).bind(convId, user.id, 'conversation').first()
  if (existing) return c.json({ ok: true, id: existing.id, already: true })

  // 获取最近 30 条消息
  const { results: msgs } = await c.env.DB.prepare(
    `SELECT role, content FROM messages WHERE conversation_id = ?
     ORDER BY created_at ASC LIMIT 30`
  ).bind(convId).all()

  if (msgs.length === 0) return c.json({ error: 'No messages' }, 400)

  // 构建对话文本（截取）
  const dialog = msgs.map(m =>
    `${m.role === 'user' ? '我' : 'Jamie'}: ${m.content.slice(0, 300)}`
  ).join('\n')

  // 调用 Claude Haiku 生成摘要
  let summary = ''
  let title = conv.title || '对话记录'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `请对以下销售工作对话生成一份简洁的档案记录，包含：
1. 标题（10字以内，描述本次对话的核心主题）
2. 关键信息摘要（3-5条要点，每条1句话）
3. 行动项（如有）

对话内容：
${dialog}

用 JSON 格式返回：{"title":"...","summary":"...","actions":"..."}
只返回 JSON。`,
        }],
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim()
      const match = text?.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        title = parsed.title || title
        summary = [parsed.summary, parsed.actions ? `\n行动项：${parsed.actions}` : '']
          .filter(Boolean).join('\n')
      }
    }
  } catch {}

  // 没能 AI 生成就用前几句话
  if (!summary) {
    summary = msgs.slice(0, 4).map(m =>
      `${m.role === 'user' ? '我' : 'Jamie'}: ${m.content.slice(0, 100)}`
    ).join('\n')
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO memories (user_id, type, title, content, conv_id)
    VALUES (?, 'conversation', ?, ?, ?)
  `).bind(user.id, title, summary, convId).run()

  return c.json({ ok: true, id: result.meta?.last_row_id, title, summary }, 201)
})

// ── PATCH /api/memories/:id ───────────────────────────────────
memories.patch('/:id', requireAuth(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { id } = c.req.param()

  const row = await c.env.DB.prepare(
    'SELECT id FROM memories WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first()
  if (!row) return c.json({ error: 'Not found' }, 404)

  const fields = []
  const vals = []

  if (body.title !== undefined)     { fields.push('title = ?');     vals.push(body.title.slice(0, 200)) }
  if (body.content !== undefined)   { fields.push('content = ?');   vals.push(body.content) }
  if (body.is_pinned !== undefined) { fields.push('is_pinned = ?'); vals.push(body.is_pinned ? 1 : 0) }
  if (body.tags !== undefined)      { fields.push('tags = ?');      vals.push(JSON.stringify(body.tags)) }

  if (fields.length === 0) return c.json({ ok: true })

  fields.push("updated_at = datetime('now')")
  vals.push(id, user.id)

  await c.env.DB.prepare(
    `UPDATE memories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...vals).run()

  return c.json({ ok: true })
})

// ── DELETE /api/memories/:id ──────────────────────────────────
memories.delete('/:id', requireAuth(), async (c) => {
  const user = c.get('user')
  await c.env.DB.prepare(
    'DELETE FROM memories WHERE id = ? AND user_id = ?'
  ).bind(c.req.param('id'), user.id).run()
  return c.json({ ok: true })
})

// ── 辅助 ─────────────────────────────────────────────────────
function parseMemory(row) {
  return {
    ...row,
    tags: safeJSON(row.tags, []),
    is_pinned: row.is_pinned === 1,
  }
}

function safeJSON(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

export default memories
