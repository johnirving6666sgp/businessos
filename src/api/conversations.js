import { api, readSSE } from './client.js'
import { useConversationsStore } from '../store/conversations.js'
import { useUIStore } from '../store/ui.js'

export async function loadConversations() {
  const data = await api.get('/api/conversations')
  useConversationsStore.getState().setList(data.conversations)
  return data.conversations
}

export async function createConversation(agentType = 'personal') {
  const data = await api.post('/api/conversations', { agent_type: agentType })
  const conv = { id: data.id, agent_type: data.agent_type, context_level: 0, title: null, updated_at: new Date().toISOString() }
  useConversationsStore.getState().prependToList(conv)
  useConversationsStore.getState().setCurrent(conv)
  return conv
}

export async function loadMessages(convId) {
  const data = await api.get(`/api/conversations/${convId}/messages`)
  useConversationsStore.getState().setCurrent(data.conversation)
  useConversationsStore.getState().setMessages(data.messages)
  useConversationsStore.getState().setContextLevel(data.conversation.context_level)
  return data
}

/**
 * 发送消息（流式）
 * @param {string} convId
 * @param {string} content
 * @param {object} options - { entity_ref, context_level }
 */
export async function sendMessage(convId, content, options = {}) {
  const store = useConversationsStore.getState()

  // 乐观添加用户消息
  const tempUserMsg = { id: `temp_${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }
  store.appendMessage(tempUserMsg)
  store.startStream()

  try {
    const token = localStorage.getItem('bos_token') || ''
    const res = await fetch(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, ...options }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error)
    }

    let finalMsgId = null

    await readSSE(res, (event) => {
      switch (event.type) {
        case 'token':
          store.appendStream(event.content)
          break
        case 'context_level':
          store.setContextLevel(event.level)
          if (event.msg_id) finalMsgId = event.msg_id
          break
        case 'saved':
          finalMsgId = event.msg_id
          break
        case 'done':
          break
        case 'error':
          throw new Error(event.error)
      }
    })

    // 流结束：把流式内容变成正式消息
    const finalContent = useConversationsStore.getState().streamContent
    store.endStream({
      id: finalMsgId || `msg_${Date.now()}`,
      role: 'assistant',
      content: finalContent,
      created_at: new Date().toISOString(),
    })

    // 更新对话列表标题
    store.updateInList(convId, { updated_at: new Date().toISOString() })

  } catch (err) {
    store.endStream(null)
    useUIStore.getState().toast(err.message || '发送失败', 'error')
    throw err
  }
}

export async function sendFeedback(msgId, type, note) {
  await api.post(`/api/conversations/${msgId}/feedback`, { type, note })
  useUIStore.getState().toast('反馈已记录', 'success')
}

export async function createTaskFromMessage(messageId, title, dueDate, customerId) {
  const data = await api.post('/api/conversations/task-from-message', {
    message_id: messageId,
    title,
    due_date: dueDate,
    customer_id: customerId,
  })
  useUIStore.getState().toast('任务已创建', 'success')
  return data
}
