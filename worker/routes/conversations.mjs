import { Hono } from 'hono'
import { requireAuth, uid } from '../lib/auth.mjs'
import { detectContextLevel, buildSystemPrompt } from '../lib/agent.mjs'
import { streamChat } from '../lib/llm.mjs'

const conversations = new Hono()

// GET /api/conversations — 当前用户的对话列表
conversations.get('/', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, agent_type, context_level, updated_at
     FROM conversations
     WHERE user_id = ? AND is_archived = 0
     ORDER BY updated_at DESC
     LIMIT 50`
  ).bind(user.id).all()

  return c.json({ conversations: results })
})

// POST /api/conversations — 创建新对话
conversations.post('/', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const agentType = body.agent_type || 'personal'
  const id = uid('conv')

  await c.env.DB.prepare(
    `INSERT INTO conversations (id, user_id, agent_type, title, context_level)
     VALUES (?, ?, ?, ?, 0)`
  ).bind(id, user.id, agentType, body.title || null).run()

  return c.json({ id, agent_type: agentType, context_level: 0 }, 201)
})

// GET /api/conversations/:id/messages — 获取消息列表
conversations.get('/:id/messages', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const conv = await c.env.DB.prepare(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first()
  if (!conv) return c.json({ error: 'Not found' }, 404)

  const { results } = await c.env.DB.prepare(
    `SELECT id, role, content, created_at FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC`
  ).bind(id).all()

  return c.json({ conversation: conv, messages: results })
})

// POST /api/conversations/:id/messages — 发送消息（SSE 流式返回）
conversations.post('/:id/messages', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const conv = await c.env.DB.prepare(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first()
  if (!conv) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json()
  const userContent = body.content?.trim()
  if (!userContent) return c.json({ error: '消息不能为空' }, 400)

  // 保存用户消息
  const userMsgId = uid('msg')
  await c.env.DB.prepare(
    "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).bind(userMsgId, id, userContent).run()

  // 获取历史消息（最近 20 条）
  const { results: history } = await c.env.DB.prepare(
    `SELECT role, content FROM messages
     WHERE conversation_id = ? AND role IN ('user','assistant')
     ORDER BY created_at DESC LIMIT 20`
  ).bind(id).all()
  const messages = history.reverse()

  // 检测上下文级别
  const contextLevel = body.context_level ?? detectContextLevel(messages)

  // 构建 system prompt
  const entityRef = body.entity_ref || null
  const systemPrompt = await buildSystemPrompt({
    user,
    contextLevel,
    db: c.env.DB,
    entityRef,
    lastUserMessage: userContent,
  })

  // 更新对话上下文级别
  await c.env.DB.prepare(
    `UPDATE conversations SET context_level = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(contextLevel, id).run()

  // 生成标题（第一条用户消息）
  if (!conv.title) {
    const title = userContent.slice(0, 40) + (userContent.length > 40 ? '...' : '')
    await c.env.DB.prepare(
      'UPDATE conversations SET title = ? WHERE id = ?'
    ).bind(title, id).run()
  }

  // 「拉进对话」自动记忆：仅在首次携带 entity_ref 时触发
  if (entityRef && !conv.title) {
    const entityLabel = entityRef.name || entityRef.id || '未知实体'
    c.env.DB.prepare(`
      INSERT INTO memories (user_id, type, title, content, entity_type, entity_id, entity_name, conv_id)
      VALUES (?, 'pull_to_chat', ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      `将「${entityLabel}」拉进对话`,
      `用户主动将 ${entityRef.type || ''} 「${entityLabel}」带入 AI 对话，进行深度分析。`,
      entityRef.type || null,
      entityRef.id ? String(entityRef.id) : null,
      entityLabel,
      id,
    ).run().catch(() => {}) // 非阻塞，静默失败
  }

  // 准备 SSE 流式输出
  const assistantMsgId = uid('msg')
  let fullContent = ''

  const llmStream = streamChat({
    env: c.env,
    modelTier: user.model_tier,
    systemPrompt,
    messages,
  })

  // 透传 SSE + 收集完整内容后存库
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  // 异步处理流
  const reader = llmStream.getReader()
  const processStream = async () => {
    try {
      // 先发送 context_level 信息
      await writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'context_level', level: contextLevel, msg_id: assistantMsgId })}\n\n`
        )
      )

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // 解析 SSE chunk 累积内容
        const text = new TextDecoder().decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === 'token') fullContent += evt.content
            } catch {}
          }
        }
        await writer.write(value)
      }

      // 保存 AI 回复到 DB
      await c.env.DB.prepare(
        "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)"
      ).bind(assistantMsgId, id, fullContent).run()

      await c.env.DB.prepare(
        `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run()

      // 发送完成事件
      await writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'saved', msg_id: assistantMsgId })}\n\n`
        )
      )
    } catch (e) {
      await writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`
        )
      )
    } finally {
      await writer.close()
    }
  }

  processStream()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
})

// DELETE /api/conversations/:id — 归档对话
conversations.delete('/:id', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  await c.env.DB.prepare(
    'UPDATE conversations SET is_archived = 1 WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).run()

  return c.json({ ok: true })
})

// POST /api/conversations/:id/feedback — 消息反馈
conversations.post('/:msgId/feedback', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { msgId } = c.req.param()
  const { type, note } = await c.req.json()

  const validTypes = ['useful', 'inaccurate', 'need_detail']
  if (!validTypes.includes(type)) return c.json({ error: 'Invalid feedback type' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO message_feedback (id, message_id, user_id, type, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(message_id, user_id) DO UPDATE SET type = excluded.type, note = excluded.note`
  ).bind(uid('fb'), msgId, user.id, type, note || null).run()

  // 成长积分：反馈 = +2 points
  await addGrowthPoints(c.env.DB, user.id, 2)

  return c.json({ ok: true })
})

// POST /api/conversations/task-from-message — 从消息创建任务
conversations.post('/task-from-message', requireAuth('agents'), async (c) => {
  const user = c.get('user')
  const { message_id, title, due_date, customer_id } = await c.req.json()

  if (!title) return c.json({ error: '任务标题必填' }, 400)

  const taskId = uid('task')
  await c.env.DB.prepare(
    `INSERT INTO tasks (id, title, assignee_id, creator_id, status, due_date, source_type, source_id, customer_id)
     VALUES (?, ?, ?, ?, 'todo', ?, 'conversation', ?, ?)`
  ).bind(taskId, title, user.id, user.id, due_date || null, message_id || null, customer_id || null).run()

  // 成长积分：生成任务 = +5 points
  await addGrowthPoints(c.env.DB, user.id, 5)

  return c.json({ ok: true, task_id: taskId }, 201)
})

async function addGrowthPoints(db, userId, points) {
  await db.prepare(
    `UPDATE agent_configs SET growth_points = growth_points + ?
     WHERE user_id = ? AND agent_type = 'personal'`
  ).bind(points, userId).run()
}

export default conversations
